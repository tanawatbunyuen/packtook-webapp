#!/usr/bin/env python3
"""P160: verified resumable HTTPS Range download into isolated private emulator cache.

No Firebase CLI, emulator start, recovered Owner code execution, or Cloud writes.
"""
import argparse
import hashlib
import os
from pathlib import Path
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
import zipfile

URL="https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar"
NAME="cloud-firestore-emulator-v1.22.0.jar"
EXPECTED=136707194
CHUNK=1048576
DEADLINE_SECONDS=210
MAX_RETRIES=2

def valid_jar(path,expected):
    if path.is_symlink() or not path.is_file() or path.stat().st_size!=expected:
        return False
    try:
        with zipfile.ZipFile(path) as jar:
            if not any(n.endswith(".class") for n in jar.namelist()):
                return False
            return jar.testzip() is None
    except (OSError,zipfile.BadZipFile,ValueError,RuntimeError):
        return False

def get_range(opener,start,end,total,timeout=12):
    req=urllib.request.Request(
        URL,headers={
            "Range":f"bytes={start}-{end}",
            "Accept-Encoding":"identity",
            "User-Agent":"PACKTOOK-P160-resumable-range"
        }
    )
    with opener.open(req,timeout=timeout) as resp:
        if resp.status!=206:
            return None,"STATUS_NOT_206"
        actual=resp.headers.get("Content-Range","").strip()
        if actual!=f"bytes {start}-{end}/{total}":
            return None,"CONTENT_RANGE_MISMATCH"
        content_length=resp.headers.get("Content-Length","")
        if content_length and (not content_length.isdecimal() or int(content_length)!=end-start+1):
            return None,"CONTENT_LENGTH_MISMATCH"
        data=resp.read(end-start+2)
        if len(data)!=end-start+1:
            return None,"BODY_LENGTH_MISMATCH"
        return data,"OK"

def download(cache,opener,total=EXPECTED,chunk=CHUNK,deadline=DEADLINE_SECONDS,clock=time.monotonic,
             output=lambda s:None):
    if cache.is_symlink() or not cache.is_dir():
        return "CACHE_UNSAFE",0
    dest=cache/NAME
    part=cache/".p160-firestore-v1.22.0.part"
    if dest.is_symlink() or part.is_symlink():
        return "SYMLINK_BLOCKED",0
    if dest.exists():
        return ("EXISTING_VALID",total) if valid_jar(dest,total) else ("EXISTING_INVALID_NO_OVERWRITE",0)
    if part.exists() and not part.is_file():
        return "PARTIAL_NOT_REGULAR_FILE",0
    offset=part.stat().st_size if part.exists() else 0
    if offset>total or (offset%chunk!=0 and offset!=total):
        return "PARTIAL_BOUNDARY_INVALID_NO_OVERWRITE",offset
    if offset==total:
        if not valid_jar(part,total):
            return "COMPLETE_PARTIAL_FAILED_JAR_VERIFICATION",offset
        os.link(part,dest)
        part.unlink()
        return "VERIFIED_AND_INSTALLED",total
    # A file already in progress is never truncated. Preserve partial data if network fails.
    started=clock()
    saved=offset
    failures=0
    try:
        # Exclusive create on first use; append on resume. Never overwrite an existing target.
        mode="ab" if part.exists() else "xb"
        with part.open(mode) as stream:
            os.chmod(part,0o600)
            while offset<total:
                if clock()-started>=deadline:
                    return "TIME_BUDGET_REACHED_RESUMABLE",offset
                end=min(offset+chunk,total)-1
                data=None
                error="NETWORK_OR_IO_FAILURE"
                for attempt in range(MAX_RETRIES+1):
                    if clock()-started>=deadline:
                        return "TIME_BUDGET_REACHED_RESUMABLE",offset
                    try:
                        data,error=get_range(opener,offset,end,total)
                    except (urllib.error.URLError,OSError,TimeoutError,socket.timeout,ssl.SSLError):
                        data,error=None,"NETWORK_OR_IO_FAILURE"
                    if data is not None:
                        failures=0
                        break
                    if error in ("STATUS_NOT_206","CONTENT_RANGE_MISMATCH","CONTENT_LENGTH_MISMATCH"):
                        return error+"_RESUMABLE",offset
                    failures+=1
                    if attempt<MAX_RETRIES:
                        time.sleep(0.3)
                if data is None:
                    return error+"_RESUMABLE",offset
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
                offset+=len(data)
                saved=offset
                if (offset//chunk)%10==0 or offset==total:
                    output(f"P160_SAVED_BYTES={offset}")
    except (OSError,PermissionError):
        return "FILESYSTEM_ERROR",saved
    if offset!=total:
        return "INCOMPLETE_RESUMABLE",offset
    if not valid_jar(part,total):
        return "JAR_ZIP_OR_CRC_INVALID_PARTIAL_RETAINED",offset
    try:
        if dest.exists() or dest.is_symlink():
            return "TARGET_APPEARED_NO_OVERWRITE",offset
        # Atomic, no-overwrite install by hard link within same private cache directory.
        os.link(part,dest)
        part.unlink()
    except OSError:
        return "ATOMIC_INSTALL_FAILED",offset
    return "VERIFIED_AND_INSTALLED",offset

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--resume-official-only",action="store_true")
    args=p.parse_args()
    if not args.resume_official_only:
        print("P160_BLOCK=EXPLICIT_RESUME_FLAG_REQUIRED")
        return 2
    cache=Path.home()/".packtook-demo-emulator-home/.cache/firebase/emulators"
    if cache.is_symlink() or not cache.is_dir():
        print("P160_BLOCK=PRIVATE_CACHE_UNSAFE")
        return 2
    print("P160_MODE=OFFICIAL_RANGE_DOWNLOAD_RESUMABLE")
    print("P160_ARTIFACT_VERSION=1.22.0")
    print("P160_EXPECTED_BYTES="+str(EXPECTED))
    print("P160_CHUNK_BYTES="+str(CHUNK))
    print("P160_PRIVATE_CACHE_ONLY=TRUE")
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    status,bytes_saved=download(cache,opener,output=print)
    path=cache/NAME
    valid=path.exists() and valid_jar(path,EXPECTED)
    print("P160_RESULT="+status)
    print("P160_PERSISTED_BYTES="+str(bytes_saved))
    print("P160_JAR_SIZE_ZIP_CRC_VALID="+str(valid).upper())
    if valid:
        with path.open("rb") as f:
            print("P160_JAR_SHA256="+hashlib.file_digest(f,"sha256").hexdigest())
    print("P160_NO_RAW_LOG_URLS_TOKENS_PRINTED=TRUE")
    print("P160_FIREBASE_CLI_RUNS=0 P160_EMULATOR_STARTS=0 P160_OWNER_IMPORTS=0 P160_DEPLOYS=0")
    print("P160_DECISION="+("ARTIFACT_READY_EMULATOR_NOT_ATTESTED" if valid else "NO_GO_RETAIN_PARTIAL_FOR_RESUME"))
    return 0 if valid else 1

if __name__=="__main__":
    try:
        sys.exit(main())
    except Exception:
        print("P160_BLOCK=UNEXPECTED_LOCAL_FAILURE")
        sys.exit(1)
