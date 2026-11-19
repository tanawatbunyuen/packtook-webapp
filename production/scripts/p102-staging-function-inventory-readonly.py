#!/usr/bin/env python3
"""P102 bounded read-only Staging function inventory & prefix-collision check.

Reads Gen2 Cloud Functions list twice and prints only aggregate scope
evidence. Never prints names of unrelated functions, labels, URLs, IDs,
secrets or raw CLI errors. Zero IAM changes, deployments, traffic changes.
"""
import argparse
import json
import re
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
TARGETS=("recordingStatus","usageStatus")
CREDITS=("reserveCredit","finalizeCredit","recoverStaleVideoReservation")
MAX_COUNT=999
ID=re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,127}$")
RESOURCE=f"projects/{PROJECT}/locations/{REGION}/functions/"

def cli(argv):
    p=subprocess.run(argv,capture_output=True,text=True,check=False,timeout=18)
    if p.returncode!=0 or len(p.stdout)>750000:
        raise ValueError("P102_READONLY_COMMAND_UNAVAILABLE")
    return p.stdout.strip()

def parse(raw):
    obj=json.loads(raw)
    if not isinstance(obj,list) or not obj or len(obj)>MAX_COUNT:
        raise ValueError("P102_EMPTY_OR_OVERSIZE_FUNCTION_LIST")
    names=set()
    entries=[]
    for item in obj:
        if not isinstance(item,dict):
            raise ValueError("P102_BAD_FUNCTION")
        resource=item.get("name")
        if not isinstance(resource,str) or not resource.startswith(RESOURCE):
            raise ValueError("P102_OUT_OF_SCOPE_FUNCTION")
        name=resource[len(RESOURCE):]
        if not ID.fullmatch(name) or name in names:
            raise ValueError("P102_DUPLICATE_OR_BAD_NAME")
        names.add(name)
        labels=item.get("labels")
        if labels is None:labels={}
        if not isinstance(labels,dict):raise ValueError("P102_BAD_LABELS")
        # Codebase label names are not presumed stable or required.
        codebase=labels.get("firebase-functions-codebase")
        if codebase is not None and (not isinstance(codebase,str) or len(codebase)>80):
            raise ValueError("P102_INVALID_CODEBASE_LABEL")
        entries.append((name,codebase))
    if not all(n in names for n in TARGETS):
        raise ValueError("P102_TARGET_MISSING")
    if not all(n in names for n in CREDITS):
        raise ValueError("P102_CREDIT_INVENTORY_INCOMPLETE")
    collision=sorted(n for n in names
       if n not in TARGETS and any(n.startswith(t+"-") for t in TARGETS))
    status_codebases=[codebase for name,codebase in entries if name in TARGETS]
    credit_codebases=[codebase for name,codebase in entries if name in CREDITS]
    if any(c not in (None,"beta") for c in status_codebases+credit_codebases):
        codebase_state="CONFLICTING_LABELS"
    elif all(c=="beta" for c in status_codebases+credit_codebases):
        codebase_state="BETA_LABELS_OBSERVED_FOR_ALL_FIVE"
    else:
        codebase_state="PARTIAL_OR_ABSENT_LABELS"
    return {
        "names":names,
        "count":len(entries),
        "collisionCount":len(collision),
        "codebaseState":codebase_state,
        "statusCount":len(TARGETS),
        "creditCount":len(CREDITS)
    }

def inspect(read=cli):
    if read(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P102_WRONG_ACTIVE_PROJECT")
    cmd=["gcloud","functions","list","--v2",
         "--regions="+REGION,"--project="+PROJECT,
         "--format=json","--limit=1000"]
    first=parse(read(cmd))
    second=parse(read(cmd))
    stable=first["names"]==second["names"] and first["codebaseState"]==second["codebaseState"]
    return {k:v for k,v in second.items() if k!="names"} | {"stable":stable}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect",action="store_true")
    args=parser.parse_args()
    if not args.inspect:
        print("P102_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        report=inspect()
        print("P102_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("P102_FUNCTION_LIST_STABLE="+("YES" if report["stable"] else "NO"))
        print("P102_VISIBLE_GEN2_FUNCTIONS="+str(report["count"]))
        print("P102_STATUS_FUNCTIONS_PRESENT="+str(report["statusCount"]))
        print("P102_CREDIT_FUNCTIONS_PRESENT="+str(report["creditCount"]))
        print("P102_PREFIX_COLLISIONS="+str(report["collisionCount"]))
        print("P102_CODEBASE_LABEL_EVIDENCE="+report["codebaseState"])
        print("P102_DEPLOYED_SOURCE_PARITY=NOT_VERIFIED")
        print("P102_CLI_FULL_DEPLOY_PLAN=NOT_EXECUTED")
        print("P102_DELETION_PLAN=NOT_VERIFIED")
        print("P102_LEGACY_ACCOUNT_PARITY=NOT_EQUIVALENT")
        print("P102_DEPLOY=BLOCKED")
        return 0 if report["stable"] and report["collisionCount"]==0 and report["codebaseState"]!="CONFLICTING_LABELS" else 2
    except (ValueError,OSError,TypeError,json.JSONDecodeError,subprocess.TimeoutExpired):
        print("P102_STAGING_INVENTORY=NOT_VERIFIABLE")
        return 2
    finally:
        print("P102_CLOUD_WRITES=0")
        print("P102_IAM_CHANGES=0")
        print("P102_TRAFFIC_CHANGES=0")
        print("P102_RELEASE=NO_GO_RELEASE")
if __name__=="__main__":
    sys.exit(main())
