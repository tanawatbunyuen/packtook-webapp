#!/usr/bin/env python3
"""V7 final security/response review: Staging Source ZIP reads only.

Conservative scoped evidence, not JS AST, semantic equivalence or runtime
App Check. Reports fixed-category labels only; no source, literals, identifiers
from deployed source, hashes, raw exceptions or archive names.
"""
import argparse
import importlib.util
import pathlib
import re
import subprocess

HERE=pathlib.Path(__file__).resolve().parent
def load(file,alias):
 spec=importlib.util.spec_from_file_location(alias,HERE/file)
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 return m
att=load("rr-v7-deployed-source-attestation-readonly.py","attfinal")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","semfinal")
delta=load("rr-v7-scoped-handler-delta-readonly.py","deltafinal")
impact=load("rr-v7-helper-impact-readonly.py","impactfinal")

EXPECTED={
 "recordingStatus":("recordingId","status","barcode","period","file"),
 "usageStatus":("plan","limit","used","reserved","remaining","walletEnabled",
    "walletStartingCredits","period","openBillingRequestId","canBuyMore",
    "purchaseReason","planExpiresAt","subscriptionStatus"),
}
RISK_PATTERNS={
 "AUTH_TENANCY":r"\b(?:uid|ownerRef|ensureAccount|accountIdFor|req\.auth|permission-denied)\b",
 "CREDIT_ACCOUNTING":r"\b(?:creditAvailable|pendingReservations|walletEnabled|used|reserved|walletStartingCredits)\b",
 "RESPONSE_CONTRACT":r"\b(?:return|plan|status|remaining|barcode|period|file|recordingId)\b",
 "ERROR_CONTRACT":r"\b(?:throw|HttpsError|not-found|invalid-argument|failed-precondition)\b",
 "APP_CHECK":r"\b(?:enforceAppCheck|appCheck)\b",
}
# We report only allowlisted response keys, not user-defined keys from source.
def field_signals(handler,name):
 expected=EXPECTED[name]
 keys={}
 # Lexical return-object hint only. Detect explicit property assignment
 # and shorthand properties inside one return line.
 # This is NOT a JS AST and cannot prove actual response shape.
 lines=[x for x in handler.splitlines() if "return {" in x]
 for field in expected:
  escaped=re.escape(field)
  explicit=r"(?<![A-Za-z0-9_$])"+escaped+r"\s*:"
  shorthand=r"(?:\{|,)\s*"+escaped+r"\s*(?=,|\})"
  keys[field]=any(bool(re.search(explicit,line) or re.search(shorthand,line))
                  for line in lines)
 return keys

def changed_category(blocks):
 text="\n".join(line for a,b in blocks for line in a+b)
 return tuple(k for k,p in RISK_PATTERNS.items() if re.search(p,text))

def review(local,remote,name):
 a=sem.handler(local,name);b=sem.handler(remote,name)
 blocks=delta.changed(a,b)
 result={"handler_match":a==b,"changed_blocks":len(blocks),
         "categories":changed_category(blocks),
         "shared_match":delta.masked_module(local)==delta.masked_module(remote)}
 if name in EXPECTED:
  f1=field_signals(a,name);f2=field_signals(b,name)
  result["missing_local"]=tuple(k for k,v in f1.items() if not v)
  result["missing_deployed"]=tuple(k for k,v in f2.items() if not v)
  result["signals_changed"]=tuple(k for k in EXPECTED[name] if f1[k]!=f2[k])
 else:
  result["missing_local"]=()
  result["missing_deployed"]=()
  result["signals_changed"]=()
 return result

def emit(name,r):
 print("FUNCTION:",name)
 print("HANDLER_BODY:", "MATCH" if r["handler_match"] else "DRIFT")
 print("HANDLER_CHANGED_BLOCKS:",r["changed_blocks"])
 print("CHANGED_RISK_CATEGORIES:",",".join(r["categories"]) or "NONE_IDENTIFIED")
 print("SHARED_MODULE:", "MATCH" if r["shared_match"] else "DRIFT")
 if name in EXPECTED:
  print("EXPECTED_RESPONSE_KEYS_CHECKED:",len(EXPECTED[name]))
  print("EXPECTED_KEYS_MISSING_IN_REVIEW:",len(r["missing_local"]))
  print("EXPECTED_KEYS_MISSING_IN_DEPLOYED:",len(r["missing_deployed"]))
  print("EXPECTED_KEY_PRESENCE_CHANGED:",len(r["signals_changed"]))
  if r["signals_changed"]:
   print("CHANGED_ALLOWLISTED_KEY_SIGNALS:",",".join(r["signals_changed"]))
  print("RESPONSE_CONTRACT_EQUIVALENCE: NOT_PROVEN")
 print("SEMANTIC_EQUIVALENCE: NOT_PROVEN")

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument("--inspect-source",action="store_true")
 a=parser.parse_args()
 try:
  att.guard()
  if not a.inspect_source:
   print("V7_FINAL_REVIEW: BLOCKED_EXPLICIT_SOURCE_FLAG_REQUIRED")
   return 2
  local=(HERE.parents[1]/"functions"/"index.js").read_bytes()
  count=0
  for name in att.NAMES:
   try:
    meta=att.function_metadata(name)
    pinned=att.pinned_source(meta)
    if pinned is None:raise ValueError("PINNED_SOURCE_REQUIRED")
    remote=att.handler_from_zip(att.bounded_archive(pinned))
    emit(name,review(local,remote,name))
    count+=1
   except (ValueError,UnicodeError,OSError,subprocess.TimeoutExpired):
    print("FUNCTION:",name)
    print("FINAL_REVIEW: NOT_VERIFIABLE")
  print("SOURCE_ARCHIVES_INSPECTED:",str(count)+"/5")
  print("V7_FINAL_REVIEW: REVIEW_REQUIRED")
  print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
  print("DEVICE_TEST_AUTHORIZED: NO")
  return 0
 except (OSError,ValueError,subprocess.TimeoutExpired):
  print("V7_FINAL_REVIEW: BLOCKED_ENVIRONMENT")
  return 2
 finally:
  print("CLOUD_WRITES: 0")
  print("STAGING_CREDIT_WRITES: 0")
  print("PRODUCTION_WRITES: 0")
  print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":raise SystemExit(main())
