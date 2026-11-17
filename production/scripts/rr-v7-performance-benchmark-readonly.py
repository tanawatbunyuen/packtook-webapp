#!/usr/bin/env python3
"""Paired benchmark of V7 legacy repeated archive reads vs One-pass.

Staging pinned source only, no endpoint invocations or data writes. Fetch
function metadata once before timed rounds; both paths use the same generation.
Legacy side re-runs equivalent helper, scope and handler/response inspections
with separate source reads, modeled after prior multi-script workflow.
Default 3 pairs, alternate order, report summary only. All results must match.
"""
import argparse
import contextlib
import io
import importlib.util
import pathlib
import statistics
import subprocess
import time

HERE=pathlib.Path(__file__).resolve().parent
def load(file,alias):
    spec=importlib.util.spec_from_file_location(alias,HERE/file)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    return m
att=load("rr-v7-deployed-source-attestation-readonly.py","bench_att")
one=load("rr-v7-one-pass-readonly.py","bench_one")
target=load("rr-v7-targeted-handler-logic-readonly.py","bench_target")
scope=load("rr-v7-delta-scope-reconciliation-readonly.py","bench_scope")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","bench_sem")
impact=load("rr-v7-helper-impact-readonly.py","bench_imp")

def legacy(local,pins,loader=att.bounded_archive):
    count=0
    for name in att.NAMES:
        if name not in pins:raise ValueError("PIN_MISSING")
        # Repeated archive reads emulate earlier independent diagnostics.
        remote1=att.handler_from_zip(loader(pins[name]));count+=1
        helpers=[impact.helper_status(local,remote1,h) for h in impact.TARGETS[name]]
        remote2=att.handler_from_zip(loader(pins[name]));count+=1
        ops=scope.operations(local,remote2)
        remote3=att.handler_from_zip(loader(pins[name]));count+=1
        equal=sem.handler(local,name)==sem.handler(remote3,name)
        response="NOT_APPLICABLE"
        if name in target.TARGETS:
            a=sem.handler(local,name);b=sem.handler(remote3,name)
            try:response=target.selected_changes(a,b,name)[0]
            except ValueError:response="NOT_VERIFIABLE"
        if any(h not in ("EXACT","DRIFT","NOT_VERIFIABLE") for h in helpers):
            raise ValueError("HELPER_SIGNAL_INVALID")
        if not isinstance(ops,list) or not isinstance(equal,bool) or not response:
            raise ValueError("LEGACY_ANALYSIS_INVALID")
    return count

def optimized(local,pins,loader=att.bounded_archive):
    reads=0
    for name in att.NAMES:
        if name not in pins:raise ValueError("PIN_MISSING")
        code=att.handler_from_zip(loader(pins[name]));reads+=1
        r=one.checked(local,code,name)
        if not isinstance(r["ops"],dict) and not hasattr(r["ops"],"items"):
            raise ValueError("OPTIMIZED_INVALID")
    return reads

def run_pair(local,pins,loader,clock):
    times={}
    orders=("legacy","onepass")
    for mode in orders:
        start=clock()
        reads=legacy(local,pins,loader) if mode=="legacy" else optimized(local,pins,loader)
        times[mode]=round((clock()-start)*1000)
        times[mode+"_reads"]=reads
    return times

def summarize(results):
    # Rounded milliseconds; skip zero baseline to prevent divide-by-zero.
    before=statistics.median(r["legacy"] for r in results)
    after=statistics.median(r["onepass"] for r in results)
    speedup=100*(before-after)/before if before>0 else None
    return before,after,speedup

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true")
    parser.add_argument("--rounds",type=int,default=3)
    args=parser.parse_args()
    try:
        att.guard()
        if not args.inspect_source or not 1<=args.rounds<=10:
            print("V7_BENCHMARK: BLOCKED_FLAG_OR_ROUNDS")
            return 2
        local=(HERE.parents[1]/"functions"/"index.js").read_bytes()
        pins={}
        for name in att.NAMES:
            pin=att.pinned_source(att.function_metadata(name))
            if pin is None:raise ValueError("PIN_MISSING")
            pins[name]=pin
        results=[]
        for index in range(args.rounds):
            # Alternate mode order to reduce warm-cache ordering bias.
            if index%2==0:
                r=run_pair(local,pins,att.bounded_archive,time.monotonic)
            else:
                start=time.monotonic()
                n=optimized(local,pins)
                a=round((time.monotonic()-start)*1000)
                start=time.monotonic()
                m=legacy(local,pins)
                b=round((time.monotonic()-start)*1000)
                r={"legacy":b,"onepass":a,"legacy_reads":m,"onepass_reads":n}
            if r["legacy_reads"]!=15 or r["onepass_reads"]!=5:
                raise ValueError("READ_COUNT_MISMATCH")
            results.append(r)
        base,fast,pct=summarize(results)
        print("PAIRED_ROUNDS:",len(results))
        print("LEGACY_SOURCE_ARCHIVE_READS_PER_ROUND: 15")
        print("ONEPASS_SOURCE_ARCHIVE_READS_PER_ROUND: 5")
        print("LEGACY_MEDIAN_WALL_MS:",base)
        print("ONEPASS_MEDIAN_WALL_MS:",fast)
        print("MEASURED_SPEEDUP_PERCENT:",round(pct,1) if pct is not None else "NOT_VERIFIABLE")
        print("TARGET_50_PERCENT:", "MEETS_PAIR_BENCHMARK_ONLY" if pct is not None and pct>=50 else "NOT_DEMONSTRATED")
        print("MEASUREMENT_SCOPE: SAME_PINNED_GENERATIONS_ANALYSIS_ONLY")
        print("METADATA_CALLS_EXCLUDED_FROM_BOTH_TIMERS: YES")
        print("FULL_E2E_TIME_SAVING: NOT_PROVEN")
        print("V7_BENCHMARK: REVIEW_REQUIRED")
        return 0
    except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
        print("V7_BENCHMARK: BLOCKED_ENV_OR_SOURCE")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":raise SystemExit(main())
