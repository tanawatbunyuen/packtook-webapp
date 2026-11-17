#!/usr/bin/env python3
"""V7 scope reconciliation of deployed-source declaration deltas.

Staging immutable source ZIP reads only. Summary reports counts by fixed scope
and update kind, not deployed symbol names, lines, literals, hashes or paths.
Heuristic top-level layout segmentation. No AST or equivalence proof.
"""
import argparse
import importlib.util
import pathlib
import subprocess
from collections import Counter

HERE=pathlib.Path(__file__).resolve().parent
def load(file,name):
 spec=importlib.util.spec_from_file_location(name,HERE/file)
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 return m
att=load("rr-v7-deployed-source-attestation-readonly.py","scope_att")
old=load("rr-v7-deployment-delta-attribution-readonly.py","scope_attribution")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","scope_sem")

def scope(key):
 kind,name=key
 if kind=="exports" and name in att.NAMES:return "SELECTED_HANDLER"
 if kind=="function" and name in old.CRITICAL_HELPERS:return "CRITICAL_HELPER"
 if kind=="exports":return "OTHER_EXPORTED_FUNCTION"
 if kind=="function":return "OTHER_TOP_LEVEL_FUNCTION"
 if kind=="const":return "TOP_LEVEL_BINDING"
 return "MODULE_HEADER"

def operations(local,remote):
 a=old.regions(local)
 b=old.regions(remote)
 diff=[]
 for key in sorted(set(a)|set(b)):
  if key not in a:
   op="DEPLOYED_ONLY"
  elif key not in b:
   op="REVIEW_ONLY"
  elif a[key]==b[key]:
   continue
  else:
   op="MODIFIED"
  diff.append((scope(key),op))
 return diff

def detail(local,remote,name):
 ops=operations(local,remote)
 summary=Counter(ops)
 print("FUNCTION:",name)
 for kind in ("SELECTED_HANDLER","CRITICAL_HELPER","OTHER_EXPORTED_FUNCTION",
              "OTHER_TOP_LEVEL_FUNCTION","TOP_LEVEL_BINDING","MODULE_HEADER"):
  for op in ("MODIFIED","DEPLOYED_ONLY","REVIEW_ONLY"):
   print(kind+"_"+op+":",summary[kind,op])
 print("SELECTED_HANDLER_BODY:",
       "EXACT" if sem.handler(local,name)==sem.handler(remote,name) else "DRIFT")
 print("SOURCE_SCOPE_ATTRIBUTION: HEURISTIC_ONLY")
 print("FUNCTIONAL_EQUIVALENCE: NOT_PROVEN")
 print("FUNCTION_GATE: REVIEW_REQUIRED")

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--inspect-source",action="store_true")
 args=p.parse_args()
 try:
  att.guard()
  if not args.inspect_source:
   print("V7_SCOPE_RECONCILIATION: BLOCKED_EXPLICIT_INSPECTION")
   return 2
  local=(HERE.parents[1]/"functions"/"index.js").read_bytes()
  count=0
  for name in att.NAMES:
   try:
    meta=att.function_metadata(name)
    pin=att.pinned_source(meta)
    if pin is None:raise ValueError("PIN_REQUIRED")
    remote=att.handler_from_zip(att.bounded_archive(pin))
    detail(local,remote,name)
    count+=1
   except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
    print("FUNCTION:",name)
    print("SCOPE_RECONCILIATION: NOT_VERIFIABLE")
  print("SOURCE_ARCHIVES_INSPECTED:",str(count)+"/5")
  print("V7_SCOPE_RECONCILIATION: REVIEW_REQUIRED")
  print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
  print("DEVICE_TEST_AUTHORIZED: NO")
  return 0 if count==len(att.NAMES) else 2
 except (ValueError,OSError,subprocess.TimeoutExpired):
  print("V7_SCOPE_RECONCILIATION: BLOCKED_ENVIRONMENT")
  return 2
 finally:
  print("CLOUD_WRITES: 0")
  print("STAGING_CREDIT_WRITES: 0")
  print("PRODUCTION_WRITES: 0")
  print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":raise SystemExit(main())
