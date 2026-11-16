#!/usr/bin/env python3
"""V7 Staging semantic drift triage. GET-only. Outputs bounded classifications, no raw HTML/JS.
Never treats semantic compatibility as authorization to deploy or use real credits.
"""
import difflib
import importlib.util
import pathlib
import re
import urllib.error
import os
import subprocess

base=pathlib.Path(__file__).with_name("rr-v7-staging-hosting-parity-readonly.py")
spec=importlib.util.spec_from_file_location("v7base",base)
v7=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v7)
ASSETS=("index.html","firebase-packing-bridge.js")
REQUIRED_CALLABLES=frozenset(("reserveCredit","finalizeCredit","recordingStatus",
                             "recoverStaleVideoReservation","usageStatus"))
def endpoints(data):
    return frozenset(re.findall(r'api\(["\x27]([A-Za-z][A-Za-z0-9]*)["\x27]\)',data.decode("utf-8","replace")))
def scripts(data):
    text=data.decode("utf-8","replace")
    return frozenset(re.findall(r'<script\b[^>]*\bsrc=["\x27]([^"\x27]+)',text,re.I))
def diff_summary(local,remote):
    a=local.decode("utf-8","replace").splitlines()
    b=remote.decode("utf-8","replace").splitlines()
    changes=[(tag,i2-i1,j2-j1) for tag,i1,i2,j1,j2 in
             difflib.SequenceMatcher(a=a,b=b,autojunk=False).get_opcodes() if tag!="equal"]
    return len(changes),sum(x[1] for x in changes),sum(x[2] for x in changes)
def classify(name,local,remote):
    if local==remote:return ("MATCH",[])
    if name=="index.html":
        a,b=scripts(local),scripts(remote)
        if a!=b:
            return ("SCRIPT_TAGS_DIFFER",[
              "SCRIPT_REFERENCE_SET_MATCH: NO",
              "SOURCE_SCRIPT_REFERENCES: "+str(len(a)),
              "HOSTING_SCRIPT_REFERENCES: "+str(len(b))])
        return ("INDEX_CONTENT_DRIFT_SCRIPTS_MATCH",[
          "SCRIPT_REFERENCE_SET_MATCH: YES"])
    a,b=endpoints(local),endpoints(remote)
    missing=sorted(REQUIRED_CALLABLES-b)
    unexpected=sorted(b-a)
    removed=sorted(a-b)
    if missing:return ("REQUIRED_CALLABLES_MISSING",[
       "MISSING_REQUIRED_CALLABLES: "+",".join(missing)])
    if removed:return ("CALLABLES_REMOVED_FROM_HOSTING",[
       "REMOVED_CALLABLE_COUNT: "+str(len(removed))])
    return ("BRIDGE_ENDPOINTS_MATCH" if a==b else "BRIDGE_ENDPOINTS_EXTENDED",[
      "CALLABLE_SET_MATCH: "+("YES" if a==b else "NO"),
      "SOURCE_CALLABLE_COUNT: "+str(len(a)),
      "HOSTING_CALLABLE_COUNT: "+str(len(b)),
      "ADDED_CALLABLE_COUNT: "+str(len(unexpected))])
def run():
    code=2
    try:
        if os.environ.get("RR_STAGING_PROJECT_ID")!=v7.PROJECT:
            raise ValueError("STAGING_REQUIRED")
        if any(os.environ.get(k) for k in ("OMISE_SECRET_KEY","FIREBASE_TOKEN",
                       "GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID")):
            raise ValueError("UNSAFE_ENV")
        project=subprocess.check_output(["gcloud","config","get-value","project"],stderr=subprocess.DEVNULL,text=True).strip()
        if project!=v7.PROJECT:raise ValueError("PROJECT_MISMATCH")
        root=pathlib.Path(__file__).resolve().parents[2]/"firebase-staging"
        for name in ASSETS:
            print("CHECKING_ASSET:",name)
            try:
                a=(root/name).read_bytes()
                b=v7.fetch(v7.asset_url("https://packtook-staging.web.app",name))
                state,detail=classify(name,a,b)
                print("SEMANTIC_STATUS:",state)
                for line in detail:print(line)
                changes,old,new=diff_summary(a,b)
                print("CHANGED_LINE_BLOCKS:",changes)
                print("SOURCE_CHANGED_LINES:",old)
                print("HOSTING_CHANGED_LINES:",new)
            except (OSError,ValueError,urllib.error.URLError):
                print("SEMANTIC_STATUS: FETCH_OR_PARSE_BLOCKED")
                break
        print("V7_SEMANTIC_TRIAGE: INSPECT_ONLY")
    except (OSError,ValueError,subprocess.CalledProcessError):
        print("V7_SEMANTIC_TRIAGE: ENVIRONMENT_BLOCKED")
    finally:
        print("CLOUD_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")
    return code
if __name__=="__main__":raise SystemExit(run())
