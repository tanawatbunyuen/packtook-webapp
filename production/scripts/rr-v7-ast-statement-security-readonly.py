#!/usr/bin/env python3
"""PACKTOOK V7 statement-level AST security review: Staging READ-ONLY.

Two selected callables only. Pinned source generation loaded into RAM.
Node TypeScript parser gets source over stdin; validated allowlist output only.
Never prints original/deployed JS, error texts, identifiers, tokens or hashes.
"""
import argparse
import importlib.util
import json
import pathlib
import subprocess
import time

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location(
    "statement_att",HERE/"rr-v7-deployed-source-attestation-readonly.py")
att=importlib.util.module_from_spec(spec);spec.loader.exec_module(att)
SCRIPT=HERE.parent/"ast-review"/"v7-ast-statement-security.cjs"
NAMES=("recordingStatus","usageStatus")
OPS=("MODIFIED","DEPLOYED_ONLY","REVIEW_ONLY")
TYPES=("VariableStatement","ExpressionStatement","IfStatement",
       "ReturnStatement","ThrowStatement","TryStatement","OtherStatement")
CATEGORIES=("AUTH_TENANCY","FIRESTORE_READ_PATH","INPUT_VALIDATION",
    "CREDIT_SUBSCRIPTION","ERROR_HANDLING","CONTROL_FLOW",
    "RESPONSE_CONTRACT","OTHER_EXECUTABLE")
STATUS=("EXACT_STATEMENT_TOKENS","DRIFT_REVIEW_REQUIRED")
COVERAGE=("NO_DIFFERENCES","HEURISTIC_SIGNALS_ONLY","AMBIGUOUS_STATEMENT_ALIGNMENT")

def check_counts(values,keys):
    if not isinstance(values,dict) or set(values)!=set(keys):
        raise ValueError("UNEXPECTED_FIELDS")
    if any(type(values[k]) is not int or not 0<=values[k]<=200 for k in keys):
        raise ValueError("INVALID_COUNTS")

def analyze(local,remote,name,runner=subprocess.run):
    if name not in NAMES:raise ValueError("SCOPE_FORBIDDEN")
    request=json.dumps({"review":local.decode("utf-8","strict"),
                        "deployed":remote.decode("utf-8","strict"),"name":name})
    result=runner(["node",str(SCRIPT)],input=request,
                  capture_output=True,text=True,timeout=20,check=False)
    if result.returncode or len(result.stdout)>2000:
        raise ValueError("AST_PARSER_FAILED")
    try:report=json.loads(result.stdout)
    except (ValueError,TypeError):raise ValueError("AST_RESPONSE_INVALID") from None
    if not isinstance(report,dict) or set(report)!={
        "name","status","operations","statementTypes","categories",
        "changedBlocks","ambiguousBlocks","categoryCoverage","conclusion"}:
        raise ValueError("AST_SCHEMA_INVALID")
    if report["name"]!=name or report["status"] not in STATUS or report["categoryCoverage"] not in COVERAGE:
        raise ValueError("AST_ENUM_INVALID")
    if report["conclusion"]!="FUNCTIONAL_EQUIVALENCE_NOT_PROVEN":
        raise ValueError("AST_GATE_INVALID")
    check_counts(report["operations"],OPS)
    check_counts(report["statementTypes"],TYPES)
    check_counts(report["categories"],CATEGORIES)
    if any(type(report[k]) is not int or not 0<=report[k]<=200
           for k in ("changedBlocks","ambiguousBlocks")):
        raise ValueError("AST_BLOCK_COUNT_INVALID")
    if sum(report["operations"].values())!=report["changedBlocks"]:
        raise ValueError("AST_OPERATION_SUM_MISMATCH")
    if report["ambiguousBlocks"]>report["changedBlocks"]:
        raise ValueError("AST_AMBIGUITY_INVALID")
    if report["status"]=="EXACT_STATEMENT_TOKENS" and report["changedBlocks"]!=0:
        raise ValueError("AST_EXACT_CONTRADICTION")
    if report["status"]=="DRIFT_REVIEW_REQUIRED" and report["changedBlocks"]==0:
        raise ValueError("AST_DRIFT_CONTRADICTION")
    return report

def emit(name,report):
    print("FUNCTION:",name)
    print("STATEMENT_AST_STATUS:",report["status"])
    print("STATEMENT_CHANGED_BLOCKS:",report["changedBlocks"])
    print("STATEMENT_AMBIGUOUS_BLOCKS:",report["ambiguousBlocks"])
    for cat in CATEGORIES:
        print("CATEGORY_"+cat+":",report["categories"][cat])
    for kind in OPS:
        print("DELTA_"+kind+":",report["operations"][kind])
    print("CATEGORY_COVERAGE:",report["categoryCoverage"])
    print("FUNCTIONAL_EQUIVALENCE: NOT_PROVEN")
    print("FUNCTION_GATE: REVIEW_REQUIRED")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true")
    args=parser.parse_args()
    start=time.monotonic()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_STATEMENT_SECURITY_REVIEW: BLOCKED_EXPLICIT_FLAG")
            return 2
        local=(HERE.parents[1]/"functions"/"index.js").read_bytes()
        checked=0
        for name in NAMES:
            try:
                pin=att.pinned_source(att.function_metadata(name))
                if pin is None:raise ValueError("UNPINNED_SOURCE")
                remote=att.handler_from_zip(att.bounded_archive(pin))
                emit(name,analyze(local,remote,name))
                checked+=1
            except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
                print("FUNCTION:",name)
                print("STATEMENT_SECURITY_REVIEW: NOT_VERIFIABLE")
        print("SOURCE_ARCHIVES_INSPECTED:",str(checked)+"/2")
        print("STATEMENT_REVIEW_WALL_MS:",round((time.monotonic()-start)*1000))
        print("V7_STATEMENT_SECURITY_REVIEW: REVIEW_REQUIRED")
        print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
        print("DEVICE_TEST_AUTHORIZED: NO")
        return 0 if checked==len(NAMES) else 2
    except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
        print("V7_STATEMENT_SECURITY_REVIEW: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":raise SystemExit(main())
