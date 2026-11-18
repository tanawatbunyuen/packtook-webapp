#!/usr/bin/env python3
"""P79 strictly read-only Staging Functions metadata stability preflight.

No source archives, IAM policy dumps, tokens, service principal identities,
environment values, secrets, or source identifiers printed. No writes.
Requires explicit --inspect and the active gcloud project to be Staging.
"""
import argparse
import json
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
TARGETS=("recordingStatus","usageStatus","reserveCredit","finalizeCredit",
         "recoverStaleVideoReservation")

def invoke(command):
    result=subprocess.run(command,check=False,stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE,text=True,timeout=35)
    if result.returncode!=0:raise RuntimeError("READ_ONLY_COMMAND_FAILED")
    if len(result.stdout)>150000:raise ValueError("RESPONSE_TOO_LARGE")
    return result.stdout.strip()

def summarize(data):
    if not isinstance(data,dict):raise ValueError("BAD_METADATA")
    build=data.get("buildConfig") or {}
    service=data.get("serviceConfig") or {}
    event=data.get("eventTrigger")
    if not isinstance(build,dict) or not isinstance(service,dict):
        raise ValueError("BAD_METADATA_STRUCTURE")
    # Keep identifiers in-memory for equality only. Never print hashes,
    # storage locations, build IDs, principals or sensitive metadata.
    pinned=build.get("source") or build.get("build") or None
    identity=service.get("serviceAccountEmail") or None
    return {
        "state":data.get("state"),
        "environment":data.get("environment"),
        "updateTime":data.get("updateTime"),
        "source":pinned,
        "identity":identity,
        "revision":service.get("revision") or service.get("revisionName"),
        "ingress":service.get("ingressSettings"),
        "availableMemory":service.get("availableMemory"),
        "timeoutSeconds":service.get("timeoutSeconds"),
        "minInstanceCount":service.get("minInstanceCount"),
        "maxInstanceCount":service.get("maxInstanceCount"),
        "eventTriggerPresent":bool(event)
    }

def classify(left,right):
    if not left or not right:return "NOT_VERIFIABLE"
    fields=("state","environment","updateTime","source","identity",
            "revision","ingress","availableMemory","timeoutSeconds",
            "minInstanceCount","maxInstanceCount","eventTriggerPresent")
    if any(left.get(k)!=right.get(k) for k in fields):
        return "DRIFT_REVIEW_REQUIRED"
    if left.get("state")!="ACTIVE" or left.get("environment")!="GEN_2":
        return "NOT_ACTIVE_OR_NOT_GEN2"
    if not left.get("identity") or not left.get("source"):
        return "METADATA_INCOMPLETE"
    return "STABLE_METADATA_ONLY"

def inspect(read=invoke):
    if read(["gcloud","config","get-value","project"])!=PROJECT:
        return {"project":"WRONG_ACTIVE_PROJECT","checks":[]}
    before={}
    after={}
    for name in TARGETS:
        raw=read(["gcloud","functions","describe",name,"--gen2",
                  "--region",REGION,"--project",PROJECT,"--format=json"])
        before[name]=summarize(json.loads(raw))
    for name in TARGETS:
        raw=read(["gcloud","functions","describe",name,"--gen2",
                  "--region",REGION,"--project",PROJECT,"--format=json"])
        after[name]=summarize(json.loads(raw))
    return {"project":"STAGING_CONFIRMED","checks":[{
       "name":name,
       "state":classify(before[name],after[name]),
       "identity_present":bool(before[name].get("identity")),
       "source_metadata_present":bool(before[name].get("source")),
       "revision_metadata_present":bool(before[name].get("revision")),
       "app_check":"NOT_PROVEN",
       "guarded_call":"NOT_VERIFIED",
       "least_privilege_iam":"NOT_VERIFIED"} for name in TARGETS]}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect",action="store_true")
    args=parser.parse_args()
    if not args.inspect:
        print("P79_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        result=inspect()
        if result["project"]!="STAGING_CONFIRMED":
            print("P79_PROJECT_GUARD=BLOCKED")
            return 2
        print("P79_PROJECT_GUARD=PASS_STAGING_ONLY")
        for row in result["checks"]:
            print("FUNCTION="+row["name"])
            print("  REVISION_STABILITY="+row["state"])
            print("  RUNTIME_IDENTITY_PRESENT="+("YES" if row["identity_present"] else "NO"))
            print("  SOURCE_METADATA_PRESENT="+("YES" if row["source_metadata_present"] else "NO"))
            print("  REVISION_METADATA_PRESENT="+("YES" if row["revision_metadata_present"] else "NO"))
            print("  APP_CHECK=NOT_PROVEN")
            print("  GUARDED_CALL=NOT_VERIFIED")
            print("  IAM_LEAST_PRIVILEGE=NOT_VERIFIED")
        status=all(row["state"]=="STABLE_METADATA_ONLY" for row in result["checks"])
        print("P79_SCOPED_STABILITY="+("STABLE_METADATA_ONLY" if status else "REVIEW_REQUIRED"))
        return 0 if status else 2
    except (OSError,RuntimeError,ValueError,TypeError,KeyError,
            subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P79_STAGING_METADATA=NOT_VERIFIABLE")
        return 2
    finally:
        print("P79_CLOUD_WRITES=0")
        print("P79_DEPLOY=0")
        print("P79_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
