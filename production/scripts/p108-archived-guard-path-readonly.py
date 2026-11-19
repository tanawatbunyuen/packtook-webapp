#!/usr/bin/env python3
"""P108 scoped, redacted review of archived callable guard dependencies.
Never outputs raw source, strings, principal IDs or function metadata.
All source reads are Staging-only, opt-in, bounded by P107/P106.
Lexical guard indicators DO NOT prove security or deployed runtime parity.
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

def literal_match(src,pattern):
 return bool(re.search(pattern,src))

def inspect_archived(source,name):
 body=p106.exported_handler(source,name)
 if body is None:return {"handler":"NOT_LOCATED","appCheckOption":"NOT_LOCATED",
    "authPath":"NOT_LOCATED","authHelper":"NOT_LOCATED","usageResult":"NOT_LOCATED"}
 full=source.decode("utf-8")
 # Top-level option text is inspected only as a lexical hint; onCall(options)
 # can acquire effective options elsewhere or via CLI, so never prove App Check.
 prefix=body.split("async",1)[0][:350]
 if literal_match(prefix,r"\benforceAppCheck\s*:\s*true\b"):
  app="INLINE_TRUE_LITERAL"
 elif literal_match(prefix,r"\benforceAppCheck\s*:\s*false\b"):
  app="INLINE_FALSE_LITERAL"
 else:app="OPTION_NOT_INLINE"
 use_uid=literal_match(body,r"\buid\s*\(\s*req\s*\)")
 auth_direct=literal_match(body,r"\breq\.auth\b")
 use_ensure=literal_match(body,r"\bensureAccount\s*\(")
 uses_guarded=literal_match(body,r"\bassertAuthorized\s*\(|\bguardedCall\s*\(")
 if uses_guarded:auth="EXPLICIT_GUARD_REFERENCE"
 elif use_uid:auth="UID_HELPER_CALLED"
 elif auth_direct:auth="DIRECT_AUTH_REFERENCE"
 else:auth="NO_AUTH_REFERENCE_IN_BODY"
 # Only top-level helper presence; we do not claim that it is secure.
 uid_helper="UID_FUNCTION_FOUND" if literal_match(full,r"\b(?:async\s+)?function\s+uid\s*\(") else "UID_FUNCTION_NOT_FOUND"
 if name=="usageStatus":
  return_pattern=literal_match(body,r"\breturn\s*\{")
  spread=literal_match(body,r"\breturn\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(")
  uses_projection=literal_match(body,r"\b(?:usageResponse|usageStatusResponse|statusResponse)\s*\(")
  if return_pattern:result="INLINE_OBJECT_PRESENT"
  elif spread or uses_projection:result="INDIRECT_RETURN_PRESENT"
  else:result="OTHER_OR_NOT_IDENTIFIED"
 else:
  result="NOT_APPLICABLE"
 return {"handler":"FOUND",
  "appCheckOption":app,"authPath":auth,"authHelper":uid_helper,
  "ensureAccountUsed":use_ensure,"usageResult":result}

def compare_archives(archive,git,name):
 old=inspect_archived(archive,name)
 current=inspect_archived(git,name)
 return old,current

def inspect(reader=p106.call,local_path=p106.LOCAL,progress=lambda msg:None):
 progress("P108_STEP=PROJECT_GUARD")
 if reader(["gcloud","config","get-value","project"])!=p106.PROJECT:
  raise ValueError("P108_WRONG_ACTIVE_PROJECT")
 local=Path(local_path).read_bytes()
 if len(local)<1 or len(local)>p106.MAX_UNCOMPRESSED:
  raise ValueError("P108_LOCAL_SOURCE_INVALID")
 out=[]
 for i,name in enumerate(NAMES,1):
  progress(f"P108_STEP=ARCHIVE_{i}_OF_2")
  archived=p107.read_archive(reader,name,progress=lambda msg:progress("P108_CHILD_"+msg))
  out.append((name,*compare_archives(archived,local,name)))
 return out

def main():
 arg=argparse.ArgumentParser()
 arg.add_argument("--inspect",action="store_true")
 opts=arg.parse_args()
 if not opts.inspect:
  print("P108_EXPLICIT_OPERATOR_OPT_IN_REQUIRED");return 2
 try:
  result=inspect(progress=lambda msg:print(msg,flush=True))
  print("P108_PROJECT_GUARD=PASS_STAGING_ONLY")
  for name,old,git in result:
   print("FUNCTION="+name)
   print("P108_ARCHIVE_APP_CHECK_OPTION="+old["appCheckOption"])
   print("P108_ARCHIVE_AUTH_PATH="+old["authPath"])
   print("P108_ARCHIVE_UID_HELPER="+old["authHelper"])
   print("P108_ARCHIVE_ENSURE_ACCOUNT="+("YES" if old.get("ensureAccountUsed") else "NO"))
   print("P108_ARCHIVE_USAGE_RETURN="+old["usageResult"])
   print("P108_GIT_AUTH_PATH="+git["authPath"])
   print("P108_GIT_USAGE_RETURN="+git["usageResult"])
  print("P108_STATIC_INDICATORS_ONLY=YES")
  print("P108_RUNTIME_AUTH_EFFECTIVENESS=NOT_PROVEN")
  print("P108_RUNTIME_APP_CHECK_EFFECTIVENESS=NOT_PROVEN")
  print("P108_SOURCE_TO_RUNNING_REVISION=NOT_VERIFIED")
  print("P108_LEGACY_ACCOUNT_COMPATIBILITY=NOT_EQUIVALENT")
  print("P108_DEPLOY_PLAN=NOT_EXECUTED")
  print("P108_KNOWN_GOOD_RESTORE=NOT_VERIFIED")
  print("P108_RELEASE=NO_GO_RELEASE")
  return 0 if all(old["handler"]=="FOUND" for _,old,_ in result) else 2
 except (OSError,ValueError,TypeError,KeyError,UnicodeDecodeError,json.JSONDecodeError,zipfile.BadZipFile):
  print("P108_GUARD_PATH_CLASSIFICATION=NOT_VERIFIABLE")
  return 2
 finally:
  print("P108_CLOUD_WRITES=0")
  print("P108_IAM_CHANGES=0")
  print("P108_DEPLOY=0")
  print("P108_TRAFFIC_CHANGES=0")
if __name__=="__main__":
 sys.exit(main())
