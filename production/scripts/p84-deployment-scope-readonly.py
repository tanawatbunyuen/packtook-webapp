#!/usr/bin/env python3
"""P84 owner-run, Staging-only read-only deployment-scope / rollback preflight.

Read-only Cloud Functions v2 describe calls, two snapshots of five names.
Does not list or modify IAM, read secrets, download source archives, or deploy.
Prints ONLY bounded state categories; never prints identity/email, source
bucket/object/generation, revision name, URLs or project numeric identifier.
"""
import argparse
import json
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
STATUS=("recordingStatus","usageStatus")
CREDIT=("reserveCredit","finalizeCredit","recoverStaleVideoReservation")
TARGETS=STATUS+CREDIT

def invoke(args):
    result=subprocess.run(args,text=True,capture_output=True,timeout=35,check=False)
    if result.returncode!=0 or len(result.stdout)>160000:
        raise ValueError("P84_METADATA_UNAVAILABLE")
    return result.stdout.strip()

def summary(obj):
    if not isinstance(obj,dict) or obj.get("environment")!="GEN_2" or obj.get("state")!="ACTIVE":
        raise ValueError("P84_NOT_ACTIVE_GEN2")
    service=obj.get("serviceConfig") or {}
    build=obj.get("buildConfig") or {}
    if not isinstance(service,dict) or not isinstance(build,dict):
        raise ValueError("P84_BAD_SCHEMA")
    source=build.get("source")
    storage=source.get("storageSource") if isinstance(source,dict) else None
    if not isinstance(storage,dict):storage={}
    pin=tuple(storage.get(k) for k in ("bucket","object","generation"))
    if not all(isinstance(x,str) and bool(x) for x in pin):
        pin=None
    identity=service.get("serviceAccountEmail")
    if not isinstance(identity,str) or not identity:identity=None
    revision=service.get("revision") or service.get("revisionName")
    if not isinstance(revision,str) or not revision:revision=None
    labels=obj.get("labels") or {}
    if not isinstance(labels,dict):raise ValueError("P84_LABEL_SCHEMA")
    codebase=labels.get("deployment-codebase") or labels.get("firebase-functions-codebase")
    if not isinstance(codebase,str) or not codebase:codebase=None
    # A label is not independently verified Firebase CLI deployment ownership.
    return {"identity":identity,"sourcePin":pin,"revision":revision,
      "codebase":codebase,"updateTime":obj.get("updateTime"),
      "ingress":service.get("ingressSettings"),
      "memory":service.get("availableMemory"),
      "timeout":service.get("timeoutSeconds"),
      "minInstances":service.get("minInstanceCount"),
      "maxInstances":service.get("maxInstanceCount"),
      "environment":obj.get("environment"),"state":obj.get("state")}

def compare(first,second):
    if not first or not second:return "NOT_VERIFIABLE"
    if first!=second:return "DRIFT_REVIEW_REQUIRED"
    if not first.get("sourcePin") or not first.get("identity") or not first.get("revision"):
        return "MISSING_REQUIRED_METADATA"
    return "STABLE_METADATA_ONLY"

def evaluate(before,after):
    if set(before)!=set(TARGETS) or set(after)!=set(TARGETS):
        raise ValueError("P84_INCOMPLETE_TARGET_SET")
    rows=[]
    for name in TARGETS:
        a,b=before[name],after[name]
        rows.append({"name":name,
          "role":"REMEDIATION_TARGET" if name in STATUS else "EXCLUDED_CREDIT_FUNCTION",
          "stability":compare(a,b),
          "sourceGenerationPresent":bool(a.get("sourcePin")),
          "rollbackRevisionPresent":bool(a.get("revision")),
          "runtimeIdentityPresent":bool(a.get("identity")),
          "codebaseLabelPresent":bool(a.get("codebase"))})
    baseline_shared=len(set(before[n].get("identity") for n in TARGETS))<len(TARGETS)
    # Identical source pin is an observational signal only; it does NOT
    # prove functions share deployable codebase, CLI selector or rollback.
    source_pin_groups={}
    for name in TARGETS:
        pin=before[name].get("sourcePin")
        if pin is not None:source_pin_groups.setdefault(pin,[]).append(name)
    cross_scope_source=any(
        any(n in STATUS for n in group) and any(n in CREDIT for n in group)
        for group in source_pin_groups.values())
    return {"rows":rows,
      "identitiesShared":baseline_shared,
      "sourceArchiveSharedAcrossScope":cross_scope_source,
      "safeDeploySelector":"NOT_VERIFIED",
      "restorableRollback":"NOT_VERIFIED",
      "independentIam":"NOT_VERIFIED",
      "backendAppCheck":"NOT_PROVEN",
      "stageDeployment":"BLOCKED","release":"NO_GO_RELEASE"}

def inspect(read=invoke):
    project=read(["gcloud","config","get-value","project"])
    if project!=PROJECT:raise ValueError("P84_WRONG_PROJECT")
    before={}
    after={}
    for name in TARGETS:
        raw=read(["gcloud","functions","describe",name,"--gen2",
                  "--region",REGION,"--project",PROJECT,"--format=json"])
        before[name]=summary(json.loads(raw))
    for name in TARGETS:
        raw=read(["gcloud","functions","describe",name,"--gen2",
                  "--region",REGION,"--project",PROJECT,"--format=json"])
        after[name]=summary(json.loads(raw))
    return evaluate(before,after)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    args=p.parse_args()
    if not args.inspect:
        print("P84_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        result=inspect()
        print("P84_PROJECT_GUARD=PASS_STAGING_ONLY")
        for row in result["rows"]:
            print("FUNCTION="+row["name"])
            print("  ROLE="+row["role"])
            print("  METADATA_STABILITY="+row["stability"])
            print("  PINNED_GENERATION_PRESENT="+("YES" if row["sourceGenerationPresent"] else "NO"))
            print("  REVISION_PRESENT="+("YES" if row["rollbackRevisionPresent"] else "NO"))
            print("  RUNTIME_IDENTITY_PRESENT="+("YES" if row["runtimeIdentityPresent"] else "NO"))
            print("  CODEBASE_LABEL_PRESENT="+("YES" if row["codebaseLabelPresent"] else "NO"))
        print("P84_RUNTIME_IDENTITIES_SHARED="+("YES" if result["identitiesShared"] else "NO"))
        print("P84_SOURCE_PIN_SHARED_BETWEEN_STATUS_AND_CREDIT="+
              ("YES" if result["sourceArchiveSharedAcrossScope"] else "NO"))
        print("P84_SAFE_DEPLOY_SELECTOR=NOT_VERIFIED")
        print("P84_ROLLBACK_RESTORABLE=NOT_VERIFIED")
        print("P84_IAM_LEAST_PRIVILEGE=NOT_VERIFIED")
        print("P84_BACKEND_APP_CHECK=NOT_PROVEN")
        print("P84_STAGING_DEPLOY=BLOCKED")
        stable=all(r["stability"]=="STABLE_METADATA_ONLY" for r in result["rows"])
        print("P84_SCOPE_METADATA_GATE="+("STABLE_REVIEW_ONLY" if stable else "REVIEW_REQUIRED"))
        return 0 if stable else 2
    except (OSError,ValueError,RuntimeError,TypeError,KeyError,
            subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P84_SCOPE_METADATA=NOT_VERIFIABLE")
        return 2
    finally:
        print("P84_CLOUD_WRITES=0")
        print("P84_DEPLOY=0")
        print("P84_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
