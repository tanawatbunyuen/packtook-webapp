#!/usr/bin/env python3
"""PACKTOOK V7 targeted handler logic review -- staging-only static evidence.

Reads five immutable-generation deployed source ZIPs to RAM, compares two
read-only callable handler response expressions, and tracks unresolved
shared-module drift. Never prints source, expressions, hashes or URLs.
Not a JS parser, runtime equivalence proof, or authorization to test devices.
"""
import argparse
import difflib
import importlib.util
import pathlib
import re
import subprocess

HERE=pathlib.Path(__file__).resolve().parent
def load(filename,alias):
    spec=importlib.util.spec_from_file_location(alias,HERE/filename)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

att=load("rr-v7-deployed-source-attestation-readonly.py","target_att")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","target_sem")
delta=load("rr-v7-scoped-handler-delta-readonly.py","target_delta")
impact=load("rr-v7-helper-impact-readonly.py","target_imp")

TARGETS={
 "recordingStatus":("recordingId","status","barcode","period","file"),
 "usageStatus":("plan","limit","used","reserved","remaining","walletEnabled",
    "walletStartingCredits","period","openBillingRequestId","canBuyMore",
    "purchaseReason","planExpiresAt","subscriptionStatus"),
}
MAX_PARTS=40
KEY=re.compile(r"^[a-zA-Z_$][a-zA-Z0-9_$]*$")

def split_top_level(s):
    """Conservative balanced-expression split. Rejects unsupported / ambiguous JS.
    Safely handles basic strings, brackets, parentheses and ternary expressions.
    Does NOT support template strings, JS regex literals or comments.
    """
    parts=[]
    stack=[]
    start=0
    quote=None
    escaped=False
    for i,c in enumerate(s):
        if quote:
            if escaped:escaped=False
            elif c=="\\":escaped=True
            elif c==quote:quote=None
            continue
        if c in "'\"":
            quote=c
        elif c in "()[]{}":
            if c in "([{":stack.append(c)
            else:
                if not stack or stack[-1]!="([{ "[")]}".index(c)]:raise ValueError("UNBALANCED_JS")
                stack.pop()
        elif c=="," and not stack:
            parts.append(s[start:i].strip())
            start=i+1
    if quote or stack:raise ValueError("UNBALANCED_JS")
    parts.append(s[start:].strip())
    if len(parts)>MAX_PARTS or any(not x for x in parts):raise ValueError("UNSUPPORTED_OBJECT")
    return parts

def response_fields(handler,name):
    # Only accept exactly one explicit single-line 'return {...};' expression.
    lines=[x.strip() for x in handler.splitlines() if x.strip().startswith("return {")]
    if len(lines)!=1 or not lines[0].endswith("};"):raise ValueError("RETURN_UNVERIFIABLE")
    body=lines[0][len("return {"):-2]
    mapping={}
    for part in split_top_level(body):
        if ":" in part:
            key,value=part.split(":",1)
            key=key.strip()
            if not KEY.fullmatch(key):raise ValueError("PROPERTY_UNSUPPORTED")
            if not value.strip():raise ValueError("EMPTY_VALUE")
            expr=value.strip()
        else:
            key=part.strip()
            if not KEY.fullmatch(key):raise ValueError("SHORTHAND_UNSUPPORTED")
            expr=key
        if key in mapping:raise ValueError("DUPLICATE_PROPERTY")
        mapping[key]=expr
    return mapping

def selected_changes(a,b,name):
    x=response_fields(a,name)
    y=response_fields(b,name)
    expected=TARGETS[name]
    if any(k not in x or k not in y for k in expected):return "EXPECTED_FIELD_MISSING",(),0
    if set(x)!=set(y):return "RESPONSE_KEY_SET_CHANGED",(),len(set(x)^set(y))
    changed=tuple(k for k in expected if x[k]!=y[k])
    return ("EXACT_EXPRESSIONS" if not changed else "VALUE_EXPRESSION_DRIFT"),changed,0

def classify_nonreturn(a,b):
    blocks=delta.changed(a,b)
    if not blocks:return "EXACT",0
    changed=[line for x,y in blocks for line in x+y]
    # If the changed line does not contain 'return' and has differences,
    # do not guess it is a no-op; mark unreviewed logic change.
    if any("return " not in x for x in changed):
        return "NON_RETURN_LOGIC_DRIFT",len(blocks)
    return "RETURN_LINE_DRIFT_ONLY",len(blocks)

def inspect(local,remote,name):
    a=sem.handler(local,name)
    b=sem.handler(remote,name)
    result={"handler":"EXACT" if a==b else "DRIFT",
            "shared":"EXACT" if delta.masked_module(local)==delta.masked_module(remote) else "DRIFT"}
    if name in TARGETS:
        result["line_kind"],result["changed_blocks"]=classify_nonreturn(a,b)
        try:
            result["response"],result["changed_fields"],result["other_keys"]=selected_changes(a,b,name)
        except ValueError:
            result["response"]="NOT_VERIFIABLE"
            result["changed_fields"]=()
            result["other_keys"]=0
    return result

def emit(name,report):
    print("FUNCTION:",name)
    print("HANDLER:",report["handler"])
    print("SHARED_MODULE:",report["shared"])
    if name in TARGETS:
        print("CHANGED_LINE_CLASS:",report["line_kind"])
        print("CHANGED_BLOCKS:",report["changed_blocks"])
        print("RESPONSE_EXPRESSION_REVIEW:",report["response"])
        print("CHANGED_EXPECTED_FIELD_EXPRESSIONS:",len(report["changed_fields"]))
        if report["changed_fields"]:
            print("CHANGED_ALLOWLIST_FIELD_NAMES:",",".join(report["changed_fields"]))
        print("OTHER_RESPONSE_KEYSET_DELTA:",report["other_keys"])
    print("FUNCTIONAL_EQUIVALENCE: NOT_PROVEN")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true")
    args=parser.parse_args()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_TARGETED_LOGIC_REVIEW: BLOCKED_EXPLICIT_INSPECTION_REQUIRED")
            return 2
        source=(HERE.parents[1]/"functions"/"index.js").read_bytes()
        count=0
        for name in att.NAMES:
            try:
                meta=att.function_metadata(name)
                pinned=att.pinned_source(meta)
                if pinned is None:raise ValueError("UNPINNED_SOURCE")
                deployed=att.handler_from_zip(att.bounded_archive(pinned))
                emit(name,inspect(source,deployed,name))
                count+=1
            except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
                print("FUNCTION:",name)
                print("TARGETED_LOGIC_REVIEW: NOT_VERIFIABLE")
        print("SOURCE_ARCHIVES_INSPECTED:",str(count)+"/5")
        print("V7_TARGETED_LOGIC_REVIEW: REVIEW_REQUIRED")
        print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
        print("DEVICE_TEST_AUTHORIZED: NO")
        return 0
    except (OSError,ValueError,subprocess.TimeoutExpired):
        print("V7_TARGETED_LOGIC_REVIEW: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":raise SystemExit(main())
