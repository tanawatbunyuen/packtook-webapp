#!/usr/bin/env python3
"""V7 Handler Semantic Attestation: conservative static triage, STAGING only.

Compares five exported callable handler bodies and *referenced* helper text
between reviewed GitHub source and each pinned deployed ZIP archive.
This is NOT semantic equivalence, App Check enforcement, or functional testing.
No source, hashes, URLs, secrets, or ZIP contents printed.
"""
import argparse
import hashlib
import importlib.util
import os
import pathlib
import re
import subprocess

BASE=pathlib.Path(__file__).with_name("rr-v7-deployed-source-attestation-readonly.py")
spec=importlib.util.spec_from_file_location("v7attest",BASE)
att=importlib.util.module_from_spec(spec)
spec.loader.exec_module(att)
NAMES=att.NAMES
# Patterns are *signals*, not proof. Counts alone do not establish correct behavior.
SIGNALS={
 "AUTH_GUARD":r"\buid\s*\(\s*req\s*\)",
 "TENANT_OWNER":r"\b(ownerRef|ensureAccount)\s*\(",
 "TRANSACTION":r"\brunTransaction\s*\(",
 "OPERATION_VALIDATION":r"\bvalidOp\s*\(",
 "DEVICE_VALIDATION":r"\bvalidDevice\s*\(",
 "IDEMPOTENCY_SIGNAL":r"\bidempotent\b",
 "CREDIT_DECREMENT":r"\b(?:increment|used|reserved|walletBalance|walletAvailable)\b",
 "CREDIT_RETURN":r"\b(?:creditReturned|returnCredits|walletBalance|reserved)\b",
 "DUPLICATE_LOCK":r"\b(?:barcodeLocks|duplicateApprovals|barcodeKey)\b",
 "RECOVERY_CONFIRMATION":r"\bconfirmNoVideo\b",
 "RECOVERY_AGE":r"\b(?:STALE_RESERVATION_MS|createdAt|30\s*\*\s*60)\b",
 "FILE_EVIDENCE":r"\b(?:filename|bytes|file)\b",
}
CRITICAL={
 "reserveCredit":("AUTH_GUARD","TENANT_OWNER","TRANSACTION","OPERATION_VALIDATION",
                  "DEVICE_VALIDATION","DUPLICATE_LOCK","CREDIT_DECREMENT"),
 "finalizeCredit":("AUTH_GUARD","TENANT_OWNER","TRANSACTION","OPERATION_VALIDATION",
                   "CREDIT_RETURN","FILE_EVIDENCE","DUPLICATE_LOCK"),
 "recordingStatus":("AUTH_GUARD","TENANT_OWNER","OPERATION_VALIDATION"),
 "recoverStaleVideoReservation":("AUTH_GUARD","TENANT_OWNER","TRANSACTION",
                                  "OPERATION_VALIDATION","RECOVERY_CONFIRMATION",
                                  "RECOVERY_AGE","CREDIT_RETURN"),
 "usageStatus":("AUTH_GUARD","TENANT_OWNER","CREDIT_DECREMENT"),
}
CALL=re.compile(r"\bexports\.([A-Za-z][A-Za-z0-9_]*)\s*=\s*onCall\s*\(")
OPTION=re.compile(r"\benforceAppCheck\s*:\s*(true|false)\b")
MAX_JS=att.MAX_JS

def handler(source,name):
    """Conservative slicing only for multiline-export source layout.
    Rejects ambiguity, missing balanced close, or alternate export forms.
    """
    s=source.decode("utf-8","strict")
    pat=re.compile(r"(?m)^exports\."+re.escape(name)+r"\s*=\s*onCall\s*\(")
    hits=list(pat.finditer(s))
    if len(hits)!=1:raise ValueError("EXPORT_UNVERIFIABLE")
    start=hits[0].start()
    end=s.find("\n});",start)
    if end<0:raise ValueError("EXPORT_TERMINATOR_UNVERIFIABLE")
    end+=len("\n});")
    next_export=re.search(r"(?m)^exports\.[A-Za-z][A-Za-z0-9_]*\s*=\s*onCall\s*\(",s[start+1:end])
    if next_export:raise ValueError("NESTED_EXPORT_UNVERIFIABLE")
    return s[start:end]

def flags(body):
    return {k:bool(re.search(p,body)) for k,p in SIGNALS.items()}

