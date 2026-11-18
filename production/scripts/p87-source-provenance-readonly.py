#!/usr/bin/env python3
"""P87 operator-only Staging pinned-source provenance inspection.

Only reads Cloud Functions metadata (twice). Never reads source bytes,
Cloud Storage objects, secrets, IAM policies or Cloud Run revision bodies.
No writes. No raw identifiers are displayed. Source pin syntax and stability
are useful evidence, NEVER proof a prior version is recoverable.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
STATUS=("recordingStatus","usageStatus")
CREDIT=("reserveCredit","finalizeCredit","recoverStaleVideoReservation")
TARGETS=STATUS+CREDIT
HERE=Path(__file__).resolve().parent

def load_attestation():
    spec=importlib.util.spec_from_file_location(
        "p87_pin",HERE/"rr-v7-deployed-source-attestation-readonly.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def read(command):
    r=subprocess.run(command,check=False,text=True,capture_output=True,timeout=35)
    if r.returncode or len(r.stdout)>160000:
        raise ValueError("P87_READ_ONLY_COMMAND_UNAVAILABLE")
    return r.stdout.strip()

def summarize(raw,pin_validator):
    data=json.loads(raw)
    if not isinstance(data,dict) or data.get("state")!="ACTIVE" or data.get("environment")!="GEN_2":
        raise ValueError("P87_FUNCTION_NOT_ACTIVE_GEN2")
    service=data.get("serviceConfig") or {}
    if not isinstance(service,dict):
        raise ValueError("P87_BAD_SERVICE_CONFIG")
    pin=pin_validator(data) # P61 strict pinned GCS generation syntax.
    identity=service.get("serviceAccountEmail")
    revision=service.get("revision") or service.get("revisionName")
    update=data.get("updateTime")
    return {
      "sourcePin":pin,
      "identity":identity if isinstance(identity,str) and identity else None,
      "revision":revision if isinstance(revision,str) and revision else None,
      "updateTime":update if isinstance(update,str) and update else None,
      "runtime":data.get("buildConfig",{}).get("runtime") if isinstance(data.get("buildConfig"),dict) else None,
      "ingress":service.get("ingressSettings"),
      "timeoutSeconds":service.get("timeoutSeconds"),
      "memory":service.get("availableMemory"),
      "minInstances":service.get("minInstanceCount"),
      "maxInstances":service.get("maxInstanceCount")
    }

def evaluate(first,second):
    if set(first)!=set(TARGETS) or set(second)!=set(TARGETS):
        raise ValueError("P87_INCOMPLETE_TARGET_SET")
    rows=[]
    for n in TARGETS:
        a,b=first[n],second[n]
        drift=a!=b
        safe=bool(a["sourcePin"] and a["identity"] and a["revision"] and a["updateTime"])
        rows.append({"name":n,"group":"STATUS_PATCH_TARGET" if n in STATUS else "CREDIT_EXCLUDED",
          "provenance":"STABLE_PINNED_SOURCE_METADATA_ONLY" if safe and not drift else (
              "DRIFT_REVIEW_REQUIRED" if drift else "PROVENANCE_INCOMPLETE"),
          "strictPinnedSourceSyntax":bool(a["sourcePin"]),
          "revisionPresent":bool(a["revision"]),
          "identityPresent":bool(a["identity"])})
    groups={}
    for n in TARGETS:
        pin=first[n]["sourcePin"]
        if pin is not None:groups.setdefault(pin,[]).append(n)
    cross=any(any(n in STATUS for n in names) and any(n in CREDIT for n in names)
              for names in groups.values())
    return {
      "rows":rows,"crossScopePinShared":cross,
      "immutablePriorRevisionIdentified":"NOT_VERIFIED",
      "pinnedSourceRestorable":"NOT_VERIFIED",
      "liveFirebaseCodebaseOwnership":"NOT_VERIFIED",
      "iamLeastPrivilege":"NOT_VERIFIED",
      "backendAppCheck":"NOT_PROVEN",
      "stagingDeploy":"BLOCKED","release":"NO_GO_RELEASE"
    }

def inspect(reader=read,validator=None):
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P87_WRONG_ACTIVE_PROJECT")
    if validator is None:validator=load_attestation().pinned_source
    first={}
    second={}
    for n in TARGETS:
        cmd=["gcloud","functions","describe",n,"--gen2",
             "--project",PROJECT,"--region",REGION,"--format=json"]
        first[n]=summarize(reader(cmd),validator)
    for n in TARGETS:
        cmd=["gcloud","functions","describe",n,"--gen2",
             "--project",PROJECT,"--region",REGION,"--format=json"]
        second[n]=summarize(reader(cmd),validator)
    return evaluate(first,second)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    args=p.parse_args()
    if not args.inspect:
        print("P87_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        result=inspect()
        print("P87_PROJECT_GUARD=PASS_STAGING_ONLY")
        for row in result["rows"]:
            print("FUNCTION="+row["name"])
            print("  GROUP="+row["group"])
            print("  SOURCE_PROVENANCE="+row["provenance"])
            print("  STRICT_PINNED_SOURCE_SYNTAX="+("YES" if row["strictPinnedSourceSyntax"] else "NO"))
            print("  REVISION_PRESENT="+("YES" if row["revisionPresent"] else "NO"))
            print("  RUNTIME_IDENTITY_PRESENT="+("YES" if row["identityPresent"] else "NO"))
        print("P87_CROSS_SCOPE_SOURCE_PIN_SHARED="+("YES" if result["crossScopePinShared"] else "NO"))
        print("P87_IMMUTABLE_PRIOR_REVISION=NOT_VERIFIED")
        print("P87_SOURCE_RESTORABLE=NOT_VERIFIED")
        print("P87_LIVE_CODEBASE_OWNERSHIP=NOT_VERIFIED")
        print("P87_IAM_LEAST_PRIVILEGE=NOT_VERIFIED")
        print("P87_BACKEND_APP_CHECK=NOT_PROVEN")
        print("P87_STAGING_DEPLOY=BLOCKED")
        ready=all(r["provenance"]=="STABLE_PINNED_SOURCE_METADATA_ONLY" for r in result["rows"])
        print("P87_METADATA_GATE="+("STABLE_REVIEW_ONLY" if ready else "REVIEW_REQUIRED"))
        return 0 if ready else 2
    except (OSError,ValueError,RuntimeError,TypeError,KeyError,
            subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P87_SOURCE_PROVENANCE=NOT_VERIFIABLE")
        return 2
    finally:
        print("P87_CLOUD_WRITES=0")
        print("P87_DEPLOY=0")
        print("P87_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
