#!/usr/bin/env python3
"""P63 fail-closed Staging security triage. No deployment or writes.

Requires explicit opt-in; reads immutable source archives in RAM, and
rejects local production/functions/index.js if it differs from checked-out
Git HEAD. Never prints source, hashes, keys or Cloud object identifiers.
"""
import argparse, importlib.util, json, os, pathlib, subprocess, sys

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location("p63_archive",HERE/"rr-v7-deployed-source-attestation-readonly.py")
att=importlib.util.module_from_spec(spec);spec.loader.exec_module(att)
PARSER=HERE.parent/"ast-review"/"p63-guarded-call-security.cjs"
NAMES=("recordingStatus","usageStatus")
BRANCH="review/p63-security-source-integrity-and-wrapper-guard"
APPROVED_STATES=("STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY","SECURITY_GUARD_DRIFT_REVIEW_REQUIRED")
def parse_report(raw):
    if not isinstance(raw,str) or len(raw)>2500:raise ValueError("BAD_REPORT")
    try:obj=json.loads(raw)
    except (TypeError,ValueError):raise ValueError("BAD_JSON") from None
    if not isinstance(obj,dict) or set(obj)!={"state","recordingStatus","usageStatus",
        "scopedDependencies","backendAppCheck","runtimeEquivalence","release"}:raise ValueError("SCHEMA")
    if obj["state"] not in APPROVED_STATES or obj["backendAppCheck"]!="NOT_PROVEN" or\
       obj["runtimeEquivalence"]!="NOT_PROVEN" or obj["release"]!="NO_GO_RELEASE":raise ValueError("GATE")
    for name in NAMES:
        flags=obj[name]
        if not isinstance(flags,dict) or set(flags)!={"reviewGuarded","deployedGuarded","calleeMatch","optionsIdentifierMatch"} or\
           any(type(v) is not bool for v in flags.values()):raise ValueError("FLAGS")
    if obj["scopedDependencies"] not in (
        "EXACT_SCOPED_TOKENS_REVIEW_REQUIRED","DRIFT_REVIEW_REQUIRED","NOT_VERIFIABLE"
    ):raise ValueError("SCOPE")
    return obj

def checked_local(runner=subprocess.run):
    branch=runner(["git","branch","--show-current"],cwd=ROOT,text=True,
                  capture_output=True,timeout=10,check=False)
    if branch.returncode or branch.stdout.strip()!=BRANCH:raise ValueError("WRONG_BRANCH")
    head=runner(["git","show","HEAD:production/functions/index.js"],cwd=ROOT,
                capture_output=True,timeout=15,check=False)
    if head.returncode or not head.stdout:raise ValueError("GIT_SOURCE_UNAVAILABLE")
    local=(ROOT/"production/functions/index.js").read_bytes()
    if local!=head.stdout:raise ValueError("LOCAL_SOURCE_DIRTY")
    return local

def inspect(local,remote,runner=subprocess.run):
    request=json.dumps({"review":local.decode("utf8","strict"),"deployed":remote.decode("utf8","strict")})
    result=runner(["node",str(PARSER)],input=request,text=True,
        capture_output=True,timeout=20,check=False)
    if result.returncode:raise ValueError("AST_PARSER_BLOCKED")
    return parse_report(result.stdout)

def main():
    flags=argparse.ArgumentParser()
    flags.add_argument("--inspect-source",action="store_true")
    args=flags.parse_args()
    try:
        if not args.inspect_source or os.getenv("P63_ALLOW_STAGING_READ")!="YES":
            print("P63_SECURITY: BLOCKED_EXPLICIT_OPT_IN")
            return 2
        att.guard()
        local=checked_local()
        first={}
        statuses=[]
        for name in NAMES:
            first[name]=att.function_metadata(name)
            pin=att.pinned_source(first[name])
            if pin is None:raise ValueError("UNPINNED_SOURCE")
            remote=att.handler_from_zip(att.bounded_archive(pin))
            result=inspect(local,remote)
            flags=result[name]
            print("FUNCTION:",name)
            print("REVIEW_GUARDED_CALL:",str(flags["reviewGuarded"]).upper())
            print("DEPLOYED_GUARDED_CALL:",str(flags["deployedGuarded"]).upper())
            print("SCOPED_GUARD_STATE:",result["state"])
            statuses.append(result["state"])
        second={name:att.function_metadata(name) for name in NAMES}
        stable=att.stable_metadata(first,second)
        print("P63_SOURCE_STABLE:", "YES" if stable else "NOT_VERIFIABLE")
        ok=stable and len(statuses)==2 and all(
            x=="STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY" for x in statuses)
        print("P63_STATIC_SECURITY:", "MATCH_REVIEW_ONLY" if ok else "REVIEW_REQUIRED")
        return 0 if ok else 2
    except (OSError,ValueError,UnicodeError,subprocess.TimeoutExpired):
        print("P63_SECURITY: NOT_VERIFIABLE")
        return 2
    finally:
        print("P63_BACKEND_APP_CHECK: NOT_PROVEN")
        print("P63_RUNTIME_EQUIVALENCE: NOT_PROVEN")
        print("CLOUD_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":raise SystemExit(main())
