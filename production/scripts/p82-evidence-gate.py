#!/usr/bin/env python3
"""P82 offline evidence classifier; never accesses cloud or accepts a release override."""
import argparse
import pathlib
import sys

TARGETS=("recordingStatus","usageStatus")
STATES=("MATCH_REVIEW_ONLY","DRIFT_REVIEW_REQUIRED","NOT_VERIFIABLE")

def classify(raw):
    if not isinstance(raw,str) or len(raw)>18000:raise ValueError("BAD_REPORT")
    functions={}; fields={}; current=None
    for line in map(str.strip,raw.splitlines()):
        if line.startswith("FUNCTION="):
            current=line.split("=",1)[1]
            if current not in TARGETS or current in functions:raise ValueError("BAD_FUNCTION")
            functions[current]=None
        elif line.startswith("GUARDED_SOURCE="):
            if current is None or functions[current] is not None:raise ValueError("BAD_GUARD")
            state=line.split("=",1)[1]
            if state not in STATES:raise ValueError("UNKNOWN_GUARD")
            functions[current]=state
        elif line=="P80_DIAGNOSTIC_COMPLETE":
            if "P80_DIAGNOSTIC_COMPLETE" in fields:raise ValueError("DUPLICATE_MARKER")
            fields["P80_DIAGNOSTIC_COMPLETE"]=""
        elif line.startswith("P80_"):
            key,sep,value=line.partition("=")
            if not sep or key in fields:raise ValueError("BAD_FIELD")
            fields[key]=value
    required=("P80_ALL_FIVE_REVISION_STABLE","P80_GUARD_SOURCE_GATE","P80_BACKEND_APP_CHECK",
        "P80_IAM_LEAST_PRIVILEGE","P80_CLOUD_WRITES","P80_DEPLOY","P80_RELEASE",
        "P80_EXIT_CODE","P80_DIAGNOSTIC_COMPLETE")
    if any(x not in fields for x in required) or set(functions)!=set(TARGETS) or any(x is None for x in functions.values()):
        raise ValueError("INCOMPLETE")
    if (fields["P80_BACKEND_APP_CHECK"],fields["P80_IAM_LEAST_PRIVILEGE"])!=("NOT_PROVEN","NOT_VERIFIED"):
        raise ValueError("SECURITY_CLAIM_UNEXPECTED")
    if (fields["P80_CLOUD_WRITES"],fields["P80_DEPLOY"],fields["P80_RELEASE"])!=("0","0","NO_GO_RELEASE"):
        raise ValueError("SAFETY_CLAIM_UNEXPECTED")
    if fields["P80_ALL_FIVE_REVISION_STABLE"] not in ("YES","NOT_VERIFIABLE"):raise ValueError("BAD_STABILITY")
    stable=fields["P80_ALL_FIVE_REVISION_STABLE"]=="YES"
    match=stable and all(v=="MATCH_REVIEW_ONLY" for v in functions.values())
    expected="MATCH_REVIEW_ONLY" if match else "REVIEW_REQUIRED"
    if fields["P80_GUARD_SOURCE_GATE"]!=expected or fields["P80_EXIT_CODE"]!=("0" if match else "2"):
        raise ValueError("CONTRADICTORY_RESULT")
    return dict(stable=stable,functions=functions,guard=expected,appcheck="NOT_PROVEN",
                iam="NOT_VERIFIED",release="NO_GO_RELEASE")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--p80-output",type=pathlib.Path,required=True)
    args=p.parse_args()
    try:r=classify(args.p80_output.read_text(encoding="utf8"))
    except (OSError,UnicodeError,ValueError):
        print("P82_EVIDENCE=NOT_VERIFIABLE")
        print("P82_RELEASE=NO_GO_RELEASE")
        return 2
    print("P82_EVIDENCE=PARSED")
    print("P82_REVISION_STABLE="+("YES" if r["stable"] else "NOT_VERIFIABLE"))
    for name in TARGETS:print("P82_"+name+"_GUARD="+r["functions"][name])
    print("P82_SOURCE_GUARD="+r["guard"])
    print("P82_DEPLOYED_APP_CHECK=NOT_PROVEN")
    print("P82_IAM_LEAST_PRIVILEGE=NOT_VERIFIED")
    print("P82_CLOUD_WRITES=0")
    print("P82_DEPLOY=0")
    print("P82_RELEASE=NO_GO_RELEASE")
    return 0 if r["stable"] else 2

if __name__=="__main__":sys.exit(main())
