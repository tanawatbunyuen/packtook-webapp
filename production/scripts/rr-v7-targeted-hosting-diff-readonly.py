#!/usr/bin/env python3
"""PACKTOOK V7 targeted Hosting diff: read-only, sanitized, no automatic compatibility pass."""
import difflib
import importlib.util
import os
import pathlib
import re
import subprocess
import urllib.error
BASE=pathlib.Path(__file__).with_name("rr-v7-staging-hosting-parity-readonly.py")
spec=importlib.util.spec_from_file_location("v7base",BASE)
v7=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v7)

ASSETS=("index.html","firebase-packing-bridge.js")
FEATURES={
 "APP_CHECK": ("initializeAppCheck","ReCaptchaEnterpriseProvider","appCheck"),
 "FIREBASE_CONFIG": ("firebaseConfig","initializeApp(","getFunctions("),
 "AUTH": ("onAuthStateChanged","onIdTokenChanged","signInWithEmailAndPassword","signOut","emailVerified"),
 "CREDIT": ("reserveCredit","finalizeCredit","recordingStatus","recoverStaleVideoReservation"),
 "FUNCTIONS_BRIDGE": ("httpsCallable","api(","window.PACKTOOK_FIREBASE"),
 "NETWORK": ("fetch(","XMLHttpRequest","sendBeacon"),
 "STORAGE": ("localStorage","sessionStorage","indexedDB"),
 "DEVICE": ("deviceId","registerDevice","removeDevice"),
}
SCRIPT_RE=re.compile(r'<script\b[^>]*\bsrc=["\x27]([^"\x27]+)',re.I)
def script_refs(data):
 text=data.decode("utf-8","replace")
 return SCRIPT_RE.findall(text)

def script_summary(local,remote):
 a=script_refs(local);b=script_refs(remote)
 def paths(xs):
  return [x.split("?",1)[0] for x in xs]
 if a==b: state="SCRIPT_REFERENCES_IDENTICAL"
 elif paths(a)==paths(b):state="SCRIPT_VERSION_QUERIES_DIFFER"
 elif sorted(paths(a))==sorted(paths(b)):state="SCRIPT_ORDER_DIFFER"
 else:state="SCRIPT_FILE_PATHS_DIFFER"
 return state, list(zip(a,b)) if len(a)==len(b) else []

def changed_lines(local,remote):
 a=local.decode("utf-8","replace").splitlines()
 b=remote.decode("utf-8","replace").splitlines()
 old=[];new=[]
 for tag,i,j,k,l in difflib.SequenceMatcher(a=a,b=b,autojunk=False).get_opcodes():
  if tag!="equal":
   old.extend(a[i:j]);new.extend(b[k:l])
 return old,new
def bridge_summary(local,remote):
 a,b=changed_lines(local,remote)
 result={}
 for name,needles in FEATURES.items():
  before=sum(any(word in row for word in needles) for row in a)
  after=sum(any(word in row for word in needles) for row in b)
  result[name]=(before,after)
 return result,len(a),len(b)
def main():
 try:
  if os.environ.get("RR_STAGING_PROJECT_ID")!="packtook-staging":
   raise ValueError("STAGING_REQUIRED")
  if any(os.environ.get(x) for x in ("OMISE_SECRET_KEY","FIREBASE_TOKEN",
          "GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID")):
   raise ValueError("UNSAFE_ENV")
  if subprocess.check_output(["gcloud","config","get-value","project"],text=True,
         stderr=subprocess.DEVNULL).strip()!="packtook-staging":
   raise ValueError("PROJECT_MISMATCH")
  root=pathlib.Path(__file__).resolve().parents[2]/"firebase-staging"
  for name in ASSETS:
   print("ASSET:",name)
   local=(root/name).read_bytes()
   remote=v7.fetch(v7.asset_url("https://packtook-staging.web.app",name))
   print("BYTE_IDENTICAL:",local==remote)
   if name=="index.html":
    state,pairs=script_summary(local,remote)
    print("SCRIPT_REFERENCE_DIAGNOSIS:",state)
    print("SCRIPT_COUNT_SOURCE:",len(script_refs(local)))
    print("SCRIPT_COUNT_HOSTING:",len(script_refs(remote)))
    if state=="SCRIPT_VERSION_QUERIES_DIFFER":
     print("DIFFERING_SCRIPT_POSITIONS:",",".join(str(i+1) for i,(a,b) in enumerate(pairs) if a!=b) or "NONE")
   else:
    feat,old,new=bridge_summary(local,remote)
    print("CHANGED_LINES_SOURCE:",old)
    print("CHANGED_LINES_HOSTING:",new)
    for k,(a,b) in feat.items():
     if a or b:print("CHANGED_CATEGORY_"+k+":",str(a)+"/"+str(b))
    print("UNREVIEWED_LOGIC_DIFF:", "YES" if local!=remote else "NO")
  print("V7_TARGETED_DIFF: INSPECT_ONLY")
 except (OSError,ValueError,subprocess.CalledProcessError,urllib.error.URLError):
  print("V7_TARGETED_DIFF: BLOCKED")
 finally:
  print("CLOUD_WRITES: 0")
  print("DEVICE_TEST_AUTHORIZED: NO")
  print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":main()
