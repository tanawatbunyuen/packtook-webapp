#!/usr/bin/env python3
"""P107: redacted, scoped status-handler drift classification.

This does NOT assess the effective security of deployed runtime handlers.
It reads ONLY current Staging build source archives for two status functions
and emits boolean/enum structural indicators, not source or raw differences.
Cloud reads require explicit --inspect.
"""
import argparse
import difflib
import importlib.util
import json
from pathlib import Path
import re
import sys
import zipfile

HERE=Path(__file__).resolve()
PREVIOUS=HERE.with_name("p106-staging-status-source-parity-readonly.py")
spec=importlib.util.spec_from_file_location("p106",PREVIOUS)
p106=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p106)

STATUS=p106.NAMES
# Metadata indicators and wrapper classification, not authorization evidence.
KNOWN_USAGE_FIELDS=("plan","limit","used","reserved","remaining",
 "walletEnabled","walletStartingCredits","period","openBillingRequestId",
 "canBuyMore","purchaseReason","planExpiresAt","subscriptionStatus")

def wrapper(body,fn):
 if body is None:return "NOT_LOCATED"
 prefix=body[:160].replace(" ","").replace("\n","")
 if prefix.startswith("exports."+fn+"=guardedCall("):return "GUARDED_CALL"
 if prefix.startswith("exports."+fn+"=onCall("):return "ON_CALL"
 return "OTHER_WRAPPER"

def classify(body,fn):
 if body is None:return {"wrapper":"NOT_LOCATED","ownerPath":"NOT_LOCATED",
  "usesEnsureAccount":False,"outputFieldPresence":"NOT_LOCATED"}
 wrap=wrapper(body,fn)
 ensure=bool(re.search(r"\bensureAccount\s*\(",body))
 if "ownerRef(" in body:owner="OWNER_REF"
 elif re.search(r'collection\s*\(\s*["\']accounts["\']\s*\)',body):
  owner="DIRECT_ACCOUNTS"
 else:owner="OTHER_OR_INDIRECT"
 if fn=="usageStatus":
  present=sum(bool(re.search(r"\b"+field+r"\s*:",body)) for field in KNOWN_USAGE_FIELDS)
  fields=("ALL_13_STATIC_FIELDS_PRESENT" if present==13 else
    "SOME_STATIC_FIELDS_PRESENT" if present>0 else "STATIC_FIELDS_NOT_DETECTED")
 else:
  expected=("recordingId","status","barcode","period","file")
  n=sum(bool(re.search(r"\b"+field+r"\s*:",body)) for field in expected)
  fields="ALL_5_STATIC_FIELDS_PRESENT" if n==5 else (
    "SOME_STATIC_FIELDS_PRESENT" if n>0 else "STATIC_FIELDS_NOT_DETECTED")
 return {"wrapper":wrap,"ownerPath":owner,
         "usesEnsureAccount":ensure,"outputFieldPresence":fields}

def similarity_class(left,right):
 if left is None or right is None:return "NOT_COMPARABLE"
 # Ratio is a coarse diagnostic only; whitespace/comments can skew it.
 ratio=difflib.SequenceMatcher(a=left,b=right,autojunk=False).ratio()
 return ("OVER_90_PERCENT_TEXT" if ratio>=0.9 else
         "50_TO_90_PERCENT_TEXT" if ratio>=0.5 else
         "UNDER_50_PERCENT_TEXT")

def compare(fn,archived,local):
 a=p106.exported_handler(archived,fn)
 b=p106.exported_handler(local,fn)
 old=classify(a,fn)
 git=classify(b,fn)
 return {"archived":old,"git":git,
  "wrapperSame":old["wrapper"]==git["wrapper"],
  "accountPathSame":old["ownerPath"]==git["ownerPath"],
  "textSimilarity":similarity_class(a,b),
  "handlerTextMatch":a is not None and a==b}

