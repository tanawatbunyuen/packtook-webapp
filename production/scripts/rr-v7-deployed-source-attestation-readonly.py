#!/usr/bin/env python3
"""PACKTOOK V7 source attestation candidate, Staging ONLY, no cloud writes.

Read deployed gen2 source ZIP using its *pinned GCS object generation* into RAM,
never persist or display source, credentials, bucket names, or raw errors.
Byte comparison is limited to exact archive members index.js / functions/index.js.
Static 'enforceAppCheck' hints are NOT runtime/backend enforcement proof.
No GitHub or Production remote reads. Fail closed, keep release NO_GO.
"""
import argparse
import hashlib
import io
import json
import os
import pathlib
import re
import subprocess
import zipfile

PROJECT="packtook-staging"
REGION="asia-southeast1"
NAMES=("reserveCredit","finalizeCredit","recordingStatus",
       "recoverStaleVideoReservation","usageStatus")
SENSITIVE=("OMISE_SECRET_KEY","FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS",
           "PACKTOOK_PRODUCTION_PROJECT_ID")
BUCKET=re.compile(r"^gcf-v2-sources-[0-9]+-[a-z0-9-]+$")
OBJECT=re.compile(r"^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$")
GENERATION=re.compile(r"^[1-9][0-9]{0,20}$")
MAX_ARCHIVE=16*1024*1024
MAX_JS=1024*1024
HANDLER_PATHS=("index.js","functions/index.js")

def guard(runner=subprocess.run):
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:raise ValueError("PROJECT_ENV_GUARD")
    if any(os.environ.get(k) for k in SENSITIVE):raise ValueError("UNSAFE_ENV")
    r=runner(["gcloud","config","get-value","project"],capture_output=True,text=True,timeout=10,check=False)
    if r.returncode or r.stdout.strip()!=PROJECT:raise ValueError("GCLOUD_PROJECT_MISMATCH")

def function_metadata(name,runner=subprocess.run):
    r=runner(["gcloud","functions","describe",name,"--gen2",
              "--project="+PROJECT,"--region="+REGION,"--format=json"],
              capture_output=True,text=True,timeout=30,check=False)
    if r.returncode:return None
    try:
        value=json.loads(r.stdout)
        return value if isinstance(value,dict) else None
    except (ValueError,TypeError):return None

def pinned_source(info):
    if not isinstance(info,dict) or info.get("state")!="ACTIVE":return None
    build=info.get("buildConfig") or {}
    if not isinstance(build,dict):return None
    src=build.get("source") or {}
    if not isinstance(src,dict):return None
    storage=src.get("storageSource")
    if not isinstance(storage,dict):return None
    bucket,obj,gen=(str(storage.get(k,"")) for k in ("bucket","object","generation"))
    if not BUCKET.fullmatch(bucket) or not OBJECT.fullmatch(obj) or not GENERATION.fullmatch(gen):
        return None
    if not obj.endswith(".zip"):return None
    return bucket,obj,gen

def bounded_archive(source,spawn=subprocess.Popen):
    bucket,obj,gen=source
    uri="gs://"+bucket+"/"+obj+"#"+gen
    # No shell. Never show URI, stderr, stdout, or source bytes.
    command=["gcloud","storage","cat",uri]
    p=spawn(command,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    try:
        data=p.stdout.read(MAX_ARCHIVE+1)
        if len(data)>MAX_ARCHIVE:raise ValueError("ARCHIVE_TOO_LARGE")
        if p.wait(timeout=45)!=0:raise ValueError("ARCHIVE_READ_FAILED")
        return data
    finally:
        if p.poll() is None:
            p.kill()
            p.wait()

def handler_from_zip(data):
    if not data or len(data)>MAX_ARCHIVE:raise ValueError("BAD_ARCHIVE_SIZE")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names=[x for x in z.namelist() if x in HANDLER_PATHS]
            if len(names)!=1:raise ValueError("HANDLER_PATH_AMBIGUOUS")
            item=z.getinfo(names[0])
            if item.is_dir() or item.file_size>MAX_JS:raise ValueError("HANDLER_SIZE_UNSAFE")
            with z.open(item) as f:
                code=f.read(MAX_JS+1)
            if not code or len(code)>MAX_JS:raise ValueError("HANDLER_SIZE_UNSAFE")
            code.decode("utf-8",errors="strict")
            return code
    except (zipfile.BadZipFile,UnicodeDecodeError,RuntimeError,EOFError) as e:
        raise ValueError("ARCHIVE_OR_ENCODING_BLOCKED") from None

def static_app_check_status(source):
    text=source.decode("utf-8")
    clean=re.sub(r"/\\*[\\s\\S]*?\\*/|//[^\\n]*","",text)
    # Conservative: only classify literals; never infer effective per-handler configuration.
    has_true=bool(re.search(r"\\benforceAppCheck\\s*:\\s*true\\b",clean))
    has_false=bool(re.search(r"\\benforceAppCheck\\s*:\\s*false\\b",clean))
    if has_true and has_false:return "CONFLICTING_STATIC_DECLARATIONS"
    if has_true:return "TRUE_LITERAL_PRESENT_NOT_HANDLER_PROOF"
    if has_false:return "FALSE_LITERAL_PRESENT"
    return "NO_LITERAL_DECLARATION"

def attest(functions,local,loader=bounded_archive):
    statuses=[]
    for name in NAMES:
        print("FUNCTION:",name)
        info=functions.get(name)
        src=pinned_source(info)
        if src is None:
            print("SOURCE_ATTESTATION: BLOCKED_UNPINNED_OR_UNVERIFIED_SOURCE")
            statuses.append("BLOCKED")
            continue
        try:
            code=handler_from_zip(loader(src))
            equal=hashlib.sha256(code).digest()==hashlib.sha256(local).digest()
            print("DEPLOYED_HANDLER_EQUALS_REVIEW_BRANCH:","MATCH" if equal else "DRIFT")
            print("DEPLOYED_APP_CHECK_STATIC:",static_app_check_status(code))
            print("SOURCE_ARCHIVE_READ: PINNED_GENERATION_RAM_ONLY")
            statuses.append("MATCH" if equal else "DRIFT")
        except (OSError,ValueError,subprocess.TimeoutExpired):
            print("SOURCE_ATTESTATION: BLOCKED_ARCHIVE_READ_OR_PARSE")
            statuses.append("BLOCKED")
    print("SOURCE_ATTESTATION_SUMMARY:","MATCH_ALL" if len(statuses)==len(NAMES) and all(x=="MATCH" for x in statuses) else "REVIEW_REQUIRED")
    print("EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN")
    print("DEPLOYED_RUNTIME_EQUIVALENCE: NOT_PROVEN")
    print("V7_SOURCE_ATTESTATION_GATE: INSPECTION_ONLY")

def run():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true",help="Explicitly authorize RAM-only read of five Staging function source ZIPs")
    args=parser.parse_args()
    try:
        guard()
        if not args.inspect_source:
            print("V7_SOURCE_ATTESTATION_GATE: BLOCKED_EXPLICIT_INSPECTION_FLAG_REQUIRED")
            return 2
        root=pathlib.Path(__file__).resolve().parents[2]
        local=(root/"functions"/"index.js").read_bytes()
        results={name:function_metadata(name) for name in NAMES}
        attest(results,local)
        return 0
    except (ValueError,OSError,subprocess.TimeoutExpired):
        print("V7_SOURCE_ATTESTATION_GATE: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":raise SystemExit(run())
