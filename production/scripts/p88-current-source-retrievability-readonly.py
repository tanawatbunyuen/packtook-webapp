#!/usr/bin/env python3
"""P88 Staging-only operator source retrievability evidence, read-only.

Retrieves one immutable-generation pinned source ZIP into bounded RAM, validates
that it has a single valid JS handler, then discards it. No source emitted or
saved. This proves CURRENT pinned archive readability only, NOT known-good
rollback, deployed guard safety, source/commit parity, backend App Check, IAM
or build reproducibility. No Cloud writes.
"""
import argparse
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
NAMES=("recordingStatus","usageStatus")
STAGING="packtook-staging"

def load():
    spec=importlib.util.spec_from_file_location("p88_archive",
        ROOT/"rr-v7-deployed-source-attestation-readonly.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def verify(att,name):
    if name not in NAMES:raise ValueError("P88_OUT_OF_SCOPE")
    first={n:att.function_metadata(n) for n in att.NAMES}
    if any(v is None for v in first.values()):
        return "NOT_VERIFIABLE",False
    pin=att.pinned_source(first[name])
    if pin is None:return "NOT_VERIFIABLE",False
    try:
        blob=att.bounded_archive(pin)
        code=att.handler_from_zip(blob)
        if not code:return "NOT_VERIFIABLE",False
        archive="CURRENT_PINNED_ARCHIVE_READABLE_ONLY"
    except (OSError,ValueError,UnicodeError,subprocess.TimeoutExpired):
        archive="NOT_VERIFIABLE"
    finally:
        # No archive/source data written, logged or retained intentionally.
        if "code" in locals():del code
        if "blob" in locals():del blob
    second={n:att.function_metadata(n) for n in att.NAMES}
    stable=att.stable_metadata(first,second)
    if not stable:return "METADATA_DRIFT_REVIEW_REQUIRED",False
    return archive,stable

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-current-source",action="store_true")
    parser.add_argument("--function",choices=NAMES,default=None)
    args=parser.parse_args()
    if not args.inspect_current_source or not args.function or os.environ.get("P88_STAGING_SOURCE_READ")!="YES":
        print("P88_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        att=load()
        att.guard()  # strict Staging project/env and no production credential flags
        state,stable=verify(att,args.function)
        print("P88_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("FUNCTION="+args.function)
        print("P88_CURRENT_SOURCE="+state)
        print("P88_ALL_FIVE_METADATA_STABLE="+("YES" if stable else "NOT_VERIFIABLE"))
        print("P88_SOURCE_TO_GIT_PARITY=NOT_VERIFIED")
        print("P88_KNOWN_GOOD_PRIOR_SOURCE=NOT_VERIFIED")
        print("P88_ROLLBACK_RESTORABLE=NOT_VERIFIED")
        print("P88_SAFE_DEPLOY_SELECTOR=NOT_VERIFIED")
        return 0 if state=="CURRENT_PINNED_ARCHIVE_READABLE_ONLY" and stable else 2
    except (OSError,ValueError,UnicodeError,subprocess.TimeoutExpired):
        print("P88_CURRENT_SOURCE=NOT_VERIFIABLE")
        return 2
    finally:
        print("P88_APP_CHECK_BACKEND=NOT_PROVEN")
        print("P88_IAM_LEAST_PRIVILEGE=NOT_VERIFIED")
        print("P88_CLOUD_WRITES=0")
        print("P88_DEPLOY=0")
        print("P88_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