def read_archive(reader,fn,progress):
 progress("P107_STEP="+fn+"_METADATA")
 args=["gcloud","functions","describe",fn,"--gen2","--region",p106.REGION,
       "--project",p106.PROJECT,"--format=json"]
 bucket,obj,generation=p106.source_ref(fn,reader(args))
 uri="gs://"+bucket+"/"+obj
 progress("P107_STEP="+fn+"_OBJECT_METADATA")
 before=json.loads(reader(["gcloud","storage","objects","describe",uri,"--format=json"]))
 if not isinstance(before,dict):raise ValueError("P107_BAD_METADATA")
 size=before.get("size")
 if not isinstance(size,(str,int)) or not str(size).isdigit() or not 1<=int(size)<=p106.MAX_DOWNLOAD:
  raise ValueError("P107_SIZE_SCOPE")
 gen=before.get("generation")
 if generation is not None and str(gen)!=str(generation):
  raise ValueError("P107_GENERATION_MISMATCH")
 if gen is None:raise ValueError("P107_GENERATION_NOT_VERIFIABLE")
 progress("P107_STEP="+fn+"_IN_MEMORY_ZIP")
 raw=reader(["gcloud","storage","cat",uri],timeout=24,binary=True)
 if not isinstance(raw,bytes):raise ValueError("P107_BINARY_REQUIRED")
 progress("P107_STEP="+fn+"_POST_READ_STABILITY")
 after=json.loads(reader(["gcloud","storage","objects","describe",uri,"--format=json"]))
 if not isinstance(after,dict) or str(after.get("generation"))!=str(gen) or str(after.get("size"))!=str(size):
  raise ValueError("P107_GENERATION_CHANGED")
 return p106.archive_index(raw)

def inspect(reader=p106.call,local_path=p106.LOCAL,progress=lambda x:None):
 progress("P107_STEP=PROJECT_GUARD")
 if reader(["gcloud","config","get-value","project"])!=p106.PROJECT:
  raise ValueError("P107_WRONG_PROJECT")
 local=Path(local_path).read_bytes()
 if not local or len(local)>p106.MAX_UNCOMPRESSED:raise ValueError("P107_INVALID_LOCAL_SOURCE")
 results=[]
 for fn in STATUS:
  archived=read_archive(reader,fn,progress)
  results.append((fn,compare(fn,archived,local)))
 return results

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--inspect",action="store_true")
 args=p.parse_args()
 if not args.inspect:
  print("P107_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
  return 2
 try:
  result=inspect(progress=lambda msg:print(msg,flush=True))
  print("P107_PROJECT_GUARD=PASS_STAGING_ONLY")
  for fn,summary in result:
   print("FUNCTION="+fn)
   print("P107_ARCHIVED_HANDLER_WRAPPER="+summary["archived"]["wrapper"])
   print("P107_GIT_HANDLER_WRAPPER="+summary["git"]["wrapper"])
   print("P107_WRAPPER_SAME="+("YES" if summary["wrapperSame"] else "NO"))
   print("P107_ARCHIVED_ACCOUNT_PATH="+summary["archived"]["ownerPath"])
   print("P107_GIT_ACCOUNT_PATH="+summary["git"]["ownerPath"])
   print("P107_ARCHIVED_ENSURE_ACCOUNT="+("YES" if summary["archived"]["usesEnsureAccount"] else "NO"))
   print("P107_GIT_ENSURE_ACCOUNT="+("YES" if summary["git"]["usesEnsureAccount"] else "NO"))
   print("P107_ARCHIVED_OUTPUT_FIELDS="+summary["archived"]["outputFieldPresence"])
   print("P107_TEXT_SIMILARITY_BUCKET="+summary["textSimilarity"])
   print("P107_HANDLER_TEXT_MATCH="+("YES" if summary["handlerTextMatch"] else "NO"))
  print("P107_SECURITY_GUARD_EFFECTIVENESS=NOT_PROVEN")
  print("P107_SOURCE_TO_RUNNING_REVISION=NOT_VERIFIED")
  print("P107_DEPLOY_PLAN=NOT_EXECUTED")
  print("P107_KNOWN_GOOD_RESTORE=NOT_VERIFIED")
  print("P107_RELEASE=NO_GO_RELEASE")
  return 0 if all(x["archived"]["wrapper"]!="NOT_LOCATED" for _,x in result) else 2
 except (ValueError,OSError,TypeError,KeyError,json.JSONDecodeError,zipfile.BadZipFile):
  print("P107_HANDLER_DRIFT_CLASSIFICATION=NOT_VERIFIABLE")
  return 2
 finally:
  print("P107_CLOUD_WRITES=0")
  print("P107_IAM_CHANGES=0")
  print("P107_DEPLOY=0")
  print("P107_TRAFFIC_CHANGES=0")
if __name__=="__main__":
 sys.exit(main())
