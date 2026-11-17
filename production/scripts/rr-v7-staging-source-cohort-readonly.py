#!/usr/bin/env python3
"""PACKTOOK V7 Staging deployed-source cohort check (READ ONLY).
Detect whether the five functions reference one identical Cloud Build source
artifact. Does not download archives, fetch Build logs, read Firestore, or expose
storage identifiers. Shared artifact != GitHub commit equivalence.
"""
import json
import os
import subprocess

PROJECT="packtook-staging"
REGION="asia-southeast1"
NAMES=("reserveCredit","finalizeCredit","recordingStatus","recoverStaleVideoReservation","usageStatus")
GUARDED_ENV=("FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS",
             "OMISE_SECRET_KEY","PACKTOOK_PRODUCTION_PROJECT_ID")

def source_identity(metadata):
    if not isinstance(metadata,dict):return None
    build=metadata.get("buildConfig")
    if not isinstance(build,dict):return None
    source=build.get("source")
    if not isinstance(source,dict):return None
    storage=source.get("storageSource")
    if isinstance(storage,dict):
        bucket=storage.get("bucket")
        obj=storage.get("object")
        gen=storage.get("generation")
        if all(v is not None and str(v) for v in (bucket,obj,gen)):
            return ("STORAGE_SOURCE",str(bucket),str(obj),str(gen))
    repo=source.get("repoSource")
    if isinstance(repo,dict):
        fields=(repo.get("projectId"),repo.get("repoName"),repo.get("commitSha"))
        if all(v is not None and str(v) for v in fields):
            return ("REPO_COMMIT_SOURCE",)+tuple(str(x) for x in fields)
    return None

def guard(runner=subprocess.run):
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:
        raise ValueError("PROJECT_ENV_REQUIRED")
    if any(os.environ.get(x) for x in GUARDED_ENV):
        raise ValueError("CREDENTIAL_ENV_NOT_ALLOWED")
    r=runner(["gcloud","config","get-value","project"],
             text=True,capture_output=True,timeout=10,check=False)
    if r.returncode!=0 or r.stdout.strip()!=PROJECT:
        raise ValueError("ACTIVE_PROJECT_MISMATCH")

def describe(name,runner=subprocess.run):
    r=runner(["gcloud","functions","describe",name,"--gen2",
              "--project="+PROJECT,"--region="+REGION,"--format=json"],
             capture_output=True,text=True,timeout=30,check=False)
    if r.returncode!=0:return None
    try:
        payload=json.loads(r.stdout)
        return payload if isinstance(payload,dict) else None
    except (TypeError,ValueError):
        return None

def summarize(values):
    ids=[source_identity(x) for x in values]
    if any(x is None for x in ids):return "SOURCE_IDENTITY_INCOMPLETE"
    if all(x==ids[0] for x in ids):return "SAME_SOURCE_ARTIFACT"
    return "MULTIPLE_SOURCE_ARTIFACTS"

def report(values):
    for name,meta in zip(NAMES,values):
        print("FUNCTION:",name)
        print("SOURCE_IDENTITY_COMPLETE:","YES" if source_identity(meta) else "NO")
        print("FUNCTION_ACTIVE:","YES" if isinstance(meta,dict) and meta.get("state")=="ACTIVE" else "NO")
        print("UPDATE_TIME_PRESENT:","YES" if isinstance(meta,dict) and meta.get("updateTime") else "NO")
    print("SOURCE_ARTIFACT_COHORT:",summarize(values))
    print("DELETED_OR_ARCHIVED_SOURCE_CONTENT: NOT_ACCESSED")
    print("DEPLOYED_SOURCE_EQUALS_GITHUB_COMMIT: NOT_PROVEN")
    print("APP_CHECK_ENFORCEMENT: NOT_PROVEN")
    print("V7_SOURCE_PROVENANCE_GATE: REVIEW_ONLY")
    print("DEVICE_TEST_AUTHORIZED: NO")
    print("CLOUD_WRITES: 0")
    print("RELEASE: NO_GO_RELEASE")

def main():
    try:
        guard()
        values=[]
        for name in NAMES:
            try:values.append(describe(name))
            except (OSError,subprocess.TimeoutExpired):values.append(None)
        report(values)
    except (OSError,ValueError,subprocess.TimeoutExpired):
        print("V7_SOURCE_PROVENANCE_GATE: BLOCKED_ENVIRONMENT")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("CLOUD_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":main()
