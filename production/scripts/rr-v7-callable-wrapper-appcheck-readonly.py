#!/usr/bin/env python3
"""PACKTOOK V7 callable wrapper and App Check static review, Staging READ ONLY.

Reads immutable pinned source archive for two functions, passes source to
a TypeScript AST parser through subprocess stdin. Only fixed enum signals
are emitted. No source, keys, bucket names, URLs or digests in stdout.
"""
import argparse
import importlib.util
import json
import pathlib
import subprocess
import time

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("wrapper_att",HERE/"rr-v7-deployed-source-attestation-readonly.py")
att=importlib.util.module_from_spec(spec)
spec.loader.exec_module(att)
SCRIPT=HERE.parent/"ast-review"/"v7-callable-wrapper-security.cjs"
NAMES=("recordingStatus","usageStatus")
TOKEN_ENUMS={
 "callableCallee":("EXACT_CALLEE_TOKENS","DRIFT_CALLEE_TOKENS"),
 "callbackHeader":("EXACT_CALLBACK_HEADER_TOKENS","DRIFT_CALLBACK_HEADER_TOKENS"),
 "optionsArgument":("EXACT_OPTIONS_ARGUMENT_TOKENS","DRIFT_OPTIONS_ARGUMENT_TOKENS")
}
APP_ENUMS=("TRUE_LITERAL_IN_OPTIONS","FALSE_LITERAL_IN_OPTIONS",
           "NO_ENFORCEMENT_LITERAL_IN_OPTIONS","UNRESOLVED_OPTIONS","CONFLICTING_OPTIONS")
FIXED={"moduleEffects":"NOT_REVIEWED","backendEnforcement":"NOT_PROVEN",
       "functionalEquivalence":"NOT_PROVEN","functionGate":"REVIEW_REQUIRED"}

def analyze(local,remote,name,runner=subprocess.run):
    if name not in NAMES:raise ValueError("UNKNOWN_TARGET")
    request=json.dumps({"review":local.decode("utf-8","strict"),
                        "deployed":remote.decode("utf-8","strict"),"name":name})
    result=runner(["node",str(SCRIPT)],input=request,capture_output=True,
                  text=True,timeout=20,check=False)
    if result.returncode or len(result.stdout)>1800:raise ValueError("WRAPPER_PARSER_FAILED")
    try:r=json.loads(result.stdout)
    except (ValueError,TypeError):raise ValueError("WRAPPER_RESPONSE_INVALID") from None
    required=set(TOKEN_ENUMS)|{"name","sourceAppCheck","deployedAppCheck","directOnCallBoth"}|set(FIXED)
    if not isinstance(r,dict) or set(r)!=required or r["name"]!=name:
        raise ValueError("WRAPPER_SCHEMA_INVALID")
    if any(r[k] not in values for k,values in TOKEN_ENUMS.items()):
        raise ValueError("WRAPPER_TOKEN_ENUM_INVALID")
    if r["sourceAppCheck"] not in APP_ENUMS or r["deployedAppCheck"] not in APP_ENUMS:
        raise ValueError("WRAPPER_APP_ENUM_INVALID")
    if type(r["directOnCallBoth"]) is not bool:raise ValueError("WRAPPER_CALLEE_INVALID")
    if any(r[k]!=v for k,v in FIXED.items()):raise ValueError("WRAPPER_GATE_INVALID")
    return r

def emit(name,r):
    print("FUNCTION:",name)
    for key in ("callableCallee","callbackHeader","optionsArgument"):
        print(key.upper()+":",r[key])
    print("SOURCE_APP_CHECK_OPTION:",r["sourceAppCheck"])
    print("DEPLOYED_APP_CHECK_OPTION:",r["deployedAppCheck"])
    print("DIRECT_ONCALL_BOTH:",str(r["directOnCallBoth"]).upper())
    print("MODULE_EFFECTS:",r["moduleEffects"])
    print("BACKEND_APP_CHECK_ENFORCEMENT:",r["backendEnforcement"])
    print("FUNCTIONAL_EQUIVALENCE:",r["functionalEquivalence"])
    print("FUNCTION_GATE:",r["functionGate"])

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true")
    args=parser.parse_args()
    start=time.monotonic()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_WRAPPER_REVIEW: BLOCKED_EXPLICIT_INSPECTION_FLAG")
            return 2
        local=(HERE.parents[1]/"functions"/"index.js").read_bytes()
        passed=0
        for name in NAMES:
            try:
                pin=att.pinned_source(att.function_metadata(name))
                if pin is None:raise ValueError("UNPINNED_SOURCE")
                remote=att.handler_from_zip(att.bounded_archive(pin))
                emit(name,analyze(local,remote,name))
                passed+=1
            except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
                print("FUNCTION:",name)
                print("WRAPPER_REVIEW: NOT_VERIFIABLE")
        print("SOURCE_ARCHIVES_INSPECTED:",str(passed)+"/2")
        print("WRAPPER_REVIEW_WALL_MS:",round(1000*(time.monotonic()-start)))
        print("V7_WRAPPER_REVIEW: REVIEW_REQUIRED")
        print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
        print("DEVICE_TEST_AUTHORIZED: NO")
        return 0 if passed==len(NAMES) else 2
    except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
        print("V7_WRAPPER_REVIEW: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":raise SystemExit(main())
