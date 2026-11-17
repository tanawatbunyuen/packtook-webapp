#!/usr/bin/env python3
"""PACKTOOK V7 Staging-only Cloud Build provenance hints; READ ONLY.
No build logs, artifact source archives, URLs, source code, or secrets printed.
A build SHA hint is not proof of deployed source identity or App Check enforcement.
"""
import json
import os
import re
import subprocess

PROJECT="packtook-staging"
REGION="asia-southeast1"
NAMES=("reserveCredit","finalizeCredit","recordingStatus",
       "recoverStaleVideoReservation","usageStatus")
PROHIBITED=("FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS",
            "OMISE_SECRET_KEY","PACKTOOK_PRODUCTION_PROJECT_ID")
BUILD_REF=re.compile(r"^projects/([0-9]+|packtook-staging)/locations/([a-z0-9-]+)/builds/([a-f0-9-]{36})$")
SHA=re.compile(r"^[a-f0-9]{40}$",re.I)

def guard(runner=subprocess.run):
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:raise ValueError("PROJECT_GUARD")
    if any(os.environ.get(k) for k in PROHIBITED):raise ValueError("UNSAFE_ENV")
    r=runner(["gcloud","config","get-value","project"],
             capture_output=True,text=True,timeout=10,check=False)
    if r.returncode or r.stdout.strip()!=PROJECT:raise ValueError("ACTIVE_PROJECT_MISMATCH")

def json_get(args,runner=subprocess.run):
    r=runner(args,capture_output=True,text=True,timeout=30,check=False)
    if r.returncode:return None
    try:
        d=json.loads(r.stdout)
        return d if isinstance(d,dict) else None
    except (TypeError,ValueError):
        return None

def build_locator(info):
    if not isinstance(info,dict):return None
    bc=info.get("buildConfig")
    if not isinstance(bc,dict):return None
    raw=bc.get("build")
    if not isinstance(raw,str):return None
    m=BUILD_REF.fullmatch(raw)
    if not m:return None
    if m.group(2)!=REGION:return None
    return m.group(3)

def evidence(build):
    if not isinstance(build,dict):return "BUILD_NOT_READABLE"
    status=build.get("status")
    sp=build.get("sourceProvenance")
    if isinstance(sp,dict):
        repo=sp.get("resolvedRepoSource")
        if isinstance(repo,dict) and isinstance(repo.get("commitSha"),str) and SHA.fullmatch(repo["commitSha"]):
            return "RESOLVED_REPO_COMMIT_HINT"
    subs=build.get("substitutions")
    if isinstance(subs,dict) and isinstance(subs.get("COMMIT_SHA"),str) and SHA.fullmatch(subs["COMMIT_SHA"]):
        return "BUILD_SUBSTITUTION_COMMIT_HINT"
    return "NO_COMMIT_PROVENANCE" if status=="SUCCESS" else "BUILD_STATUS_NOT_CONFIRMED"

def main():
    try:
        guard()
        for name in NAMES:
            d=json_get(["gcloud","functions","describe",name,"--gen2",
                 "--project="+PROJECT,"--region="+REGION,"--format=json"])
            build_id=build_locator(d)
            print("FUNCTION:",name)
            print("CLOUD_BUILD_REFERENCE:", "PRESENT" if build_id else "MISSING_OR_UNSUPPORTED")
            if build_id:
                b=json_get(["gcloud","builds","describe",build_id,
                    "--project="+PROJECT,"--region="+REGION,"--format=json"])
                print("BUILD_METADATA:", "READABLE" if b else "NOT_READABLE")
                print("BUILD_PROVENANCE_EVIDENCE:",evidence(b))
            else:
                print("BUILD_METADATA: NOT_QUERIED")
                print("BUILD_PROVENANCE_EVIDENCE: NOT_PROVEN")
        print("DEPLOYED_SOURCE_EQUALS_GITHUB: NOT_PROVEN")
        print("APP_CHECK_ENFORCEMENT: NOT_PROVEN")
        print("V7_BUILD_PROVENANCE_GATE: INVENTORY_ONLY")
    except (ValueError,OSError,subprocess.TimeoutExpired):
        print("V7_BUILD_PROVENANCE_GATE: BLOCKED_ENVIRONMENT")
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":main()
