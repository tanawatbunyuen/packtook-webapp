#!/usr/bin/env python3
"""P109 read-only, redacted source dependency trace on current Staging ZIPs.

Static lexical indicators only. No execution of downloaded JS. No resource
names, source contents, hashes, raw errors, IAM or personal data in output.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import sys
import zipfile

HERE=Path(__file__).resolve()
spec=importlib.util.spec_from_file_location("p107",HERE.with_name("p107-staging-handler-drift-classify-readonly.py"))
p107=importlib.util.module_from_spec(spec);spec.loader.exec_module(p107)
p106=p107.p106
NAMES=p106.NAMES

def block(src,kind,name):
    """Find a standalone JS declaration; bounded to end-of-line or 4k chars.
    Lexical review only: braces within JS strings may make results ambiguous.
    """
    if kind=="function":
        pattern=rf"(?m)^\s*(?:async\s+)?function\s+{re.escape(name)}\s*\("
    elif kind=="const":
        pattern=rf"(?m)^\s*(?:const|let|var)\s+{re.escape(name)}\s*="
    else:raise ValueError("P109_INVALID_KIND")
    matches=list(re.finditer(pattern,src))
    if len(matches)!=1:return None
    start=matches[0].start()
    if kind=="const":
        return src[start:src.find("\n",start)+1][:4000] if "\n" in src[start:] else None
    open_brace=src.find("{",start,start+1000)
    if open_brace<0:return None
    depth=0
    for i in range(open_brace,min(len(src),start+4000)):
        if src[i]=="{":depth+=1
        elif src[i]=="}":
            depth-=1
            if depth==0:return src[start:i+1]
    return None

def options_class(src,handler):
    if handler is None:return "NOT_LOCATED"
    # Detect the exact variable used by onCall, not other helper options.
    prefix=handler[:260]
    var=re.search(r"=\s*onCall\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*,",prefix)
    if not var:return "NOT_SIMPLE_OPTIONS_IDENTIFIER"
    definition=block(src,"const",var.group(1))
    if not definition:return "SHARED_OPTIONS_NOT_LOCATED"
    if re.search(r"\benforceAppCheck\s*:\s*true\b",definition):return "SHARED_ENFORCE_TRUE_LITERAL"
    if re.search(r"\benforceAppCheck\s*:\s*false\b",definition):return "SHARED_ENFORCE_FALSE_LITERAL"
    if re.search(r"\benforceAppCheck\s*:",definition):return "SHARED_ENFORCE_DYNAMIC"
    return "SHARED_ENFORCE_NOT_DECLARED"

def uid_class(src):
    uid=block(src,"function","uid")
    if not uid:return {"present":"NOT_LOCATED","auth":"NOT_IDENTIFIED",
                       "verifiedEmail":"NOT_IDENTIFIED","membership":"NOT_IDENTIFIED"}
    auth="AUTH_REFERENCE_PRESENT" if re.search(r"\b(?:req\.auth|req\?\.auth)\b",uid) else "AUTH_REFERENCE_NOT_FOUND"
    verified="EMAIL_VERIFICATION_REFERENCE_PRESENT" if "email_verified" in uid or "emailVerified" in uid else "EMAIL_VERIFICATION_REFERENCE_NOT_FOUND"
    membership="CLAIM_OR_MEMBERSHIP_REFERENCE_PRESENT" if re.search(r"\bcustomClaims\b|\breq\.auth\.token\b|\breq\?\.auth\?\.token\b|\breq\.auth\?\.token\b",uid) else "CLAIM_OR_MEMBERSHIP_REFERENCE_NOT_FOUND"
    return {"present":"FOUND","auth":auth,"verifiedEmail":verified,"membership":membership}

def classification(source):
    try:src=source.decode("utf-8")
    except UnicodeDecodeError:raise ValueError("P109_BAD_UTF8") from None
    uid=uid_class(src)
    result={"uid":uid,"functions":{}}
    for name in NAMES:
        h=p106.exported_handler(source,name)
        result["functions"][name]={
            "handler":"FOUND" if h is not None else "NOT_LOCATED",
            "sharedOptions":options_class(src,h),
            "uidInvocation":"YES" if h is not None and re.search(r"\buid\s*\(\s*req\s*\)",h) else "NO"
        }
    return result

def inspect(reader=p106.call,progress=lambda x:None):
    progress("P109_STEP=PROJECT_GUARD")
    if reader(["gcloud","config","get-value","project"])!=p106.PROJECT:
        raise ValueError("P109_WRONG_PROJECT")
    rows=[]
    for i,name in enumerate(NAMES,1):
        progress(f"P109_STEP=ARCHIVE_{i}_OF_2")
        archive=p107.read_archive(reader,name,progress=lambda _:None)
        rows.append((name,classification(archive)))
    return rows

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect",action="store_true")
    args=parser.parse_args()
    if not args.inspect:
        print("P109_EXPLICIT_OPERATOR_OPT_IN_REQUIRED");return 2
    try:
        rows=inspect(progress=lambda x:print(x,flush=True))
        print("P109_PROJECT_GUARD=PASS_STAGING_ONLY")
        for name,result in rows:
            function=result["functions"][name]
            uid=result["uid"]
            print("FUNCTION="+name)
            print("P109_SHARED_OPTIONS_APP_CHECK="+function["sharedOptions"])
            print("P109_UID_HELPER="+uid["present"])
            print("P109_UID_AUTH_REFERENCE="+uid["auth"])
            print("P109_UID_VERIFIED_EMAIL_REFERENCE="+uid["verifiedEmail"])
            print("P109_UID_CLAIM_OR_MEMBERSHIP_REFERENCE="+uid["membership"])
            print("P109_HANDLER_UID_INVOCATION="+function["uidInvocation"])
        print("P109_CODE_REVIEW_ONLY=YES")
        print("P109_BACKEND_APP_CHECK=NOT_PROVEN")
        print("P109_AUTH_BYPASS=NOT_DEMONSTRATED")
        print("P109_SOURCE_TO_SERVING_REVISION=NOT_VERIFIED")
        print("P109_LEGACY_ACCOUNT_PARITY=NOT_EQUIVALENT")
        print("P109_DEPLOY=BLOCKED")
        return 0 if all(r["functions"][name]["handler"]=="FOUND" for name,r in rows) else 2
    except (ValueError,TypeError,OSError,KeyError,json.JSONDecodeError,zipfile.BadZipFile):
        print("P109_SHARED_GUARD_DEPENDENCIES=NOT_VERIFIABLE")
        return 2
    finally:
        print("P109_CLOUD_WRITES=0")
        print("P109_IAM_CHANGES=0")
        print("P109_TRAFFIC_CHANGES=0")
        print("P109_RELEASE=NO_GO_RELEASE")
if __name__=="__main__":
    sys.exit(main())
