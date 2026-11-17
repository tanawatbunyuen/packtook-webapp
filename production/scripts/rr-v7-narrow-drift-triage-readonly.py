#!/usr/bin/env python3
"""Staging-only V7 narrow drift triage, source archive RAM-only.

Machine-readable coarse evidence, NOT semantic or security equivalence.
Prints no raw changed lines, archive names, source, hashes, or secrets.
"""
import argparse
import difflib
import importlib.util
import pathlib
import re
import subprocess

DIR=pathlib.Path(__file__).resolve().parent
def load(path,alias):
 spec=importlib.util.spec_from_file_location(alias,DIR/path)
 module=importlib.util.module_from_spec(spec)
 spec.loader.exec_module(module)
 return module
att=load("rr-v7-deployed-source-attestation-readonly.py","attnarrow")
delta=load("rr-v7-scoped-handler-delta-readonly.py","deltanarrow")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","semnarrow")

# Conservative lexer: only reports token equality vs non-equality.
# Does not infer comment-only changes, no-ops, or JavaScript semantics.
TOKEN=re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+|[^\s]")
def token_equality(a,b):
 if a==b:return "EXACT"
 if TOKEN.findall(a)==TOKEN.findall(b):return "TOKEN_SEQUENCE_EQUAL_HEURISTIC"
 return "TOKEN_SEQUENCE_DIFFERENT"

def changed_line_profile(a,b):
 blocks=delta.changed(a,b)
 return {
   "blocks":len(blocks),
   "lexical":token_equality(a,b),
   "security_categories":delta.categories(blocks),
   "line_count_change":sum(len(y)-len(x) for x,y in blocks)
 }

def report_one(name,local,remote):
 ha=sem.handler(local,name)
 hb=sem.handler(remote,name)
 ma=delta.masked_module(local)
 mb=delta.masked_module(remote)
 h=changed_line_profile(ha,hb)
 s=changed_line_profile(ma,mb)
 print("FUNCTION:",name)
 print("HANDLER_LEXICAL:",h["lexical"])
 print("HANDLER_CHANGE_BLOCKS:",h["blocks"])
 print("HANDLER_CHANGE_LINE_DELTA:",h["line_count_change"])
 print("HANDLER_SENSITIVE_CATEGORIES:",",".join(h["security_categories"]) or "NONE_DETECTED")
 print("SHARED_MODULE_LEXICAL:",s["lexical"])
 print("SHARED_CHANGE_BLOCKS:",s["blocks"])
 print("SHARED_CHANGE_LINE_DELTA:",s["line_count_change"])
 print("SHARED_SENSITIVE_CATEGORIES:",",".join(s["security_categories"]) or "NONE_DETECTED")
 print("TOKEN_EQUALITY_IS_SEMANTIC_PROOF: NO")

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument("--inspect-source",action="store_true")
 args=parser.parse_args()
 try:
  att.guard()
  if not args.inspect_source:
   print("V7_NARROW_DIFF: BLOCKED_SOURCE_FLAG_REQUIRED")
   return 2
  base=DIR.parents[1]/"functions"/"index.js"
  local=base.read_bytes()
  for name in att.NAMES:
   try:
    info=att.function_metadata(name)
    pinned=att.pinned_source(info)
    if pinned is None:raise ValueError("MISSING_PINNED_SOURCE")
    remote=att.handler_from_zip(att.bounded_archive(pinned))
    report_one(name,local,remote)
   except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
    print("FUNCTION:",name)
    print("NARROW_DIFF: NOT_VERIFIABLE")
  print("V7_NARROW_DIFF: REVIEW_REQUIRED")
  print("HANDLER_BEHAVIOR_EQUIVALENCE: NOT_PROVEN")
  print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
  return 0
 except (ValueError,OSError,subprocess.TimeoutExpired):
  print("V7_NARROW_DIFF: BLOCKED_ENVIRONMENT")
  return 2
 finally:
  print("CLOUD_WRITES: 0")
  print("STAGING_CREDIT_WRITES: 0")
  print("PRODUCTION_WRITES: 0")
  print("DEVICE_TEST_AUTHORIZED: NO")
  print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":raise SystemExit(main())
