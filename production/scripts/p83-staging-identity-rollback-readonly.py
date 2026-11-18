#!/usr/bin/env python3
"""P83 Staging-only, read-only Functions identity and rollback metadata inventory.

Never prints service account emails, source bucket/object/generation, resource URLs,
project numeric ID, IAM policy/member data, secrets or environment variables.
Does not establish least-privilege IAM or actual rollback ability.
"""
import argparse
import json
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
TARGETS=("recordingStatus","usageStatus","reserveCredit","finalizeCredit",
         "recoverStaleVideoReservation")
STATUS_TARGETS=("recordingStatus","usageStatus")
CREDIT_TARGETS=("reserveCredit","finalizeCredit","recoverStaleVideoReservation")

def query(command):
    result=subprocess.run(command,capture_output=True,text=True,timeout=30,check=False)
    if result.returncode:raise RuntimeError("P83_READ_ONLY_QUERY_FAILED")
    if len(result.stdout)>150000:raise ValueError("P83_METADATA_TOO_LARGE")
    return result.stdout.strip()

def minimal(info):
    if not isinstance(info,dict) or info.get("environment")!="GEN_2" or info.get("state")!="ACTIVE":
        raise ValueError("P83_NOT_ACTIVE_GEN2")
    config=info.get("serviceConfig")
    build=info.get("buildConfig")
    if not isinstance(config,dict) or not isinstance(build,dict):
        raise ValueError("P83_INCOMPLETE_CONFIG")
    src=build.get("source") or {}
    storage=src.get("storageSource") if isinstance(src,dict) else None
    source_pinned=isinstance(storage,dict) and all(
        isinstance(storage.get(k),str) and bool(storage[k]) for k in ("bucket","object","generation")
    )
    labels=info.get("labels") or {}
    if not isinstance(labels,dict):raise ValueError("P83_BAD_LABELS")
    codebase=labels.get("deployment-codebase") or labels.get("firebase-functions-codebase")
    # Do not trust weak labels as proof that the SDK knows deployment ownership.
    codebase_present=isinstance(codebase,str) and bool(codebase.strip())
    identity=config.get("serviceAccountEmail")
    revision=config.get("revision") or config.get("revisionName")
    return {
      "identity":identity if isinstance(identity,str) and identity else None,
      "source":storage if source_pinned else None,
      "updateTime":info.get("updateTime"),
      "revision":revision if isinstance(revision,str) and revision else None,
      "codebase":codebase if codebase_present else None,
      "ingress":config.get("ingressSettings"),
      "environment":info.get("environment"),
      "state":info.get("state"),
      "availableMemory":config.get("availableMemory"),
      "timeoutSeconds":config.get("timeoutSeconds")
    }

def classify(first,second):
    fields=("identity","source","updateTime","revision","codebase","ingress",
            "environment","state","availableMemory","timeoutSeconds")
    if not first or not second:return "NOT_VERIFIABLE"
    if any(first.get(k)!=second.get(k) for k in fields):return "METADATA_DRIFT"
    if not first.get("identity") or not first.get("source"):return "INSUFFICIENT_SOURCE_IDENTITY"
    return "STABLE_METADATA_ONLY"

def inspect(read=query):
    if read(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P83_WRONG_ACTIVE_PROJECT")
    first={}
    second={}
    for name in TARGETS:
        raw=read(["gcloud","functions","describe",name,"--gen2",
                  "--region",REGION,"--project",PROJECT,"--format=json"])
        first[name]=minimal(json.loads(raw))
    for name in TARGETS:
        raw=read(["gcloud","functions","describe",name,"--gen2",
                  "--region",REGION,"--project",PROJECT,"--format=json"])
        second[name]=minimal(json.loads(raw))
    rows=[]
    for name in TARGETS:
        a=first[name]
        rows.append({
          "name":name,"metadata":classify(a,second[name]),
          "runtime_identity_present":bool(a["identity"]),
          "source_generation_pinned":bool(a["source"]),
          "revision_present":bool(a["revision"]),
          "codebase_label_present":bool(a["codebase"]),
          "codebase_ownership":"NOT_VERIFIED",
          "rollback_restorable":"NOT_VERIFIED",
          "least_privilege_iam":"NOT_VERIFIED",
          "backend_app_check":"NOT_PROVEN"
        })
    # Compare equality only, never disclose accounts. Shared identities
    # are a review signal, not an assertion of excessive privileges.
    identities=[first[n]["identity"] for n in TARGETS]
    shared=len(set(identities))<len(identities)
    return {"rows":rows,"shared_runtime_identity":shared,
            "staging_deploy":"BLOCKED","release":"NO_GO_RELEASE"}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    flags=p.parse_args()
    if not flags.inspect:
        print("P83_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        result=inspect()
        print("P83_PROJECT_GUARD=PASS_STAGING_ONLY")
        for row in result["rows"]:
            print("FUNCTION="+row["name"])
            for k in ("metadata","runtime_identity_present","source_generation_pinned",
                      "revision_present","codebase_label_present",
                      "codebase_ownership","rollback_restorable",
                      "least_privilege_iam","backend_app_check"):
                v=row[k]
                print("  "+k.upper()+"="+("YES" if v is True else "NO" if v is False else str(v)))
        print("P83_RUNTIME_IDENTITIES_SHARED="+("YES" if result["shared_runtime_identity"] else "NO"))
        print("P83_CODEBASE_MAPPING=NOT_VERIFIED")
        print("P83_IMMUTABLE_ROLLBACK=NOT_VERIFIED")
        print("P83_STAGING_DEPLOY=BLOCKED")
        return 0 if all(r["metadata"]=="STABLE_METADATA_ONLY" for r in result["rows"]) else 2
    except (OSError,ValueError,RuntimeError,TypeError,KeyError,
            subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P83_EVIDENCE=NOT_VERIFIABLE")
        return 2
    finally:
        print("P83_CLOUD_WRITES=0")
        print("P83_IAM_WRITES=0")
        print("P83_DEPLOY=0")
        print("P83_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
