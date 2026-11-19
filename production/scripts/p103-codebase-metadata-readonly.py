#!/usr/bin/env python3
"""P103: read-only five-function Codebase label provenance.

Only project packtook-staging, Gen2, asia-southeast1. Does not print
service or function resource names, secrets, email, URL, hashes or raw
gcloud stderr. No IAM changes / deployments. P102 observed 27
functions, zero status-prefix collisions, partially/absent labels.
"""
import argparse
import json
import re
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
STATUS=("recordingStatus","usageStatus")
CREDIT=("reserveCredit","finalizeCredit","recoverStaleVideoReservation")
TARGETS=STATUS+CREDIT
BASE=f"projects/{PROJECT}/locations/{REGION}/functions/"
CODEBASE_LABEL="firebase-functions-codebase"
VALID=re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,127}$")

def cli(args):
    try:
        done=subprocess.run(args,capture_output=True,text=True,timeout=12,check=False)
    except subprocess.TimeoutExpired:raise ValueError("P103_TIMEOUT") from None
    if done.returncode!=0 or len(done.stdout)>150000:
        raise ValueError("P103_METADATA_UNAVAILABLE")
    return done.stdout.strip()

def codebase(function,raw):
    data=json.loads(raw)
    if not isinstance(data,dict) or data.get("name")!=BASE+function:
        raise ValueError("P103_OUT_OF_SCOPE_METADATA")
    if data.get("environment") not in ("GEN_2","GEN_2.0"):
        raise ValueError("P103_NOT_GEN2")
    labels=data.get("labels") or {}
    if not isinstance(labels,dict):raise ValueError("P103_INVALID_LABELS")
    value=labels.get(CODEBASE_LABEL)
    if value is None:return "ABSENT"
    if not isinstance(value,str) or len(value)>100:return "INVALID"
    if value!="beta":return "CONFLICT"
    return "BETA"

def inspect(reader=cli,progress=lambda _:None):
    progress("P103_STEP=PROJECT_GUARD")
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P103_WRONG_ACTIVE_PROJECT")
    values=[]
    for i,n in enumerate(TARGETS,1):
        progress(f"P103_STEP=FUNCTION_METADATA_{i}_OF_5")
        args=["gcloud","functions","describe",n,"--gen2","--region",REGION,
              "--project",PROJECT,"--format=json"]
        values.append(codebase(n,reader(args)))
    beta=values.count("BETA")
    absent=values.count("ABSENT")
    conflict=values.count("CONFLICT")
    invalid=values.count("INVALID")
    if invalid:kind="INVALID_LABELS"
    elif conflict:kind="CONFLICTING_LABELS"
    elif beta==5:kind="ALL_FIVE_BETA_LABELS"
    elif absent==5:kind="ALL_FIVE_LABELS_ABSENT"
    else:kind="PARTIAL_BETA_LABELS"
    return {"statusBeta":values[:2].count("BETA"),
            "creditBeta":values[2:].count("BETA"),
            "absent":absent,"conflict":conflict,"invalid":invalid,"result":kind}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    arg=p.parse_args()
    if not arg.inspect:
        print("P103_EXPLICIT_OPERATOR_OPT_IN_REQUIRED");return 2
    try:
        row=inspect(progress=lambda msg:print(msg,flush=True))
        print("P103_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("P103_STATUS_BETA_LABEL_COUNT="+str(row["statusBeta"]))
        print("P103_CREDIT_BETA_LABEL_COUNT="+str(row["creditBeta"]))
        print("P103_ABSENT_LABEL_COUNT="+str(row["absent"]))
        print("P103_CONFLICTING_LABEL_COUNT="+str(row["conflict"]))
        print("P103_CODEBASE_LABEL_EVIDENCE="+row["result"])
        print("P103_DEPLOYED_CODEBASE_OWNERSHIP="+(
            "LABEL_EVIDENCE_ONLY" if row["result"]=="ALL_FIVE_BETA_LABELS" else "NOT_VERIFIED"))
        print("P103_CLI_DEPLOY_PLAN=NOT_EXECUTED")
        print("P103_IMAGE_RESTORABILITY=NOT_VERIFIED")
        print("P103_LEGACY_ACCOUNT_PARITY=NOT_EQUIVALENT")
        return 0 if row["result"]=="ALL_FIVE_BETA_LABELS" else 2
    except (OSError,ValueError,TypeError,KeyError,json.JSONDecodeError):
        print("P103_CODEBASE_METADATA=NOT_VERIFIABLE")
        return 2
    finally:
        print("P103_CLOUD_WRITES=0")
        print("P103_IAM_CHANGES=0")
        print("P103_DEPLOY=0")
        print("P103_TRAFFIC_CHANGES=0")
        print("P103_RELEASE=NO_GO_RELEASE")
if __name__=="__main__":
    sys.exit(main())
