#!/usr/bin/env python3
"""V7 read-only one-pass Staging source inspection with safe timing telemetry.

Exactly one metadata call and one pinned archive RAM read per Function.
Runs scoped reconciliation, targeted handler and helper checks using RAM copies.
Neither a JavaScript AST nor evidence of functional equivalence.
No cloud writes, source text output, bucket identifiers or archives on disk.
"""
import argparse
import importlib.util
import pathlib
import subprocess
import time
from collections import Counter

HERE=pathlib.Path(__file__).resolve().parent

def load(filename,alias):
    spec=importlib.util.spec_from_file_location(alias,HERE/filename)
    value=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

att=load("rr-v7-deployed-source-attestation-readonly.py","onepassatt")
scope=load("rr-v7-delta-scope-reconciliation-readonly.py","onepassscope")
target=load("rr-v7-targeted-handler-logic-readonly.py","onepasstarget")
impact=load("rr-v7-helper-impact-readonly.py","onepassimpact")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","onepasssem")

def checked(local,remote,name):
    # Fail closed if any expected helper cannot be extracted.
    helpers=[impact.helper_status(local,remote,h) for h in impact.TARGETS[name]]
    ops=scope.operations(local,remote)
    counts=Counter(ops)
    handler_equal=sem.handler(local,name)==sem.handler(remote,name)
    res="NOT_APPLICABLE"
    if name in target.TARGETS:
        a=sem.handler(local,name)
        b=sem.handler(remote,name)
        try:
            res=target.selected_changes(a,b,name)[0]
        except ValueError:
            res="NOT_VERIFIABLE"
    return {"helper_exact":helpers.count("EXACT"),
            "helper_drift":helpers.count("DRIFT"),
            "helper_unverified":helpers.count("NOT_VERIFIABLE"),
            "ops":counts,
            "handler":"EXACT" if handler_equal else "DRIFT",
            "response":res}

def emit(name,r):
    print("FUNCTION:",name)
    print("HANDLER_BODY:",r["handler"])
    print("HELPER_EXACT_COUNT:",r["helper_exact"])
    print("HELPER_DRIFT_COUNT:",r["helper_drift"])
    print("HELPER_NOT_VERIFIABLE_COUNT:",r["helper_unverified"])
    print("RESPONSE_EXPRESSION_SIGNAL:",r["response"])
    for k in ("SELECTED_HANDLER","CRITICAL_HELPER","OTHER_EXPORTED_FUNCTION",
              "OTHER_TOP_LEVEL_FUNCTION","TOP_LEVEL_BINDING"):
        print("DELTA_"+k+"_MODIFIED:",r["ops"][k,"MODIFIED"])
        print("DELTA_"+k+"_DEPLOYED_ONLY:",r["ops"][k,"DEPLOYED_ONLY"])
        print("DELTA_"+k+"_REVIEW_ONLY:",r["ops"][k,"REVIEW_ONLY"])
    print("FUNCTION_GATE: REVIEW_REQUIRED")

def inspect(local,metadata,loader=att.bounded_archive,clock=time.monotonic):
    t0=clock()
    verified=0
    reads=0
    for name in att.NAMES:
        try:
            pin=att.pinned_source(metadata.get(name))
            if pin is None:raise ValueError("UNPINNED_SOURCE")
            # Materialize only in RAM; each Function exactly once.
            deployed=att.handler_from_zip(loader(pin))
            reads+=1
            result=checked(local,deployed,name)
            emit(name,result)
            verified+=1
        except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
            print("FUNCTION:",name)
            print("ONE_PASS_INSPECTION: NOT_VERIFIABLE")
    return verified,reads,round((clock()-t0)*1000)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true")
    args=parser.parse_args()
    begin=time.monotonic()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_ONE_PASS: BLOCKED_EXPLICIT_INSPECTION")
            return 2
        local=(HERE.parents[1]/"functions"/"index.js").read_bytes()
        m0=time.monotonic()
        metadata={n:att.function_metadata(n) for n in att.NAMES}
        meta_ms=round((time.monotonic()-m0)*1000)
        verified,reads,analysis_ms=inspect(local,metadata)
        print("SOURCE_ARCHIVES_INSPECTED:",str(verified)+"/5")
        print("SOURCE_ARCHIVE_READS:",reads)
        print("METADATA_CALLS:",len(att.NAMES))
        print("METADATA_AND_PIN_VALIDATION_MS:",meta_ms)
        print("SOURCE_READ_AND_ANALYSIS_MS:",analysis_ms)
        print("TOTAL_ONE_PASS_WALL_MS:",round((time.monotonic()-begin)*1000))
        print("SPEEDUP_OVER_LEGACY: NOT_MEASURED")
        print("V7_ONE_PASS: REVIEW_REQUIRED")
        print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
        print("DEVICE_TEST_AUTHORIZED: NO")
        return 0 if verified==len(att.NAMES) else 2
    except (ValueError,OSError,subprocess.TimeoutExpired):
        print("V7_ONE_PASS: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":raise SystemExit(main())
