#!/usr/bin/env python3
"""V7: scoped source-drift impact triage, Staging read-only.

Checks exact text of explicit high-risk helper declarations and selected
response-return / validation lines. Static text comparison only; neither
equivalence nor App Check enforcement. No raw code, hashes or paths printed.
"""
import argparse
import difflib
import importlib.util
import pathlib
import re
import subprocess

HERE=pathlib.Path(__file__).resolve().parent
def module(path,alias):
    spec=importlib.util.spec_from_file_location(alias,HERE/path)
    value=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value
att=module("rr-v7-deployed-source-attestation-readonly.py","v7archiveimpact")
sem=module("rr-v7-handler-semantic-attestation-readonly.py","v7semimpact")
TARGETS={
 "reserveCredit":("uid","ensureAccount","subscriptionState","creditAvailable",
                  "walletEnabled","pendingReservations","barcodeKey","validOp","validDevice"),
 "finalizeCredit":("uid","ownerRef","barcodeKey","walletEnabled","pendingReservations","validOp"),
 "recoverStaleVideoReservation":("uid","ensureAccount","walletEnabled","barcodeKey","validOp"),
 "recordingStatus":("uid","ownerRef","validOp"),
 "usageStatus":("uid","ensureAccount","creditAvailable","pendingReservations",
                "walletEnabled","subscriptionState","purchaseDecision"),
}
# Report only a fixed allowlist of helper names. No code or custom identifiers.
ALL_HELPERS=tuple(sorted(set(sum((list(x) for x in TARGETS.values()),[]))))
CHECKS=("return {","throw new HttpsError","uid(req)","ownerRef(","ensureAccount(",
        "creditAvailable(","pendingReservations(","walletEnabled(","purchaseDecision(")

def helper_span(source,name):
    s=source.decode("utf-8","strict")
    # Detect only top-level named 'function helper(...)' with source layout.
    hits=list(re.finditer(r"(?m)^function\s+"+re.escape(name)+r"\s*\(",s))
    if len(hits)!=1:return None
    start=hits[0].start()
    # Next top-level declaration/export ends a helper region, conservatively.
    next_decl=re.search(r"(?m)^(?:function\s+\w+\s*\(|exports\.\w+\s*=|const\s+\w+\s*=|let\s+\w+\s*=)",s[start+1:])
    if next_decl is None:return None
    end=start+1+next_decl.start()
    return s[start:end].strip()

def helper_status(local,remote,name):
    a=helper_span(local,name)
    b=helper_span(remote,name)
    if a is None or b is None:return "NOT_VERIFIABLE"
    return "EXACT" if a==b else "DRIFT"

def handler_response_status(local,remote,name):
    a=sem.handler(local,name)
    b=sem.handler(remote,name)
    if a==b:return "EXACT"
    if name not in ("recordingStatus","usageStatus"):return "REVIEW_REQUIRED"
    # No attempts to parse the inline JS return object or claim its fields.
    aa=[x for x in a.splitlines() if any(t in x for t in CHECKS)]
    bb=[x for x in b.splitlines() if any(t in x for t in CHECKS)]
    if aa==bb:return "NON_CHECK_LINE_DRIFT"
    return "CHECK_RELATED_LINE_DRIFT"

def impact_report(local,remote,name):
    print("FUNCTION:",name)
    print("HANDLER_RESPONSE_REVIEW:",handler_response_status(local,remote,name))
    statuses={}
    for helper in TARGETS[name]:
        statuses[helper]=helper_status(local,remote,helper)
        print("HELPER_"+helper.upper()+":",statuses[helper])
    print("HELPERS_EXACT_COUNT:",sum(x=="EXACT" for x in statuses.values()))
    print("HELPERS_DRIFT_COUNT:",sum(x=="DRIFT" for x in statuses.values()))
    print("HELPERS_NOT_VERIFIABLE_COUNT:",sum(x=="NOT_VERIFIABLE" for x in statuses.values()))
    print("SOURCE_EQUIVALENCE: NOT_PROVEN")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect-source",action="store_true")
    args=p.parse_args()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_HELPER_IMPACT: BLOCKED_EXPLICIT_INSPECTION_REQUIRED")
            return 2
        local=(HERE.parents[1]/"functions"/"index.js").read_bytes()
        for name in att.NAMES:
            try:
                m=att.function_metadata(name)
                pin=att.pinned_source(m)
                if pin is None:raise ValueError("UNPINNED")
                remote=att.handler_from_zip(att.bounded_archive(pin))
                impact_report(local,remote,name)
            except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
                print("FUNCTION:",name)
                print("HELPER_IMPACT: NOT_VERIFIABLE")
        print("V7_HELPER_IMPACT: REVIEW_REQUIRED")
        print("EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN")
        print("DEVICE_TEST_AUTHORIZED: NO")
        return 0
    except (ValueError,OSError,subprocess.TimeoutExpired):
        print("V7_HELPER_IMPACT: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":raise SystemExit(main())
