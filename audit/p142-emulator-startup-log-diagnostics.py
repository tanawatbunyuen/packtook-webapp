#!/usr/bin/env python3
"""P142: local Firebase emulator startup failure categories only.
No subprocess, network, imports, source reads, or raw log lines are printed.
"""
from __future__ import annotations
import argparse
import pathlib
import re
import sys

MAX_LOG_BYTES=2_000_000
PATTERNS={
 "DOWNLOAD_OR_UPDATE":r"download(?:ing|ed)?|fetch(?:ing|ed)?|updat(?:e|ing)|mirror|\.jar\b",
 "NETWORK_DNS_PROXY":r"ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network|proxy|unable to get local issuer certificate|certificate verify|SSL|TLS|dns",
 "JAVA_RUNTIME":r"java(?:\.lang)?|JDK|UnsupportedClassVersionError|ClassNotFoundException|Could not find or load main class|java_home|JVM",
 "MISSING_BINARY":r"no such file or directory|ENOENT|not found|cannot find module|Unable to access jarfile",
 "PERMISSION_OR_DISK":r"EACCES|EPERM|Permission denied|ENOSPC|No space left on device|read-only file system",
 "FIREBASE_PROJECT_AUTH":r"failed to authenticate|not logged in|permission.?denied|not authorized|project.*(?:not found|does not exist|invalid)|cannot access project",
 "PORT_BIND":r"EADDRINUSE|address already in use|port.*(?:taken|occupied|unavailable)|bind.*failed",
 "FIRESTORE_START":r"firestore emulator|firestore emulator logging|firestore:|firestore emulator has started",
 "AUTH_START":r"auth emulator|auth:|authentication emulator",
 "READY_MESSAGE":r"all emulators ready|emulators are ready|ready!|emulator hub running",
}
def classify(data: str):
    flags={k:bool(re.search(v,data,re.I)) for k,v in PATTERNS.items()}
    if flags["PERMISSION_OR_DISK"]: decision="CHECK_LOCAL_FILE_PERMISSIONS_OR_DISK"
    elif flags["NETWORK_DNS_PROXY"]: decision="CHECK_DOWNLOAD_OR_NETWORK_BLOCKER"
    elif flags["PORT_BIND"]: decision="CHECK_LOCAL_PORT_COLLISION"
    elif flags["JAVA_RUNTIME"] and (flags["MISSING_BINARY"] or flags["PERMISSION_OR_DISK"]): decision="CHECK_JAVA_LAUNCH_ERROR"
    elif flags["FIREBASE_PROJECT_AUTH"]: decision="CHECK_CLI_PROJECT_OR_AUTH_CONFIGURATION"
    elif flags["MISSING_BINARY"]: decision="CHECK_CLI_BINARY_OR_MODULE_AVAILABILITY"
    elif flags["DOWNLOAD_OR_UPDATE"] and not flags["READY_MESSAGE"]: decision="CHECK_PERSISTENT_CACHE_OR_DOWNLOAD"
    else: decision="UNKNOWN_REVIEW_PRIVATE_LOG_LOCALLY"
    return flags,decision
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--log",default=str(pathlib.Path.home()/".packtook-demo-emulator-home/p141-emulator.log"))
    args=parser.parse_args()
    f=pathlib.Path(args.log).expanduser()
    if f.is_symlink() or not f.is_file():raise RuntimeError("LOG_MISSING_OR_SYMLINK")
    size=f.stat().st_size
    if size>MAX_LOG_BYTES:raise RuntimeError("LOG_TOO_LARGE")
    raw=f.read_bytes()
    text=raw.decode("utf-8",errors="replace")
    flags,decision=classify(text)
    print("P142_MODE=PRIVATE_LOG_CATEGORY_ONLY")
    print("P142_LOG_PRESENT=TRUE")
    print("P142_LOG_BYTES="+str(len(raw)))
    print("P142_LOG_LINES="+str(len(text.splitlines())))
    for name in PATTERNS:
        print("P142_CATEGORY_"+name+"="+str(flags[name]).upper())
    print("P142_DIAGNOSTIC="+decision)
    print("P142_RAW_LOG_CONTENT_PRINTED=NO")
    print("P142_NETWORK_CALLS=0 P142_CLOUD_CALLS=0 P142_DEPLOYS=0")
    print("P142_DECISION=NO_GO_EMULATOR_NOT_YET_ATTESTED")
if __name__=="__main__":
    try:main()
    except Exception as error:
        reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
        # Never include user-controlled path, contents, or raw exception text.
        if reason not in ("LOG_MISSING_OR_SYMLINK","LOG_TOO_LARGE"):reason="LOCAL_READ_FAILED"
        print("P142_BLOCK="+reason)
        sys.exit(1)
