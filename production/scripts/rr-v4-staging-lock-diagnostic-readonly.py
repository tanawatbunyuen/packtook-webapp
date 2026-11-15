#!/usr/bin/env python3
"""V4 staging billing lock diagnostic. Strictly read-only; never logs PII or secrets.
Using the same trusted Omise and Firestore GET contracts as previous preflight.
"""
import base64
import importlib.util
import pathlib
import os
import re
import subprocess
import urllib.error
import urllib.parse

SOURCE=pathlib.Path(__file__).with_name("rr-v4-staging-billing-linkage-readonly.py")
spec=importlib.util.spec_from_file_location("v4_link",SOURCE)
link=importlib.util.module_from_spec(spec)
spec.loader.exec_module(link)
KNOWN={"paid","payment_pending","payment_review","creating_charge",
       "pending_payment_setup","failed","expired","cancelled"}

def assess(charge,account,billing,other=None):
    status=link.fs_str(billing,"status")
    lock=link.fs_str(account,"openBillingRequestId")
    req=charge.get("metadata",{}).get("requestId")
    # The verified API receipt and charge binding must be valid before lock analysis.
    if charge.get("id")!=link.CHARGE or charge.get("livemode") is not False:
        return ("PROVIDER_CHARGE_MISMATCH","NO_WRITE_MANUAL_REVIEW")
    if (charge.get("paid") is not True or charge.get("status")!="successful"
        or charge.get("amount")!=129000 or str(charge.get("currency","")).lower()!="thb"):
        return ("PROVIDER_PAYMENT_NOT_VERIFIED","NO_WRITE_MANUAL_REVIEW")
    if (not isinstance(req,str) or not link.REQUEST.fullmatch(req)
        or link.fs_str(billing,"requestedBy")!=charge.get("metadata",{}).get("uid")
        or link.fs_str(billing,"omiseChargeId")!=link.CHARGE
        or link.fs_str(billing,"plan")!="Business"
        or link.fs_int(billing,"amountTHB")!=1290):
        return ("BILLING_CHARGE_OWNER_OR_PLAN_MISMATCH","NO_WRITE_MANUAL_REVIEW")
    if status=="paid":
        return ("BILLING_REQUEST_ALREADY_COMPLETED","NO_WRITE_AUDIT_ONLY")
    if status=="payment_review":
        return ("BILLING_REQUEST_REQUIRES_REVIEW","NO_WRITE_MANUAL_REVIEW")
    if status not in KNOWN:
        return ("BILLING_STATUS_UNKNOWN","NO_WRITE_MANUAL_REVIEW")
    if lock is None or lock=="":
        return ("LOCK_MISSING","NO_WRITE_MANUAL_REVIEW")
    if not isinstance(lock,str) or not link.REQUEST.fullmatch(lock):
        return ("LOCK_INVALID","NO_WRITE_MANUAL_REVIEW")
    if lock!=req:
        if other is None:
            return ("LOCK_POINTS_TO_DIFFERENT_REQUEST","NO_WRITE_MANUAL_REVIEW")
        otherstatus=link.fs_str(other,"status")
        if otherstatus=="paid":return ("LOCK_POINTS_TO_COMPLETED_REQUEST","NO_WRITE_MANUAL_REVIEW")
        if otherstatus=="payment_review":return ("LOCK_POINTS_TO_REVIEW_REQUEST","NO_WRITE_MANUAL_REVIEW")
        if otherstatus in ("payment_pending","creating_charge","pending_payment_setup"):
            return ("LOCK_POINTS_TO_ACTIVE_REQUEST","NO_WRITE_MANUAL_REVIEW")
        return ("LOCK_POINTS_TO_OTHER_STATUS","NO_WRITE_MANUAL_REVIEW")
    if status!="payment_pending":
        return ("BILLING_STATUS_NOT_READY","NO_WRITE_MANUAL_REVIEW")
    if (link.fs_int(account,"billingVersion") or 0)!=(link.fs_int(billing,"baseBillingVersion") or 0):
        return ("BILLING_VERSION_MISMATCH","NO_WRITE_MANUAL_REVIEW")
    reserved=link.fs_int(account,"reserved")
    if reserved is None or reserved<0:
        return ("RESERVATION_COUNT_UNVERIFIED","NO_WRITE_MANUAL_REVIEW")
    if reserved>0:
        return ("PENDING_VIDEO_RESERVATIONS","NO_WRITE_MANUAL_REVIEW")
    return ("LOCK_AND_BILLING_EXPECTATIONS_MATCH","READ_ONLY_VERIFIED_NO_WRITE_AUTHORIZED")

