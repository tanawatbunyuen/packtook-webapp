#!/usr/bin/env python3
"""PACKTOOK V4: read-only Omise charge -> Staging Firestore billing linkage preflight.
Runs in operator Cloud Shell only. No provider writes, Firestore writes or deploy.
Never prints secrets, owner IDs, request IDs or raw response data.
"""
import base64
import json
import os
import re
import subprocess
import urllib.parse
import urllib.error
import urllib.request

PROJECT="packtook-staging"
CHARGE="chrg_test_69iy4us7mfk2o5p2qfu"
UID=re.compile(r"[A-Za-z0-9_-]{6,128}\Z")
REQUEST=re.compile(r"[A-Za-z0-9_-]{16,100}\Z")

def shell(args):
    return subprocess.check_output(args,stderr=subprocess.DEVNULL).decode().strip()

def get_json(url,headers,opener=urllib.request.urlopen):
    request=urllib.request.Request(url,headers=headers,method="GET")
    with opener(request,timeout=15) as response:
        if response.status!=200:raise ValueError("HTTP_NOT_200")
        payload=response.read(131073)
        if len(payload)>131072:raise ValueError("RESPONSE_TOO_LARGE")
    return json.loads(payload)

def fs_str(doc,key):
    return (doc.get("fields",{}).get(key) or {}).get("stringValue")

def fs_int(doc,key):
    item=doc.get("fields",{}).get(key) or {}
    n=item.get("integerValue")
    if not isinstance(n,str) or not re.fullmatch(r"-?\d+",n):return None
    return int(n)

def validate_link(charge,account,billing):
    if charge.get("id")!=CHARGE or charge.get("livemode") is not False:
        return "CHARGE_ID_OR_MODE_MISMATCH"
    if (charge.get("status")!="successful" or charge.get("paid") is not True
        or charge.get("amount")!=129000
        or str(charge.get("currency","")).lower()!="thb"):
        return "CHARGE_NOT_PAID_OR_AMOUNT_MISMATCH"
    md=charge.get("metadata") or {}
    uid,request=md.get("uid"),md.get("requestId")
    if not isinstance(uid,str) or not UID.fullmatch(uid):
        return "CHARGE_UID_INVALID"
    if not isinstance(request,str) or not REQUEST.fullmatch(request):
        return "CHARGE_REQUEST_INVALID"
    if fs_str(billing,"requestedBy")!=uid or fs_str(billing,"omiseChargeId")!=CHARGE:
        return "BILLING_OWNER_OR_CHARGE_MISMATCH"
    if fs_str(billing,"plan")!="Business" or fs_int(billing,"amountTHB")!=1290:
        return "BILLING_PLAN_OR_AMOUNT_MISMATCH"
    if fs_str(account,"openBillingRequestId")!=request:
        return "BILLING_LOCK_NOT_MATCHED"
    if (fs_int(account,"billingVersion") or 0)!=(fs_int(billing,"baseBillingVersion") or 0):
        return "BILLING_VERSION_MISMATCH"
    status=fs_str(billing,"status")
    if status=="paid":return "ALREADY_PAID_REQUIRES_AUDIT"
    if status!="payment_pending":return "BILLING_STATUS_NOT_READY"
    return "STAGING_BILLING_LINKAGE_MATCH"

def main():
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:raise ValueError("STAGING_REQUIRED")
    if any(os.environ.get(k) for k in ("OMISE_SECRET_KEY","FIREBASE_TOKEN",
             "GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID")):
        raise ValueError("UNSAFE_CREDENTIAL_ENVIRONMENT")
    if shell(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("GCLOUD_ACTIVE_PROJECT_MISMATCH")
    secret=shell(["gcloud","secrets","versions","access","1",
                  "--secret=PACKTOOK_OMISE_TEST_SECRET_KEY","--project="+PROJECT])
    if not re.fullmatch(r"skey_test_[A-Za-z0-9_]+",secret):raise ValueError("TEST_KEY_ONLY")
    authorization=base64.b64encode((secret+":").encode()).decode()
    charge=get_json("https://api.omise.co/charges/"+CHARGE,
                  {"Authorization":"Basic "+authorization,"Accept":"application/json"})
    md=charge.get("metadata") or {}
    uid,request=md.get("uid"),md.get("requestId")
    if (not isinstance(uid,str) or not UID.fullmatch(uid)
        or not isinstance(request,str) or not REQUEST.fullmatch(request)):
        raise ValueError("CHARGE_METADATA_INVALID")
    token=shell(["gcloud","auth","print-access-token"])
    if not token:raise ValueError("GCLOUD_AUTH_MISSING")
    root=("https://firestore.googleapis.com/v1/projects/"+PROJECT+
          "/databases/(default)/documents/accounts/"+urllib.parse.quote(uid,safe=""))
    headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
    try:
        account=get_json(root,headers)
        billing=get_json(root+"/billingRequests/"+urllib.parse.quote(request,safe=""),headers)
    except urllib.error.HTTPError as ex:
        if ex.code==404:
            print("STAGING_BILLING_LINKAGE: NOT_FOUND")
            print("CLOUD_WRITES: 0")
            print("RELEASE: NO_GO_RELEASE")
            return
        raise
    print("REAL_OMISE_TEST_CHARGE_READ: PASS")
    print("STAGING_BILLING_LINKAGE:",validate_link(charge,account,billing))
    print("CLOUD_WRITES: 0")
    print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":
    try:main()
    except (ValueError,KeyError,subprocess.CalledProcessError,urllib.error.HTTPError,
            urllib.error.URLError,TimeoutError,AssertionError):
        raise SystemExit("V4_STAGING_READ_ONLY_PREFLIGHT: BLOCKED")
