#!/usr/bin/env python3
"""P104: bounded read-only Gen2 build provenance evidence for 5 functions.

No source, images, secrets, IAM, logs or customer data downloaded/read.
No URIs or hashes printed. Source equality is NOT source-code parity.
All Cloud operations require explicit --inspect and active Staging project.
"""
import argparse
import json
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
STATUS=("recordingStatus","usageStatus")
CREDITS=("reserveCredit","finalizeCredit","recoverStaleVideoReservation")
NAMES=STATUS+CREDITS
BASE=f"projects/{PROJECT}/locations/{REGION}/functions/"

def read(args):
    result=subprocess.run(args,capture_output=True,text=True,timeout=12,check=False)
    if result.returncode!=0 or len(result.stdout)>200000:
        raise ValueError("P104_READ_UNAVAILABLE")
    return result.stdout.strip()

def build_summary(name,raw):
    data=json.loads(raw)
    if not isinstance(data,dict) or data.get("name")!=BASE+name:
        raise ValueError("P104_OUT_OF_SCOPE_METADATA")
    if data.get("environment")!="GEN_2":
        raise ValueError("P104_NOT_GEN2")
    build=data.get("buildConfig")
    service=data.get("serviceConfig")
    if not isinstance(build,dict) or not isinstance(service,dict):
        raise ValueError("P104_MISSING_CONFIGURATION")
    runtime=build.get("runtime")
    entry=build.get("entryPoint")
    if runtime is not None and (not isinstance(runtime,str) or len(runtime)>80):
        raise ValueError("P104_INVALID_RUNTIME")
    if entry is not None and (not isinstance(entry,str) or len(entry)>128):
        raise ValueError("P104_INVALID_ENTRYPOINT")
    svc=service.get("service")
    # Cloud Run service name is often shorter than Cloud Functions resource path.
    service_prefix=f"projects/{PROJECT}/locations/{REGION}/services/"
    service_valid=isinstance(svc,str) and svc.startswith(service_prefix) and len(svc)>len(service_prefix)
    source=build.get("source")
    signature=None
    if isinstance(source,dict):
        storage=source.get("storageSource")
        repo=source.get("repoSource")
        if isinstance(storage,dict) and isinstance(storage.get("bucket"),str) and (
            isinstance(storage.get("object"),str) or isinstance(storage.get("generation"),str)
        ):
            signature=("storage",storage.get("bucket"),storage.get("object"),str(storage.get("generation","")))
        elif isinstance(repo,dict) and repo:
            signature=("repo",json.dumps(repo,sort_keys=True))
    expected_entry=entry==name
    return {"entryExpected":expected_entry,"entryPresent":entry is not None,
            "runtimePresent":runtime is not None,"serviceValid":service_valid,
            "sourceKey":signature}

def inspect(reader=read,progress=lambda x:None):
    progress("P104_STEP=PROJECT_GUARD")
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P104_WRONG_ACTIVE_PROJECT")
    rows=[]
    for i,name in enumerate(NAMES,1):
        progress(f"P104_STEP=FUNCTION_BUILD_{i}_OF_5")
        args=["gcloud","functions","describe",name,"--gen2","--region",REGION,
              "--project",PROJECT,"--format=json"]
        rows.append(build_summary(name,reader(args)))
    keys=[r["sourceKey"] for r in rows]
    identified=[key for key in keys if key is not None]
    runtime_count=sum(r["runtimePresent"] for r in rows)
    entry_count=sum(r["entryPresent"] for r in rows)
    entry_match=sum(r["entryExpected"] for r in rows)
    services=sum(r["serviceValid"] for r in rows)
    source_count=len(identified)
    groups=len(set(identified))
    if source_count==0:source_state="NO_SOURCE_REFERENCES_VISIBLE"
    elif source_count<5:source_state="PARTIAL_SOURCE_REFERENCES"
    elif groups==1:source_state="ALL_FIVE_SAME_SOURCE_REFERENCE"
    else:source_state="MULTIPLE_SOURCE_REFERENCES"
    return {"runtimeCount":runtime_count,"entryCount":entry_count,
      "entryMatchCount":entry_match,"serviceCount":services,
      "sourceCount":source_count,"sourceGroups":groups,
      "sourceState":source_state}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    args=p.parse_args()
    if not args.inspect:
        print("P104_EXPLICIT_OPERATOR_OPT_IN_REQUIRED");return 2
    try:
        r=inspect(progress=lambda x:print(x,flush=True))
        print("P104_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("P104_GEN2_METADATA_READ=5_OF_5")
        print("P104_RUNTIME_PRESENT="+str(r["runtimeCount"])+"/5")
        print("P104_ENTRYPOINT_PRESENT="+str(r["entryCount"])+"/5")
        print("P104_ENTRYPOINT_EXACT_MATCH="+str(r["entryMatchCount"])+"/5")
        print("P104_SERVICE_RESOURCE_SCOPED="+str(r["serviceCount"])+"/5")
        print("P104_BUILD_SOURCE_REFERENCES="+str(r["sourceCount"])+"/5")
        print("P104_DISTINCT_BUILD_SOURCE_REFERENCES="+str(r["sourceGroups"]))
        print("P104_BUILD_SOURCE_EVIDENCE="+r["sourceState"])
        print("P104_CODEBASE_OWNERSHIP=NOT_VERIFIED")
        print("P104_SOURCE_TO_GIT_PARITY=NOT_VERIFIED")
        print("P104_SOURCE_RESTORABILITY=NOT_VERIFIED")
        print("P104_DEPLOY_PLANNER=NOT_EXECUTED")
        print("P104_LEGACY_ACCOUNT_PARITY=NOT_EQUIVALENT")
        print("P104_DEPLOY=BLOCKED")
        return 0 if r["runtimeCount"]==5 and r["entryMatchCount"]==5 and r["serviceCount"]==5 and r["sourceCount"]==5 else 2
    except (ValueError,OSError,TypeError,KeyError,json.JSONDecodeError,subprocess.TimeoutExpired):
        print("P104_BUILD_PROVENANCE=NOT_VERIFIABLE")
        return 2
    finally:
        print("P104_CLOUD_WRITES=0")
        print("P104_IAM_CHANGES=0")
        print("P104_TRAFFIC_CHANGES=0")
        print("P104_RELEASE=NO_GO_RELEASE")
if __name__=="__main__":
    sys.exit(main())
