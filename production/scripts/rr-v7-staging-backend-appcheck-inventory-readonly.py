#!/usr/bin/env python3
"""V7 read-only deployed Cloud Functions inventory, Staging only.
Queries only specifically named callables. Does not print URI, env, service
accounts, secrets, build source, function labels, or customer data.

WARNING: gcloud describe does NOT attest Firebase callable enforceAppCheck.
Deployment generation/revision and state are only operational evidence.
"""
import json
import os
import pathlib
import re
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
FUNCTIONS=("reserveCredit","finalizeCredit","recordingStatus",
           "recoverStaleVideoReservation","usageStatus")
def source_policy(text):
    code=re.sub(r"/\*.*?\*/|//[^\n]*","",text,flags=re.S)
    m=re.search(r"\bconst\s+options\s*=\s*\{([^}]*)\}",code)
    if not m:return "UNKNOWN"
    options=m.group(1)
    if re.search(r"\benforceAppCheck\s*:\s*true\b",options):
        return "ENFORCEMENT_DECLARED_IN_SOURCE"
    if re.search(r"\benforceAppCheck\s*:\s*false\b",options):
        return "ENFORCEMENT_DISABLED_IN_SOURCE"
    return "NO_GLOBAL_ENFORCEMENT_DECLARATION"

def describe(name,runner=subprocess.run):
    args=["gcloud","functions","describe",name,
          "--gen2","--project="+PROJECT,"--region="+REGION,"--format=json"]
    result=runner(args,capture_output=True,text=True,timeout=30,check=False)
    if result.returncode:
        # Do not print gcloud stderr, which can disclose infrastructure metadata.
        return "DESCRIBE_FAILED",None
    try:
        data=json.loads(result.stdout)
        if not isinstance(data,dict):return "INVALID_METADATA",None
        return "FOUND",data
    except (json.JSONDecodeError,TypeError):
        return "INVALID_METADATA",None

def classify(data):
    if data is None:return "UNKNOWN"
    state=data.get("state")
    if state=="ACTIVE":return "ACTIVE"
    if state in ("FAILED","DEPLOYING","DELETING","UNKNOWN","UNSPECIFIED"):
        return "NOT_ACTIVE"
    return "STATE_UNVERIFIED"

def guard():
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:
        raise ValueError("STAGING_PROJECT_ENV_REQUIRED")
    if any(os.environ.get(x) for x in ("OMISE_SECRET_KEY","FIREBASE_TOKEN",
          "GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID")):
        raise ValueError("CREDENTIAL_OR_PRODUCTION_ENV_BLOCKED")
    result=subprocess.run(
       ["gcloud","config","get-value","project"],
       capture_output=True,text=True,timeout=10,check=False)
    if result.returncode or result.stdout.strip()!=PROJECT:
        raise ValueError("GCLOUD_ACTIVE_PROJECT_MISMATCH")

def run():
    successful=0
    try:
        guard()
        root=pathlib.Path(__file__).resolve().parents[2]
        policy=source_policy((root/"functions"/"index.js").read_text(encoding="utf-8"))
        print("REVIEW_BRANCH_APP_CHECK_SOURCE_POLICY:",policy)
        for name in FUNCTIONS:
            try:result,info=describe(name)
            except (OSError,subprocess.TimeoutExpired):result,info="DESCRIBE_FAILED",None
            print("FUNCTION:",name)
            print("GEN2_DESCRIBE:",result)
            print("DEPLOYED_STATE:",classify(info))
            # Only return timestamp and generation evidence; never raw metadata.
            if info:
                stamp=info.get("updateTime")
                print("UPDATE_TIME_PRESENT:","YES" if isinstance(stamp,str) and stamp else "NO")
                print("BUILD_CONFIG_PRESENT:","YES" if isinstance(info.get("buildConfig"),dict) else "NO")
            if result=="FOUND" and classify(info)=="ACTIVE":successful+=1
        print("FUNCTIONS_ACTIVE_COUNT:",str(successful)+"/"+str(len(FUNCTIONS)))
        print("DEPLOYED_APP_CHECK_ENFORCEMENT: NOT_OBSERVABLE_FROM_GCLOUD_DESCRIBE")
        print("DEPLOYED_SOURCE_EQUALS_REVIEW_BRANCH: NOT_VERIFIED")
        print("APP_CHECK_VALID_TOKEN_RUNTIME_TEST: NOT_PERFORMED")
        print("V7_BACKEND_PREFLIGHT:","INVENTORY_COMPLETE_REVIEW_REQUIRED" if successful==len(FUNCTIONS) else "BLOCKED_FUNCTION_INVENTORY")
    except (OSError,ValueError,subprocess.TimeoutExpired):
        print("V7_BACKEND_PREFLIGHT: BLOCKED_ENVIRONMENT")
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":run()
