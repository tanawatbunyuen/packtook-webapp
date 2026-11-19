#!/usr/bin/env python3
"""P106 bounded Staging-only CURRENT source-archive comparison, no writes.

Read exactly 2 Gen2 function build source archives (if GCS ZIP source).
Compare only in-memory index.js to checked-out Git source, and the
specific original status handler text. Never print resource names,
source content, object paths, credentials, hashes or CLI stderr.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile

PROJECT="packtook-staging"
REGION="asia-southeast1"
NAMES=("recordingStatus","usageStatus")
HERE=Path(__file__).resolve()
LOCAL=HERE.parents[1]/"functions"/"index.js"
MAX_DOWNLOAD=16000000
MAX_UNCOMPRESSED=4000000
BUCKET=re.compile(r"^[a-z0-9][a-z0-9._-]{2,222}$")
NAME=re.compile(r"^[^\\\x00-\x1f]+$")
BASE=f"projects/{PROJECT}/locations/{REGION}/functions/"

def call(args,timeout=14,binary=False):
 try:
  p=subprocess.run(args,capture_output=True,check=False,timeout=timeout)
 except subprocess.TimeoutExpired as exc:
  raise ValueError("P106_CLOUD_READ_TIMEOUT") from None
 if p.returncode!=0 or len(p.stdout)>MAX_DOWNLOAD:
  raise ValueError("P106_READ_NOT_AVAILABLE")
 return p.stdout if binary else p.stdout.decode("utf-8").strip()

def source_ref(fn,raw):
 meta=json.loads(raw)
 if not isinstance(meta,dict) or meta.get("name")!=BASE+fn or meta.get("environment")!="GEN_2":
  raise ValueError("P106_SCOPE")
 build=meta.get("buildConfig")
 if not isinstance(build,dict) or not isinstance(build.get("source"),dict):
  raise ValueError("P106_NO_GCS_SOURCE")
 store=build["source"].get("storageSource")
 if not isinstance(store,dict):raise ValueError("P106_NO_GCS_SOURCE")
 bucket=store.get("bucket")
 object_name=store.get("object")
 generation=store.get("generation")
 if not isinstance(bucket,str) or not BUCKET.fullmatch(bucket):
  raise ValueError("P106_BAD_BUCKET")
 if not isinstance(object_name,str) or not NAME.fullmatch(object_name) or len(object_name)>1500:
  raise ValueError("P106_BAD_OBJECT")
 if object_name.startswith("/") or any(s in (".","..") for s in object_name.split("/")):
  raise ValueError("P106_BAD_OBJECT")
 # Generation query syntax is not assumed safe without explicit provenance.
 if generation is not None and not re.fullmatch(r"[0-9]{1,32}",str(generation)):
  raise ValueError("P106_BAD_GENERATION")
 return bucket,object_name,generation

def archive_index(raw):
 if len(raw)>MAX_DOWNLOAD:raise ValueError("P106_OVERSIZE")
 with zipfile.ZipFile(io.BytesIO(raw)) as z:
  matches=[]
  for member in z.infolist():
   if member.filename in ("index.js","functions/index.js") and not member.is_dir():
    if member.file_size>MAX_UNCOMPRESSED or member.compress_size>MAX_DOWNLOAD:
     raise ValueError("P106_UNSAFE_ARCHIVE")
    matches.append(member)
  if len(matches)!=1:raise ValueError("P106_INDEX_UNAVAILABLE")
  return z.read(matches[0],pwd=None)

def exported_handler(source,fn):
 try:s=source.decode("utf-8")
 except UnicodeDecodeError:raise ValueError("P106_BAD_SOURCE_ENCODING") from None
 start=s.find("exports."+fn+"=")
 if start<0 or s.find("exports."+fn+"=",start+1)>=0:
  return None
 end=s.find("\n});",start)
 if end<0:return None
 return s[start:end+4].replace("\r\n","\n")

def compare(fn,remote,local):
 if not isinstance(remote,bytes) or not isinstance(local,bytes):raise ValueError("P106_BAD_CONTENT")
 full="MATCH" if hashlib.sha256(remote).digest()==hashlib.sha256(local).digest() else "DIFFERENT"
 a=exported_handler(remote,fn)
 b=exported_handler(local,fn)
 if a is None or b is None:handler="NOT_LOCATED"
 else:handler="MATCH" if a==b else "DIFFERENT"
 return full,handler

def inspect(reader=call,local_path=LOCAL,progress=lambda s:None):
 progress("P106_STEP=PROJECT_GUARD")
 if reader(["gcloud","config","get-value","project"])!=PROJECT:
  raise ValueError("P106_WRONG_ACTIVE_PROJECT")
 local=Path(local_path).read_bytes()
 if not local or len(local)>MAX_UNCOMPRESSED:
  raise ValueError("P106_LOCAL_SOURCE_UNAVAILABLE")
 result=[]
 for i,fn in enumerate(NAMES,1):
  progress(f"P106_STEP=FUNCTION_METADATA_{i}_OF_2")
  args=["gcloud","functions","describe",fn,"--gen2","--region",REGION,"--project",PROJECT,"--format=json"]
  bucket,obj,generation=source_ref(fn,reader(args))
  uri="gs://"+bucket+"/"+obj
  progress(f"P106_STEP=STORAGE_SIZE_{i}_OF_2")
  data=json.loads(reader(["gcloud","storage","objects","describe",uri,"--format=json"]))
  size=int(data.get("size",-1)) if isinstance(data,dict) else -1
  if size<1 or size>MAX_DOWNLOAD:
   raise ValueError("P106_STORAGE_SIZE_NOT_ALLOWED")
  if generation is not None and str(data.get("generation"))!=str(generation):
   raise ValueError("P106_STORAGE_GENERATION_DRIFT")
  progress(f"P106_STEP=READ_SOURCE_ZIP_{i}_OF_2")
  payload=reader(["gcloud","storage","cat",uri],timeout=24,binary=True)
  if len(payload)>MAX_DOWNLOAD:raise ValueError("P106_OVERSIZE")
  result.append(compare(fn,archive_index(payload),local))
 return result

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--inspect",action="store_true")
 args=p.parse_args()
 if not args.inspect:
  print("P106_EXPLICIT_OPERATOR_OPT_IN_REQUIRED");return 2
 try:
  rows=inspect(progress=lambda x:print(x,flush=True))
  print("P106_PROJECT_GUARD=PASS_STAGING_ONLY")
  for fn,(full,handler) in zip(NAMES,rows):
   print(f"FUNCTION={fn}")
   print("P106_FULL_INDEX_PARITY="+full)
   print("P106_STATUS_HANDLER_PARITY="+handler)
  print("P106_SOURCE_TO_DEPLOYED_REVISION=NOT_VERIFIED")
  print("P106_RUNTIME_APP_CHECK=NOT_PROVEN")
  print("P106_KNOWN_GOOD_ROLLBACK=NOT_VERIFIED")
  print("P106_DEPLOY=BLOCKED")
  return 0 if all(full=="MATCH" and handler=="MATCH" for full,handler in rows) else 2
 except (ValueError,OSError,TypeError,KeyError,json.JSONDecodeError,zipfile.BadZipFile,OverflowError):
  print("P106_SOURCE_ARCHIVE_PARITY=NOT_VERIFIABLE")
  return 2
 finally:
  print("P106_CLOUD_WRITES=0")
  print("P106_IAM_CHANGES=0")
  print("P106_TRAFFIC_CHANGES=0")
  print("P106_RELEASE=NO_GO_RELEASE")
if __name__=="__main__":
 sys.exit(main())
