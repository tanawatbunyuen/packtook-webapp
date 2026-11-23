#!/usr/bin/env python3
"""P149: narrow offline diagnostics of Firebase port-check errors, no log disclosure."""
import argparse
import pathlib
import re
import sys
SIGNALS={
 "PORT_CHECK_AVAILABLE":r"(?:check|checking|verify|verifying).{0,110}\b(?:port|address|listener)\b.{0,80}\bavailable\b|(?:check|checking).{0,110}\bavailable\b",
 "PORT_WORD":r"\bport\b",
 "LISTEN_WORD":r"\blisten\b",
 "EADDRNOTAVAIL":r"\bEADDRNOTAVAIL\b|address not available|cannot assign requested address",
 "EADDRINUSE":r"\bEADDRINUSE\b|address already in use",
 "EACCES":r"\bEACCES\b|permission denied",
 "IPV6_LOOPBACK":r"(?<![A-Za-z0-9])::1(?![A-Fa-f0-9])|\bipv6\b",
 "IPV4_LOOPBACK":r"127\.0\.0\.1|\blocalhost\b",
 "ANY_INTERFACE":r"0\.0\.0\.0|\b::\b",
 "HUB":r"\bhub\b",
 "FIRESTORE":r"\bfirestore\b",
 "AUTH":r"\bauth\b|authentication",
 "ERROR":r"\berror\b|\bfailed\b|\bexception\b",
 "DOWNLOAD_START":r"\bdownloading\b|starting download",
 "READY":r"all emulators ready|emulators are ready",
}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--log",default=str(pathlib.Path.home()/".packtook-demo-emulator-home/p141-emulator.log"))
    args=p.parse_args()
    log=pathlib.Path(args.log)
    if log.is_symlink() or not log.is_file() or log.stat().st_size>2_000_000:raise RuntimeError("LOG_MISSING_OR_UNSAFE")
    lines=log.read_text(encoding="utf-8",errors="replace").splitlines()
    counts={n:0 for n in SIGNALS}
    for line in lines:
        for name,pat in SIGNALS.items():
            if re.search(pat,line,re.I):counts[name]+=1
    if counts["PORT_CHECK_AVAILABLE"]>0 and counts["EADDRNOTAVAIL"]>0:
        diag="PORT_CHECK_ADDRESS_NOT_AVAILABLE"
    elif counts["PORT_CHECK_AVAILABLE"]>0 and counts["EADDRINUSE"]>0:
        diag="PORT_CHECK_ADDRESS_IN_USE"
    elif counts["PORT_CHECK_AVAILABLE"]>0:
        diag="PORT_CHECK_ERROR_NEEDS_LOCAL_INVESTIGATION"
    elif counts["EADDRNOTAVAIL"]>0:
        diag="ADDRESS_BIND_UNAVAILABLE"
    else:
        diag="PORT_CHECK_NOT_CONFIRMED"
    print("P149_MODE=LOCAL_PREEXISTING_LOG_ONLY")
    print("P149_LOG_LINES="+str(len(lines)))
    for n,c in counts.items():print("P149_SIGNAL_"+n+"="+str(c))
    print("P149_DIAGNOSTIC="+diag)
    print("P149_RAW_LOG_PRINTED=NO P149_URLS_HOSTNAMES_PATHS_PRINTED=NO")
    print("P149_EMULATOR_STARTS=0 P149_FIREBASE_CALLS=0 P149_DEPLOYS=0")
    print("P149_DECISION=NO_GO_UNTIL_REAL_EMULATOR_IDENTITY_AND_AUTHZ_ATTESTED")
if __name__=="__main__":
    try:main()
    except Exception as e:
        reason=str(e) if isinstance(e,RuntimeError) and str(e)=="LOG_MISSING_OR_UNSAFE" else "LOCAL_DIAGNOSTIC_FAILED"
        print("P149_BLOCK="+reason)
        sys.exit(1)
