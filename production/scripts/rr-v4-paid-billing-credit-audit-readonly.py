#!/usr/bin/env python3
"""V4 paid billing audit, read-only Omise + Firestore REST GET only.
No secrets, identifiers, PII, request body, or raw JSON printed.
"""
import base64
import importlib.util
import pathlib
import os
import re
import subprocess
import urllib.error
import urllib.parse

source=pathlib.Path(__file__).with_name("rr-v4-staging-billing-linkage-readonly.py")
spec=importlib.util.spec_from_file_location("v4link",source)
link=importlib.util.module_from_spec(spec)
spec.loader.exec_module(link)
MAX_AUDIT_DOCS=500
EXPECTED_CREDITS=5000

def audit_result(charge,account,bill,entries,complete):
    metadata=charge.get("metadata") or {}
    uid,request=metadata.get("uid"),metadata.get("requestId")
    if (charge.get("id")!=link.CHARGE or charge.get("livemode") is not False
        or charge.get("paid") is not True or charge.get("status")!="successful"
        or charge.get("amount")!=129000 or str(charge.get("currency","")).lower()!="thb"):
        return "OMISE_CHARGE_MISMATCH"
    if (not isinstance(uid,str) or not link.UID.fullmatch(uid)
        or not isinstance(request,str) or not link.REQUEST.fullmatch(request)
        or link.fs_str(bill,"requestedBy")!=uid
        or link.fs_str(bill,"omiseChargeId")!=link.CHARGE
        or link.fs_str(bill,"plan")!="Business"
        or link.fs_int(bill,"amountTHB")!=1290
        or link.fs_str(bill,"status")!="paid"):
        return "BILLING_PAID_RECORD_MISMATCH"
    purchased=link.fs_int(bill,"creditsPurchased")
    transferred=link.fs_int(bill,"transferredCredits")
    balance=link.fs_int(bill,"balanceAfter")
    if (purchased!=EXPECTED_CREDITS or transferred is None or transferred<0
        or balance is None or balance!=purchased+transferred):
        return "BILLING_WALLET_GRANT_MISMATCH"
    if not complete:return "AUDIT_LIST_INCOMPLETE"
    hits=[a for a in entries if
      link.fs_str(a,"action")=="subscription_credits_merged"
      and link.fs_str(a,"billingRequestId")==request]
    if len(hits)!=1:return "AUDIT_GRANT_COUNT_"+("NONE" if len(hits)==0 else "DUPLICATE")
    record=hits[0]
    if (link.fs_str(record,"omiseChargeId")!=link.CHARGE
        or link.fs_str(record,"plan")!="Business"
        or link.fs_int(record,"creditsPurchased")!=purchased
        or link.fs_int(record,"transferredCredits")!=transferred
        or link.fs_int(record,"balanceAfter")!=balance):
        return "AUDIT_GRANT_DETAIL_MISMATCH"
    if link.fs_int(account,"creditWalletRemaining") is None:
        return "CURRENT_WALLET_UNAVAILABLE"
    if link.fs_str(account,"plan")!="Business":
        return "ACCOUNT_CURRENT_PLAN_CHANGED"
    # Current wallet may have been legitimately spent; do not require equality to original balance.
    if link.fs_int(account,"creditWalletRemaining")<0:
        return "CURRENT_WALLET_INVALID"
    if account.get("fields",{}).get("creditWalletV1",{}).get("booleanValue") is not True:
        return "CURRENT_WALLET_FLAG_MISSING"
    return "PAID_GRANT_AUDIT_ONE_MATCH_CURRENT_PLAN"

def list_all_audits(root,headers,fetcher):
    docs=[]
    page_token=None
    for _ in range(10):
        q={"pageSize":"50"}
        if page_token:q["pageToken"]=page_token
        data=fetcher(root+"/audit?"+urllib.parse.urlencode(q),headers)
        page=data.get("documents") or []
        if not isinstance(page,list):raise ValueError("BAD_AUDIT_PAGE")
        docs.extend(page)
        if len(docs)>MAX_AUDIT_DOCS: return docs,False
        token=data.get("nextPageToken")
        if not token:return docs,True
        if token==page_token:raise ValueError("REPEATED_AUDIT_PAGE_TOKEN")
        page_token=token
    return docs,False

def main():
    if os.environ.get("RR_STAGING_PROJECT_ID")!=link.PROJECT:raise ValueError("STAGING_REQUIRED")
    if any(os.environ.get(k) for k in ("GOOGLE_APPLICATION_CREDENTIALS","FIREBASE_TOKEN",
      "OMISE_SECRET_KEY","PACKTOOK_PRODUCTION_PROJECT_ID")):raise ValueError("UNSAFE_ENV")
    if link.shell(["gcloud","config","get-value","project"])!=link.PROJECT:
        raise ValueError("GCLOUD_PROJECT_MISMATCH")
    key=link.shell(["gcloud","secrets","versions","access","1",
       "--secret=PACKTOOK_OMISE_TEST_SECRET_KEY","--project="+link.PROJECT])
    if not re.fullmatch(r"skey_test_[A-Za-z0-9_]+",key):raise ValueError("TEST_KEY_ONLY")
    auth=base64.b64encode((key+":").encode()).decode()
    charge=link.get_json("https://api.omise.co/charges/"+link.CHARGE,
      {"Authorization":"Basic "+auth,"Accept":"application/json"})
    uid,request=(charge.get("metadata") or {}).get("uid"),(charge.get("metadata") or {}).get("requestId")
    if (not isinstance(uid,str) or not link.UID.fullmatch(uid)
        or not isinstance(request,str) or not link.REQUEST.fullmatch(request)):
        raise ValueError("BAD_METADATA")
    token=link.shell(["gcloud","auth","print-access-token"])
    root="https://firestore.googleapis.com/v1/projects/"+link.PROJECT+"/databases/(default)/documents/accounts/"+urllib.parse.quote(uid,safe="")
    headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
    try:
        account=link.get_json(root,headers)
        bill=link.get_json(root+"/billingRequests/"+urllib.parse.quote(request,safe=""),headers)
        audits,complete=list_all_audits(root,headers,link.get_json)
    except urllib.error.HTTPError as error:
        if error.code==404:
            print("V4_PAID_BILLING_AUDIT: FIRESTORE_RECORD_NOT_FOUND")
            print("CLOUD_WRITES: 0")
            print("RELEASE: NO_GO_RELEASE")
            return
        raise
    print("OMISE_TEST_CHARGE_READ: PASS")
    print("V4_PAID_BILLING_AUDIT:",audit_result(charge,account,bill,audits,complete))
    print("AUDIT_LIST_COMPLETE:",complete)
    print("CLOUD_WRITES: 0")
    print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":
    try:main()
    except (ValueError,KeyError,subprocess.CalledProcessError,urllib.error.HTTPError,
        urllib.error.URLError,TimeoutError):
        raise SystemExit("V4_PAID_BILLING_AUDIT: BLOCKED")
