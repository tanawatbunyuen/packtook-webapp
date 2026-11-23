#!/usr/bin/env python3
"""P144: read-only Firebase startup phase evidence; only aggregate output."""
from __future__ import annotations
import argparse
import hashlib
import pathlib
import re
import stat
import sys
import zipfile

PATTERNS={
"CLI_START_REQUEST":r"starting emulators|emulators:start|starting firestore|starting authentication",
"FIRESTORE_PREPARE":r"firestore(?:.*(?:prepar|start|initializ|download|jar|version))?|preparing firestore",
"AUTH_PREPARE":r"auth(?:entication)? emulator|auth:\s|starting authentication",
"EXPLICIT_DOWNLOAD_START":r"\bdownloading\b|starting download|download in progress|fetching emulator",
"EXPLICIT_DOWNLOAD_DONE":r"\bdownload(?:ed| complete| finished| successful)\b|download complete",
"VERSION_LOOKUP":r"version|release|manifest|check(?:ing)? for updates|update notifier",
"EMULATOR_BINARY_START":r"java\s|spawning|spawned|starting emulator binary|emulator starting at",
"READY":r"all emulators ready|emulators are ready|emulator hub running|ready to accept requests",
"EXPLICIT_ERROR":r"\berror\b|\bfailed\b|\bexception\b|\bfatal\b",
"NETWORK_ERROR":r"ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EAI_AGAIN|certificate.*(?:error|failed)|unable to get local issuer certificate",
"CLI_WAITING_PROMPT":r"press enter|continue\?|\(y/n\)|\? \S+",
}
def hash_cache(folder: pathlib.Path):
    if not folder.is_dir() or folder.is_symlink():
        return ("ABSENT_OR_UNSAFE",None)
    jars=[]
    for p in folder.rglob("*"):
        if p.is_symlink(): return ("SYMLINK_BLOCK",None)
        if p.is_file() and p.suffix.lower()==".jar": jars.append(p)
    if len(jars)!=1: return ("EXPECTED_ONE_JAR_MISSING",None)
    p=jars[0]
    if p.stat().st_size>500_000_000: return ("JAR_TOO_LARGE",None)
    with zipfile.ZipFile(p) as z:
        if z.testzip() is not None:return ("INVALID_JAR",None)
    h=hashlib.sha256()
    with p.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):h.update(block)
    return ("JAR_OK",h.digest())
def main():
    ap=argparse.ArgumentParser()
    home=pathlib.Path.home()
    ap.add_argument("--log",default=str(home/".packtook-demo-emulator-home/p141-emulator.log"))
    ap.add_argument("--source-cache",default=str(home/".cache/firebase/emulators"))
    ap.add_argument("--private-cache",default=str(home/".packtook-demo-emulator-home/.cache/firebase/emulators"))
    args=ap.parse_args()
    log=pathlib.Path(args.log)
    if log.is_symlink() or not log.is_file() or log.stat().st_size>2_000_000:
        raise RuntimeError("LOG_MISSING_OR_UNSAFE")
    data=log.read_text(encoding="utf8",errors="replace")
    lines=data.splitlines()
    presence={key:False for key in PATTERNS}
    last_seen={key:-1 for key in PATTERNS}
    for index,line in enumerate(lines):
        for key,pattern in PATTERNS.items():
            if re.search(pattern,line,re.IGNORECASE):
                presence[key]=True
                last_seen[key]=index
    a=hash_cache(pathlib.Path(args.source_cache))
    b=hash_cache(pathlib.Path(args.private_cache))
    print("P144_MODE=OFFLINE_EXISTING_LOG_AND_JAR_HASH_ONLY")
    print("P144_LOG_LINES="+str(len(lines)))
    for key in PATTERNS:
        print("P144_STAGE_"+key+"="+str(presence[key]).upper())
    # Categorize last observed known state without copying log data.
    last=max((index,key) for key,index in last_seen.items() if index>=0) if any(v>=0 for v in last_seen.values()) else None
    print("P144_LAST_RECOGNIZED_STAGE="+(last[1] if last else "UNKNOWN"))
    print("P144_SOURCE_JAR="+a[0])
    print("P144_PRIVATE_JAR="+b[0])
    same=a[1] is not None and a[1]==b[1]
    print("P144_SOURCE_PRIVATE_SHA256_EQUAL="+str(same).upper())
    if presence["NETWORK_ERROR"]:
        outcome="NETWORK_ERROR_EVIDENCE"
    elif presence["EXPLICIT_ERROR"]:
        outcome="ERROR_PRESENT_REQUIRES_LOCAL_PRIVATE_REVIEW"
    elif presence["EXPLICIT_DOWNLOAD_START"] and not presence["EXPLICIT_DOWNLOAD_DONE"]:
        outcome="DOWNLOAD_STARTED_NOT_CONFIRMED_FINISHED"
    elif presence["CLI_WAITING_PROMPT"]:
        outcome="INTERACTIVE_PROMPT_INDICATOR"
    elif not presence["EMULATOR_BINARY_START"] and not presence["READY"]:
        outcome="NO_EXPLICIT_BINARY_START_OR_READY_IN_LOG"
    else:
        outcome="STARTUP_PHASE_UNRESOLVED"
    print("P144_DIAGNOSTIC="+outcome)
    print("P144_RAW_LOG_LINES_PRINTED=NO P144_JAR_PATHS_OR_DIGESTS_PRINTED=NO")
    print("P144_CLOUD_CALLS=0 P144_EMULATOR_STARTS=0 P144_DEPLOYS=0")
    print("P144_DECISION=NO_GO_STARTUP_NOT_ATTESTED")
if __name__=="__main__":
    try:main()
    except Exception as e:
        reason=str(e) if isinstance(e,RuntimeError) and str(e)=="LOG_MISSING_OR_UNSAFE" else "PRIVATE_LOCAL_AUDIT_FAILED"
        print("P144_BLOCK="+reason)
        sys.exit(1)
