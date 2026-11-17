#!/usr/bin/env python3
"""V7 deployed revision/source provenance inventory, read-only.
No source archives downloaded. No secrets, URLs, image names, service account
identities, Cloud Run revision names or environment values printed.
Cloud Functions v2 metadata does not reveal enforceAppCheck semantics.
"""
import json
import os
import pathlib
import subprocess

PROJECT="packtook-staging"
REGION="asia-southeast1"
NAMES=("reserveCredit","finalizeCredit","recordingStatus",
       "recoverStaleVideoReservation","usageStatus")
SENSITIVE_ENV=("OMISE_SECRET_KEY","FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS",
               "PACKTOOK_PRODUCTION_PROJECT_ID")

def guard(runner=subprocess.run):
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:
        raise ValueError("PROJECT_GUARD")
    if any(os.environ.get(k) for k in SENSITIVE_ENV):
        raise ValueError("UNSAFE_ENV")
    r=runner(["gcloud","config","get-value","project"],capture_output=True,text=True,timeout=12,check=False)
    if r.returncode!=0 or r.stdout.strip()!=PROJECT:raise ValueError("ACTIVE_PROJECT_MISMATCH")

def describe(name,runner=subprocess.run):
    r=runner(["gcloud","functions","describe",name,"--gen2",
              "--project="+PROJECT,"--region="+REGION,"--format=json"],
             capture_output=True,text=True,timeout=30,check=False)
    if r.returncode!=0:return None
    try:
        v=json.loads(r.stdout)
        return v if isinstance(v,dict) else None
    except (ValueError,TypeError):
        return None

def metadata(info):
    if not isinstance(info,dict):return {"state":"DESCRIBE_FAILED"}
    build=info.get("buildConfig")
    service=info.get("serviceConfig")
    build=build if isinstance(build,dict) else {}
    service=service if isinstance(service,dict) else {}
    source=build.get("source")
    source=source if isinstance(source,dict) else {}
    return {
       "state":"ACTIVE" if info.get("state")=="ACTIVE" else "NOT_ACTIVE",
       "source_metadata_present":bool(source),
       "build_config_present":bool(build),
       "build_entrypoint_present":bool(build.get("entryPoint")),
       "update_time_present":bool(info.get("updateTime")),
       "revision_metadata_present":bool(service.get("revision")),
       "service_config_present":bool(service),
    }

def report(items):
    results=[metadata(x) for x in items]
    for name,r in zip(NAMES,results):
        print("FUNCTION:",name)
        for key in ("state","source_metadata_present","build_config_present",
                    "build_entrypoint_present","update_time_present",
                    "revision_metadata_present","service_config_present"):
            value=r.get(key,False)
            if isinstance(value,bool):value="YES" if value else "NO"
            print(key.upper()+":",value)
    count=sum(x["state"]=="ACTIVE" for x in results)
    print("ACTIVE_COUNT:",str(count)+"/"+str(len(NAMES)))
    print("DEPLOYED_SOURCE_EQUIVALENCE: NOT_PROVEN")
    print("DEPLOYED_APP_CHECK_ENFORCEMENT: NOT_PROVEN")
    print("APP_CHECK_CLIENT_INITIALIZATION: NOT_PROOF_OF_SERVER_ENFORCEMENT")
    print("REVISION_PROVENANCE_GATE:","INVENTORY_ONLY" if count==len(NAMES) else "BLOCKED")
    return count

def run():
    try:
        guard()
        items=[]
        for name in NAMES:
            try:items.append(describe(name))
            except (OSError,subprocess.TimeoutExpired):items.append(None)
        report(items)
    except (OSError,ValueError,subprocess.TimeoutExpired):
        print("REVISION_PROVENANCE_GATE: BLOCKED_ENVIRONMENT")
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":run()