def main():
    if os.environ.get("RR_STAGING_PROJECT_ID")!=link.PROJECT:
        raise ValueError("STAGING_REQUIRED")
    if any(os.environ.get(k) for k in
           ("GOOGLE_APPLICATION_CREDENTIALS","FIREBASE_TOKEN","OMISE_SECRET_KEY",
            "PACKTOOK_PRODUCTION_PROJECT_ID")):
        raise ValueError("UNSAFE_ENVIRONMENT")
    if link.shell(["gcloud","config","get-value","project"])!=link.PROJECT:
        raise ValueError("PROJECT_MISMATCH")
    key=link.shell(["gcloud","secrets","versions","access","1",
                    "--secret=PACKTOOK_OMISE_TEST_SECRET_KEY","--project="+link.PROJECT])
    if not re.fullmatch(r"skey_test_[A-Za-z0-9_]+",key):
        raise ValueError("TEST_SECRET_ONLY")
    auth=base64.b64encode((key+":").encode()).decode()
    charge=link.get_json("https://api.omise.co/charges/"+link.CHARGE,
          {"Authorization":"Basic "+auth,"Accept":"application/json"})
    md=charge.get("metadata") or {}
    uid,req=md.get("uid"),md.get("requestId")
    if (not isinstance(uid,str) or not link.UID.fullmatch(uid)
        or not isinstance(req,str) or not link.REQUEST.fullmatch(req)):
        raise ValueError("INVALID_METADATA")
    token=link.shell(["gcloud","auth","print-access-token"])
    root=("https://firestore.googleapis.com/v1/projects/"+link.PROJECT+
          "/databases/(default)/documents/accounts/"+urllib.parse.quote(uid,safe=""))
    headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
    try:
        account=link.get_json(root,headers)
        billing=link.get_json(root+"/billingRequests/"+
                              urllib.parse.quote(req,safe=""),headers)
    except urllib.error.HTTPError as error:
        if error.code==404:
            print("V4_BILLING_LOCK_DIAGNOSIS: ACCOUNT_OR_BILLING_NOT_FOUND")
            print("NEXT_ACTION: NO_WRITE_MANUAL_REVIEW")
            print("CLOUD_WRITES: 0")
            print("RELEASE: NO_GO_RELEASE")
            return
        raise
    lock=link.fs_str(account,"openBillingRequestId")
    other=None
    # Fetch no more than one alternate billing ticket, read-only.
    if isinstance(lock,str) and link.REQUEST.fullmatch(lock) and lock!=req:
        try:
            other=link.get_json(root+"/billingRequests/"+
                         urllib.parse.quote(lock,safe=""),headers)
        except urllib.error.HTTPError as error:
            if error.code!=404:raise
    result,action=assess(charge,account,billing,other)
    print("OMISE_TEST_CHARGE_READ: PASS")
    print("V4_BILLING_LOCK_DIAGNOSIS:",result)
    print("NEXT_ACTION:",action)
    print("CLOUD_WRITES: 0")
    print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":
    try:main()
    except (ValueError,KeyError,subprocess.CalledProcessError,
            urllib.error.HTTPError,urllib.error.URLError,TimeoutError):
        raise SystemExit("V4_BILLING_LOCK_DIAGNOSTIC: BLOCKED")
