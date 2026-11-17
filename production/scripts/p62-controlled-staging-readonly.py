#!/usr/bin/env python3
"""P62 operator-only read of five Staging Cloud Function source archives.

NO cloud calls without --execute AND P62_ALLOW_STAGING_READ=YES.
Safely captures and summarizes outputs from the P61 fail-closed attestor.
This checks pinned source bytes/revision stability, NOT runtime App Check.
"""
import argparse
import os
import pathlib
import re
import shutil
import subprocess
import sys

ROOT=pathlib.Path(__file__).resolve().parents[2]
ATTEST=ROOT/"production/scripts/rr-v7-deployed-source-attestation-readonly.py"
BRANCH="review/p62-controlled-staging-attestation-operator"
PROJECT="packtook-staging"
NAMES=("reserveCredit","finalizeCredit","recordingStatus",
       "recoverStaleVideoReservation","usageStatus")
BLOCKED_ENVS=("PACKTOOK_PRODUCTION_PROJECT_ID","FIREBASE_TOKEN",
              "GOOGLE_APPLICATION_CREDENTIALS","OMISE_SECRET_KEY")
def fail(reason):
    print("P62_RESULT: "+reason)
    print("P62_RELEASE: NO_GO_RELEASE")
    return 2
def summary(output):
    """Only enumerated, non-sensitive lines are accepted; no raw cloud output."""
    if not isinstance(output,str) or len(output)>24000:return False
    funcs=re.findall(r"^FUNCTION: ([A-Za-z]+)$",output,re.M)
    matches=re.findall(r"^DEPLOYED_HANDLER_EQUALS_REVIEW_BRANCH: (MATCH|DRIFT)$",output,re.M)
    return (tuple(funcs)==NAMES and len(matches)==len(NAMES) and
        all(x=="MATCH" for x in matches) and
        output.count("SOURCE_ARCHIVE_READ: PINNED_GENERATION_RAM_ONLY")==len(NAMES) and
        "SOURCE_ATTESTATION_SUMMARY: MATCH_ALL" in output and
        "STAGING_SOURCE_REVISION_STABLE: YES" in output and
        "P61_STAGING_SOURCE_GATE: MATCH_STABLE_INSPECTION_ONLY" in output and
        "EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN" in output and
        "RELEASE: NO_GO_RELEASE" in output)
def run(argv=None,env=None,runner=subprocess.run):
    args=argparse.ArgumentParser()
    args.add_argument("--execute",action="store_true")
    flags=args.parse_args(argv)
    values=os.environ if env is None else env
    if not flags.execute or values.get("P62_ALLOW_STAGING_READ")!="YES":
        return fail("BLOCKED_EXPLICIT_OPERATOR_OPT_IN")
    if values.get("RR_STAGING_PROJECT_ID")!=PROJECT:
        return fail("BLOCKED_PROJECT_GUARD")
    if any(values.get(k) for k in BLOCKED_ENVS):
        return fail("BLOCKED_SENSITIVE_ENV")
    if not ATTEST.is_file():
        return fail("BLOCKED_MISSING_ATTESTOR")
    if not shutil.which("gcloud"):
        return fail("BLOCKED_GCLOUD_UNAVAILABLE")
    try:
        result=runner(["git","branch","--show-current"],cwd=ROOT,
                      capture_output=True,text=True,timeout=10,check=False)
        if result.returncode or result.stdout.strip()!=BRANCH:
            return fail("BLOCKED_BRANCH_GUARD")
        proc=runner([sys.executable,str(ATTEST),"--inspect-source"],cwd=ROOT,
                    capture_output=True,text=True,timeout=180,check=False,
                    env=dict(values))
        if proc.returncode or not summary(proc.stdout):
            return fail("STAGING_SOURCE_NOT_VERIFIED")
        print("P62_SOURCE_FUNCTIONS_VERIFIED: 5/5")
        print("P62_SOURCE_REVISION_STABLE: YES")
        print("P62_BACKEND_APP_CHECK: NOT_PROVEN")
        print("P62_RUNTIME_EQUIVALENCE: NOT_PROVEN")
        print("P62_RESULT: MATCH_STABLE_INSPECTION_ONLY")
        print("P62_RELEASE: NO_GO_RELEASE")
        return 0
    except (OSError,subprocess.TimeoutExpired):
        return fail("STAGING_SOURCE_NOT_VERIFIED")
if __name__=="__main__":
    raise SystemExit(run())