def export_options(source,name):
    s=source.decode("utf-8","strict")
    body=handler(source,name)
    # OnCall first arg from export; only recognize literal object or 'options' variable.
    m=re.search(r"onCall\s*\(\s*(\{[^{}]{0,1000}\}|\w+)\s*,",body)
    if not m:return "UNRESOLVED_OPTIONS"
    arg=m.group(1)
    if arg.startswith("{"):
        options=arg
    else:
        defs=list(re.finditer(r"\bconst\s+"+re.escape(arg)+r"\s*=\s*(\{[^{}]{0,1000}\})",s))
        if len(defs)!=1:return "UNRESOLVED_OPTIONS"
        options=defs[0].group(1)
    # Strip straightforward comments, conservatively signal unresolved options.
    options=re.sub(r"/\*[\s\S]*?\*/|//[^\n]*","",options)
    found=set(OPTION.findall(options))
    if found=={"true"}:return "ENFORCEMENT_TRUE_LITERAL_IN_OPTIONS"
    if found=={"false"}:return "ENFORCEMENT_FALSE_LITERAL_IN_OPTIONS"
    if len(found)>1:return "CONFLICTING_OPTION_LITERALS"
    return "NO_ENFORCEMENT_LITERAL_IN_OPTIONS"

def compare(local,remote,name):
    a=handler(local,name);b=handler(remote,name)
    fa,fb=flags(a),flags(b)
    removed=tuple(k for k in CRITICAL[name] if fa[k] and not fb[k])
    added=tuple(k for k in CRITICAL[name] if not fa[k] and fb[k])
    exact=a.encode()==b.encode()
    return {"body":"EXACT_MATCH" if exact else "DIFFERENT",
            "source_flags":fa,"remote_flags":fb,
            "removed":removed,"added":added,
            "source_options":export_options(local,name),
            "remote_options":export_options(remote,name)}

def examine(source_metas,local,loader=att.bounded_archive):
    blocked=False
    for name in NAMES:
        print("FUNCTION:",name)
        src=att.pinned_source(source_metas.get(name))
        if src is None:
            print("HANDLER_STATIC_REVIEW: BLOCKED_PINNED_SOURCE")
            blocked=True
            continue
        try:
            code=att.handler_from_zip(loader(src))
            result=compare(local,code,name)
            print("HANDLER_BODY:",result["body"])
            print("CRITICAL_SIGNALS_REMOVED_COUNT:",len(result["removed"]))
            print("CRITICAL_SIGNALS_ADDED_COUNT:",len(result["added"]))
            print("SOURCE_APP_CHECK_OPTION:",result["source_options"])
            print("DEPLOYED_APP_CHECK_OPTION:",result["remote_options"])
            if result["removed"]:
                print("CRITICAL_SIGNALS_REMOVED:",",".join(result["removed"]))
            if result["added"]:
                print("CRITICAL_SIGNALS_ADDED:",",".join(result["added"]))
            if result["body"]!="EXACT_MATCH" or result["source_options"]!=result["remote_options"]:
                blocked=True
            if result["remote_options"]!="ENFORCEMENT_TRUE_LITERAL_IN_OPTIONS":
                blocked=True
        except (ValueError,UnicodeError,OSError,subprocess.TimeoutExpired):
            print("HANDLER_STATIC_REVIEW: BLOCKED_PARSE_OR_SOURCE")
            blocked=True
    print("V7_HANDLER_SEMANTIC_ATTESTATION:","REVIEW_REQUIRED" if blocked else "STATIC_EVIDENCE_ONLY")
    print("HANDLER_BEHAVIOR_EQUIVALENCE: NOT_PROVEN")
    print("EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN")
    print("DEPLOYED_SOURCE_EQUALS_GITHUB: NOT_PROVEN")
    print("DEVICE_TEST_AUTHORIZED: NO")
    print("RELEASE: NO_GO_RELEASE")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true")
    args=parser.parse_args()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_HANDLER_SEMANTIC_ATTESTATION: BLOCKED_EXPLICIT_FLAG_REQUIRED")
            return 2
        root=pathlib.Path(__file__).resolve().parents[2]
        local=(root/"functions"/"index.js").read_bytes()
        if len(local)>MAX_JS:raise ValueError("LOCAL_SOURCE_TOO_LARGE")
        metas={name:att.function_metadata(name) for name in NAMES}
        examine(metas,local)
        return 0
    except (ValueError,OSError,subprocess.TimeoutExpired):
        print("V7_HANDLER_SEMANTIC_ATTESTATION: BLOCKED_ENV_OR_SOURCE")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
if __name__=="__main__":raise SystemExit(main())
