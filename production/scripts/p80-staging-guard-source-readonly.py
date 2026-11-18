#!/usr/bin/env python3
"""P80 Staging-only pinned source guard attestation (operator read-only).

Reads five function metadata descriptions twice, and only TWO pinned
source archives, in memory, using the existing reviewed P63/P61 helpers.
Never prints source, bucket, generation, service identity, token, URI,
secret, hash or full metadata. Does not deploy or update any policy.
"""
import argparse
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
REVIEW=ROOT/"production"/"functions"/"index.js"
BRANCH="review/p80-staging-pinned-source-guard-attestation"
FOCUS=("recordingStatus","usageStatus")

def load(name,filename):
    spec=importlib.util.spec_from_file_location(name,HERE/filename)
    obj=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

def check_checkout(runner=subprocess.run):
    b=runner(["git","branch","--show-current"],cwd=ROOT,
             capture_output=True,text=True,timeout=10,check=False)
    if b.returncode or b.stdout.strip()!=BRANCH:raise ValueError("REVIEW_BRANCH_NOT_PINNED")
    r=runner(["git","show","HEAD:production/functions/index.js"],cwd=ROOT,
             capture_output=True,text=False,timeout=15,check=False)
    if r.returncode or not r.stdout or r.stdout!=REVIEW.read_bytes():
        raise ValueError("LOCAL_SOURCE_UNTRUSTED")
    return r.stdout

def evaluate(att,review_bytes,metadata_before,metadata_after,loader,analyzer):
    stable=att.stable_metadata(metadata_before,metadata_after)
    results=[]
    for name in FOCUS:
        info=metadata_before.get(name)
        pin=att.pinned_source(info)
        if pin is None:
            results.append((name,"NOT_VERIFIABLE"))
            continue
        try:
            remote=att.handler_from_zip(loader(pin))
            result=analyzer(review_bytes,remote)
            flags=result[name]
            state="MATCH_REVIEW_ONLY" if (
                flags["reviewGuarded"] and flags["deployedGuarded"] and
                result["state"]=="STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY"
            ) else "DRIFT_REVIEW_REQUIRED"
        except (OSError,ValueError,UnicodeError,subprocess.TimeoutExpired):
            state="NOT_VERIFIABLE"
        results.append((name,state))
    return stable,results

def inspect():
    att=load("p80_archive","rr-v7-deployed-source-attestation-readonly.py")
    p63=load("p80_p63","p63-staging-security-readonly.py")
    # P61 strict project and environment guard precedes any cloud metadata
    # or pinned archive access.
    att.guard()
    local=check_checkout()
    before={n:att.function_metadata(n) for n in att.NAMES}
    if any(x is None for x in before.values()):raise ValueError("MISSING_FUNCTION_METADATA")
    # Read bounded generation-pinned source archives only for drift targets.
    # Analyzer reports only curated guard states.
    first={}
    for name in FOCUS:
        info=before[name]
        pin=att.pinned_source(info)
        if pin is None:
            first[name]=(name,"NOT_VERIFIABLE")
            continue
        try:
            remote=att.handler_from_zip(att.bounded_archive(pin))
            a=p63.inspect(local,remote)
            f=a[name]
            first[name]=(name,"MATCH_REVIEW_ONLY" if (
                f["reviewGuarded"] and f["deployedGuarded"] and
                a["state"]=="STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY"
            ) else "DRIFT_REVIEW_REQUIRED")
        except (OSError,ValueError,UnicodeError,subprocess.TimeoutExpired):
            first[name]=(name,"NOT_VERIFIABLE")
    after={n:att.function_metadata(n) for n in att.NAMES}
    stable=att.stable_metadata(before,after)
    return stable,[first[n] for n in FOCUS]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true")
    args=parser.parse_args()
    try:
        if not args.inspect_source or os.environ.get("P80_ALLOW_STAGING_SOURCE_READ")!="YES":
            print("P80_EXPLICIT_STAGING_SOURCE_OPT_IN_REQUIRED")
            return 2
        stable,results=inspect()
        for name,state in results:
            print("FUNCTION="+name)
            print("  GUARDED_SOURCE="+state)
        print("P80_ALL_FIVE_REVISION_STABLE="+("YES" if stable else "NOT_VERIFIABLE"))
        clear=stable and all(state=="MATCH_REVIEW_ONLY" for _,state in results)
        print("P80_GUARD_SOURCE_GATE="+("MATCH_REVIEW_ONLY" if clear else "REVIEW_REQUIRED"))
        return 0 if clear else 2
    except (OSError,ValueError,UnicodeError,subprocess.TimeoutExpired):
        print("P80_ATTESTATION=NOT_VERIFIABLE")
        return 2
    finally:
        print("P80_BACKEND_APP_CHECK=NOT_PROVEN")
        print("P80_IAM_LEAST_PRIVILEGE=NOT_VERIFIED")
        print("P80_CLOUD_WRITES=0")
        print("P80_DEPLOY=0")
        print("P80_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
