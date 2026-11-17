#!/usr/bin/env python3
"""V7 scoped delta triage: conservative comparison of deployed function source.
Staging only. No raw source, secrets, hashes, archive paths or diff content printed.
Output is a static signal requiring human review, not behavioral attestation.
"""
import argparse
import difflib
import importlib.util
import pathlib
import subprocess

ROOT=pathlib.Path(__file__).resolve().parent
def load(name,alias):
 p=ROOT/name
 spec=importlib.util.spec_from_file_location(alias,p)
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 return m
att=load("rr-v7-deployed-source-attestation-readonly.py","v7archive")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","v7sem")
NAMES=att.NAMES
FIELDS={
 "AUTH_TENANCY":("uid(req)","ownerRef(","ensureAccount(","req.auth"),
 "DEVICE_CONTROL":("validDevice(","deviceId","registerDevice"),
 "CREDIT_ACCOUNTING":("walletEnabled(","creditAvailable(","reserved","creditReturned"),
 "IDEMPOTENCY":("idempotent","r.status","already finalized"),
 "RECOVERY_SAFETY":("confirmNoVideo","STALE_RESERVATION_MS","recoveryReason"),
 "DATA_CONTRACT":("return {","recordingId","file:","remaining:","period:"),
 "APP_CHECK":("enforceAppCheck","req.app","appCheck"),
}
def changed(a,b):
 x=a.splitlines();y=b.splitlines()
 blocks=[]
 for tag,i,j,k,l in difflib.SequenceMatcher(a=x,b=y,autojunk=False).get_opcodes():
  if tag!="equal":blocks.append((x[i:j],y[k:l]))
 return blocks

def categories(blocks):
 found=[]
 for group,words in FIELDS.items():
  if any(any(word in line for word in words) for a,b in blocks for line in a+b):
   found.append(group)
 return found

def masked_module(code):
 s=code.decode("utf-8","strict")
 for name in NAMES:
  body=sem.handler(code,name)
  if s.count(body)!=1:raise ValueError("DUPLICATE_HANDLER")
  s=s.replace(body,"<HANDLER_REDACTED>",1)
 return s

def analyze(local,remote,name):
 a=sem.handler(local,name);b=sem.handler(remote,name)
 blocks=changed(a,b)
 result={
  "handler":"MATCH" if a==b else "DRIFT",
  "changed_blocks":len(blocks),
  "removed_lines":sum(len(x) for x,_ in blocks),
  "added_lines":sum(len(y) for _,y in blocks),
  "categories":categories(blocks),
 }
 outside=changed(masked_module(local),masked_module(remote))
 result["shared_module"]="MATCH" if not outside else "DRIFT"
 result["shared_changed_blocks"]=len(outside)
 result["shared_categories"]=categories(outside)
 return result

def run():
 parser=argparse.ArgumentParser()
 parser.add_argument("--inspect-source",action="store_true")
 args=parser.parse_args()
 try:
  att.guard()
  if not args.inspect_source:
   print("V7_SCOPED_DIFF: BLOCKED_EXPLICIT_SOURCE_FLAG")
   return 2
  local=(ROOT.parents[1]/"functions"/"index.js").read_bytes()
  for name in NAMES:
   print("FUNCTION:",name)
   try:
    meta=att.function_metadata(name)
    src=att.pinned_source(meta)
    if src is None:raise ValueError("SOURCE_UNPINNED")
    remote=att.handler_from_zip(att.bounded_archive(src))
    r=analyze(local,remote,name)
    print("HANDLER:",r["handler"])
    print("CHANGED_BLOCKS:",r["changed_blocks"])
    print("LINES_REMOVED:",r["removed_lines"])
    print("LINES_ADDED:",r["added_lines"])
    print("CHANGED_CATEGORIES:",",".join(r["categories"]) or "NONE_IDENTIFIED")
    print("SHARED_MODULE:",r["shared_module"])
    print("SHARED_CHANGE_BLOCKS:",r["shared_changed_blocks"])
    print("SHARED_CATEGORIES:",",".join(r["shared_categories"]) or "NONE_IDENTIFIED")
   except (OSError,ValueError,UnicodeError,subprocess.TimeoutExpired):
    print("HANDLER: NOT_VERIFIABLE")
  print("STATIC_CHANGE_CLASSIFICATION: HEURISTIC_ONLY")
  print("FUNCTIONAL_EQUIVALENCE: NOT_PROVEN")
  print("APP_CHECK_ENFORCEMENT: NOT_PROVEN")
  print("V7_SCOPED_DIFF: REVIEW_REQUIRED")
  return 0
 except (OSError,ValueError,subprocess.TimeoutExpired):
  print("V7_SCOPED_DIFF: BLOCKED_ENVIRONMENT")
  return 2
 finally:
  print("CLOUD_WRITES: 0")
  print("STAGING_CREDIT_WRITES: 0")
  print("PRODUCTION_WRITES: 0")
  print("DEVICE_TEST_AUTHORIZED: NO")
  print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":raise SystemExit(run())
