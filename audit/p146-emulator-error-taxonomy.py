#!/usr/bin/env python3
"""P146: classify exact emulator startup blockers without disclosing raw log data."""
import argparse
import pathlib
import re
import sys

CATEGORIES = {
 "HTTP_401_403":r"\b(?:HTTP\/[0-9.]+\s*)?(?:401|403)\b|unauthorized|forbidden",
 "HTTP_404":r"\b(?:HTTP\/[0-9.]+\s*)?404\b|not_found",
 "HTTP_429_5XX":r"\b(?:429|5[0-9][0-9])\b|rate limit|too many requests",
 "NETWORK_TIMEOUT":r"ETIMEDOUT|ESOCKETTIMEDOUT|timeout|timed out",
 "NETWORK_DNS":r"ENOTFOUND|EAI_AGAIN|getaddrinfo|DNS",
 "NETWORK_TLS":r"certificate|SSL|TLS|CERT_|UNABLE_TO_VERIFY|SELF_SIGNED_CERT",
 "NETWORK_CONNECT":r"ECONNREFUSED|ECONNRESET|socket hang up|network unreachable|ENETUNREACH",
 "JAVA_LAUNCH":r"java\.lang\.|UnsupportedClassVersionError|Could not find or load main class|Unable to access jarfile|spawn java",
 "CLI_MISSING_BINARY":r"\bENOENT\b|No such file or directory|not found|missing executable",
 "FIRESTORE_RULES_PATH":r"(?:rules(?: file| path)?|firestore\.rules).{0,120}(?:not found|missing|no such file|invalid|failed|could not)|(?:not found|missing|no such file).{0,120}(?:rules(?: file| path)?|firestore\.rules)",
 "PROJECT_AUTH":r"not logged in|failed to authenticate|permission denied|credential|project.*(?:not found|does not exist)",
 "PORT_CONFLICT":r"EADDRINUSE|address already in use|port.*in use|port.*occupied",
 "FILESYSTEM":r"EACCES|EPERM|ENOSPC|read-only file system|No space left",
 "DOWNLOAD_FAILED":r"(?:download|fetch).{0,120}(?:fail|error|abort)|(?:fail|error).{0,120}(?:download|fetch)",
 "UPDATE_CHECK":r"checking for updates|update notifier|checking for newer version",
 "FIRESTORE_START_FAILURE":r"(?:failed|could not|unable) to (?:start|initiate) (?:the )?firestore emulator|firestore emulator.*(?:failed|error)",
}
ERROR_PATTERN=re.compile(r"(?i)\berror\b|\bfail(?:ed|ure)?\b|\bexception\b|\bfatal\b")
DOWNLOAD_START=re.compile(r"(?i)\bdownloading\b|download in progress|starting download|fetching emulator")
DOWNLOAD_DONE=re.compile(r"(?i)\bdownload(?:ed| complete| finished| successful)\b|download complete")
FIRESTORE=re.compile(r"(?i)firestore")
AUTH=re.compile(r"(?i)auth(?:entication)? emulator|\bauth:")
READY=re.compile(r"(?i)all emulators ready|emulators are ready|ready to accept")
def analyze(log):
    lines=log.splitlines()
    counts={k:0 for k in CATEGORIES}
    error_lines=[]
    for n,line in enumerate(lines):
        for kind,pattern in CATEGORIES.items():
            if re.search(pattern,line,re.IGNORECASE):counts[kind]+=1
        if ERROR_PATTERN.search(line):error_lines.append(n+1)
    if counts["FIRESTORE_RULES_PATH"]:diagnostic="RULES_RESOLUTION_ERROR_SIGNAL"
    elif any(counts[k] for k in ("HTTP_401_403","HTTP_404","HTTP_429_5XX","NETWORK_TIMEOUT","NETWORK_DNS","NETWORK_TLS","NETWORK_CONNECT")):diagnostic="NETWORK_OR_PROVIDER_ERROR_SIGNAL"
    elif counts["JAVA_LAUNCH"]:diagnostic="JAVA_LAUNCH_ERROR_SIGNAL"
    elif counts["DOWNLOAD_FAILED"]:diagnostic="DOWNLOAD_FAILURE_SIGNAL"
    elif counts["CLI_MISSING_BINARY"]:diagnostic="MISSING_EXECUTABLE_SIGNAL"
    elif counts["PORT_CONFLICT"]:diagnostic="LOCAL_PORT_CONFLICT_SIGNAL"
    elif counts["PROJECT_AUTH"]:diagnostic="PROJECT_AUTH_ERROR_SIGNAL"
    elif counts["FIRESTORE_START_FAILURE"]:diagnostic="GENERIC_FIRESTORE_START_FAILURE_SIGNAL"
    elif error_lines:diagnostic="UNCLASSIFIED_ERROR_IN_PRIVATE_LOG"
    elif DOWNLOAD_START.search(log) and not DOWNLOAD_DONE.search(log):diagnostic="DOWNLOAD_NOT_CONFIRMED_COMPLETED"
    else:diagnostic="NO_SPECIFIC_ERROR_FOUND"
    return lines,counts,error_lines,diagnostic
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--log",default=str(pathlib.Path.home()/".packtook-demo-emulator-home/p141-emulator.log"))
    args=p.parse_args()
    target=pathlib.Path(args.log)
    if target.is_symlink() or not target.is_file() or target.stat().st_size>2_000_000:raise RuntimeError("LOG_MISSING_OR_UNSAFE")
    log=target.read_text(encoding="utf8",errors="replace")
    lines,counts,errors,diagnostic=analyze(log)
    print("P146_MODE=EXISTING_PRIVATE_LOG_ONLY")
    print("P146_LOG_LINES="+str(len(lines)))
    print("P146_ERROR_LINES="+str(len(errors)))
    # Numeric line indexes are safe: no input lines, contents, hostnames or secrets.
    print("P146_FIRST_ERROR_LINE_INDEX="+(str(errors[0]) if errors else "NONE"))
    for kind,n in counts.items(): print("P146_CATEGORY_"+kind+"="+str(n))
    print("P146_DOWNLOAD_START_SEEN="+str(bool(DOWNLOAD_START.search(log))).upper())
    print("P146_DOWNLOAD_DONE_SEEN="+str(bool(DOWNLOAD_DONE.search(log))).upper())
    print("P146_FIRESTORE_TEXT_SEEN="+str(bool(FIRESTORE.search(log))).upper())
    print("P146_AUTH_TEXT_SEEN="+str(bool(AUTH.search(log))).upper())
    print("P146_READY_TEXT_SEEN="+str(bool(READY.search(log))).upper())
    print("P146_DIAGNOSTIC="+diagnostic)
    print("P146_LOG_TEXT_URLS_AND_PATHS_PRINTED=NO")
    print("P146_EMULATOR_STARTS=0 P146_NETWORK_CALLS=0 P146_CLOUD_WRITES=0 P146_DEPLOYS=0")
    print("P146_DECISION=NO_GO_EMULATOR_STARTUP_NOT_ATTESTED")
if __name__=="__main__":
    try:main()
    except Exception as e:
        reason=str(e) if isinstance(e,RuntimeError) and str(e)=="LOG_MISSING_OR_UNSAFE" else "LOCAL_DIAGNOSTIC_FAILED"
        print("P146_BLOCK="+reason)
        sys.exit(1)
