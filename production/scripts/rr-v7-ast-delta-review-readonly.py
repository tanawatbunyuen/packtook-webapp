#!/usr/bin/env python3
"""V7 AST drift inspection on pinned Staging source in RAM only.

Exactly five metadata reads and five pinned source archive reads.
Parser subprocess receives private JavaScript via stdin, not command arguments,
files, CI artifacts or logs. Output is validated to an allowlist schema.
"""
import argparse
import importlib.util
import json
import pathlib
import subprocess
import time

HERE=pathlib.Path(__file__).resolve().parent
BASE=HERE/"rr-v7-deployed-source-attestation-readonly.py"
spec=importlib.util.spec_from_file_location("ast_att",BASE)
att=importlib.util.module_from_spec(spec);spec.loader.exec_module(att)
AST=HERE.parent/"ast-review"/"v7-ast-compare.cjs"
SCOPES=("SELECTED_HANDLER","CRITICAL_HELPER","OTHER_EXPORTED_FUNCTION",
        "OTHER_TOP_LEVEL_FUNCTION","TOP_LEVEL_BINDING","UNATTRIBUTED_STATEMENT")
OPS=("MODIFIED","DEPLOYED_ONLY","REVIEW_ONLY")
HANDLER=("EXACT_AST_TOKENS","DRIFT_AST_TOKENS","NOT_VERIFIABLE")

def analyze(local,deployed,name,runner=subprocess.run):
    data=json.dumps({"review":local.decode("utf-8","strict"),
                     "deployed":deployed.decode("utf-8","strict"),"name":name})
    result=runner(["node",str(AST)],input=data,text=True,capture_output=True,
                  timeout=15,check=False)
    if result.returncode or len(result.stdout)>3000:raise ValueError("AST_PROCESS_BLOCKED")
    try:payload=json.loads(result.stdout)
    except (ValueError,TypeError):raise ValueError("AST_RESPONSE_INVALID") from None
    if not isinstance(payload,dict) or payload.get("handler") not in HANDLER:
        raise ValueError("AST_RESPONSE_INVALID")
    counts=payload.get("counts")
    if not isinstance(counts,dict) or set(counts)!=set(SCOPES):
        raise ValueError("AST_COUNTS_INVALID")
    for scope in SCOPES:
        values=counts[scope]
        if not isinstance(values,dict) or set(values)!=set(OPS):
            raise ValueError("AST_OPERATION_INVALID")
        if any(type(values[k]) is not int or not (0<=values[k]<=2000) for k in OPS):
            raise ValueError("AST_COUNT_INVALID")
    for key in ("selectedCurrent","selectedOther"):
        value=payload.get(key)
        if not isinstance(value,dict) or set(value)!=set(OPS):
            raise ValueError("AST_SELECTED_SCOPE_INVALID")
        if any(type(value[o]) is not int or not (0<=value[o]<=2000) for o in OPS):
            raise ValueError("AST_SELECTED_COUNT_INVALID")
    for op in OPS:
        if (payload["selectedCurrent"][op]+payload["selectedOther"][op]
              !=counts["SELECTED_HANDLER"][op]):
            raise ValueError("AST_SELECTED_TOTAL_MISMATCH")
    return payload

def emit(name,report):
    print("FUNCTION:",name)
    print("HANDLER_AST_TOKENS:",report["handler"])
    for op in OPS:
        print("AST_CURRENT_HANDLER_"+op+":",report["selectedCurrent"][op])
        print("AST_OTHER_SELECTED_HANDLERS_"+op+":",report["selectedOther"][op])
    for scope in SCOPES:
        for op in OPS:
            print("AST_"+scope+"_"+op+":",report["counts"][scope][op])
    print("AST_IS_NOT_BEHAVIOR_PROOF: YES")
    print("FUNCTION_GATE: REVIEW_REQUIRED")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect-source",action="store_true")
    args=p.parse_args()
    t0=time.monotonic()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_AST_REVIEW: BLOCKED_EXPLICIT_INSPECTION")
            return 2
        local=(HERE.parents[1]/"functions"/"index.js").read_bytes()
        checked=0
        for name in att.NAMES:
            try:
                pin=att.pinned_source(att.function_metadata(name))
                if pin is None:raise ValueError("UNPINNED_SOURCE")
                deployed=att.handler_from_zip(att.bounded_archive(pin))
                report=analyze(local,deployed,name)
                emit(name,report)
                checked+=1
            except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
                print("FUNCTION:",name)
                print("AST_REVIEW: NOT_VERIFIABLE")
        print("SOURCE_ARCHIVES_INSPECTED:",str(checked)+"/5")
        print("AST_REVIEW_WALL_MS:",round(1000*(time.monotonic()-t0)))
        print("V7_AST_REVIEW: REVIEW_REQUIRED")
        print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
        print("DEVICE_TEST_AUTHORIZED: NO")
        return 0 if checked==5 else 2
    except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
        print("V7_AST_REVIEW: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":raise SystemExit(main())
