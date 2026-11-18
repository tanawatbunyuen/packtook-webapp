#!/usr/bin/env python3
"""P93C staging-only read-only diagnosis after P93B registry-stage failure.

One status Function and CURRENT revision, max 5 sequential gcloud requests.
Each command <=12s, bounded stdout/stderr, with classified non-secret
error reasons. Does NOT list IAM, elevate permissions, pull an image,
read a source archive, select a rollback revision, deploy or change traffic.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
FUNCTIONS=("recordingStatus","usageStatus")
HERE=Path(__file__).resolve().parent
DIGEST=re.compile(r"^sha256:[0-9a-fA-F]{64}$")

def load_p93b():
    s=importlib.util.spec_from_file_location("p93c_p93b",HERE/"p93b-cloud-shell-safe-readonly.py")
    obj=importlib.util.module_from_spec(s);s.loader.exec_module(obj)
    return obj

class ReadFailure(ValueError):
    def __init__(self,reason):super().__init__(reason)
def read(argv):
    try:
        p=subprocess.run(argv,text=True,capture_output=True,timeout=12,check=False)
    except subprocess.TimeoutExpired:
        raise ReadFailure("COMMAND_TIMEOUT") from None
    except (OSError,UnicodeError):
        raise ReadFailure("COMMAND_UNAVAILABLE") from None
    if len(p.stdout)>100000 or len(p.stderr)>8000:
        raise ReadFailure("OUTPUT_BOUNDS_EXCEEDED")
    if p.returncode!=0:
        # Interpret error class in RAM; do not emit stderr or user/account IDs.
        msg=p.stderr.lower()
        if any(term in msg for term in ("permission_denied","permission denied","does not have permission","403","unauthorized","authentication required","not authenticated")):
            reason="REGISTRY_ACCESS_DENIED"
        elif any(term in msg for term in ("not_found","not found","404","does not exist")):
            reason="IMAGE_OR_REPOSITORY_NOT_FOUND"
        elif any(term in msg for term in ("unrecognized arguments","invalid choice","invalid argument")):
            reason="CLI_ARGUMENT_UNSUPPORTED"
        else:
            reason="REGISTRY_COMMAND_FAILED_UNCLASSIFIED"
        raise ReadFailure(reason)
    return p.stdout.strip()

def registry_check(image,reader):
    p93b=load_p93b()
    wanted=p93b.image_pin(image)
    if wanted is None:
        return "IMAGE_REFERENCE_OUTSIDE_STAGING_ALLOWLIST"
    # Google documents this scalar field; no JSON schema dependency.
    raw=reader(["gcloud","artifacts","docker","images","describe",image,
                "--project",PROJECT,"--format=value(image_summary.digest)"])
    value=raw.strip().lower()
    if value=="sha256:"+wanted:return "DIGEST_METADATA_MATCHED_ONLY"
    if not value or value in ("(unset)","none","null"):return "DIGEST_FIELD_NOT_RETURNED"
    if DIGEST.fullmatch(value):return "DIGEST_MISMATCH"
    return "DIGEST_RESPONSE_FORMAT_UNRECOGNIZED"

def inspect(function,reader=read,progress=lambda _:None):
    if function not in FUNCTIONS:raise ValueError("FUNCTION_OUT_OF_SCOPE")
    p93b=load_p93b()
    progress("P93C_STEP=PROJECT_GUARD")
    # Per-command failures here do not imply registry error.
    try: active=reader(["gcloud","config","get-value","project"])
    except ReadFailure:raise ValueError("PROJECT_QUERY_FAILED") from None
    if active!=PROJECT:raise ValueError("WRONG_ACTIVE_PROJECT")
    describe=["gcloud","functions","describe",function,"--gen2",
              "--project",PROJECT,"--region",REGION,"--format=json"]
    progress("P93C_STEP=FUNCTION_METADATA")
    try: first=reader(describe)
    except ReadFailure:raise ValueError("FUNCTION_METADATA_UNAVAILABLE") from None
    service,revision=p93b.function_revision(json.loads(first),function)
    progress("P93C_STEP=CURRENT_REVISION")
    try:
        revision_raw=reader(["gcloud","run","revisions","describe",revision,
                             "--project",PROJECT,"--region",REGION,"--format=json"])
    except ReadFailure:raise ValueError("REVISION_METADATA_UNAVAILABLE") from None
    image=p93b.revision_image(json.loads(revision_raw),revision)
    progress("P93C_STEP=REGISTRY_CLASSIFICATION")
    try: result=registry_check(image,reader)
    except ReadFailure as failure:result=str(failure)
    progress("P93C_STEP=STABILITY_CHECK")
    try: second=reader(describe)
    except ReadFailure:raise ValueError("FUNCTION_RECHECK_UNAVAILABLE") from None
    return {"function":function,"result":result,"stable":first==second}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-current",action="store_true")
    parser.add_argument("--function",choices=FUNCTIONS)
    args=parser.parse_args()
    if not args.inspect_current or not args.function:
        print("P93C_OPT_IN_REQUIRED")
        return 2
    try:
        row=inspect(args.function,progress=lambda x:print(x,flush=True))
        print("P93C_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("FUNCTION="+row["function"])
        print("P93C_METADATA_STABLE="+("YES" if row["stable"] else "NO"))
        print("P93C_REGISTRY_RESULT="+row["result"])
        print("P93C_REGISTRY_ACCESS_PROVEN="+("METADATA_ONLY" if row["result"]=="DIGEST_METADATA_MATCHED_ONLY" else "NO"))
        print("P93C_IMAGE_PULLABILITY=NOT_VERIFIED")
        print("P93C_PREVIOUS_GOOD_REVISION=NOT_SELECTED")
        print("P93C_ROLLBACK_RESTORABLE=NOT_VERIFIED")
        return 0 if row["stable"] and row["result"]=="DIGEST_METADATA_MATCHED_ONLY" else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P93C_REGISTRY_RESULT=PRE_REGISTRY_METADATA_NOT_VERIFIABLE")
        return 2
    finally:
        print("P93C_CLOUD_WRITES=0")
        print("P93C_DEPLOY=0")
        print("P93C_TRAFFIC_CHANGES=0")
        print("P93C_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
