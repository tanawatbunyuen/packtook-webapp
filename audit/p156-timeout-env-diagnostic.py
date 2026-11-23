#!/usr/bin/env python3
"""P156: offline download-timeout diagnosis. No proxy values, URLs, raw logs."""
from pathlib import Path
import os,re,sys
log=Path.home()/".packtook-demo-emulator-home/p155-setup.log"
if log.is_symlink() or not log.is_file() or log.stat().st_size>2_000_000:
    print("P156_BLOCK=PRIVATE_SETUP_LOG_MISSING_OR_UNSAFE");sys.exit(1)
lines=log.read_text(errors="replace").splitlines()
patterns={
 "DOWNLOAD":r"\bdownload(?:ing|ed)?\b|\bfetch\b",
 "PROXY_ERROR":r"proxy.*(?:error|failed)|(?:error|failed).*proxy|\bEPROXY\b",
 "DNS_ERROR":r"ENOTFOUND|EAI_AGAIN|DNS|name resolution",
 "CONNECT_ERROR":r"ECONNREFUSED|ECONNRESET|ENETUNREACH|socket hang up",
 "TLS_ERROR":r"CERT_|certificate|UNABLE_TO_VERIFY|SELF_SIGNED|SSL|TLS",
 "HTTP_403":r"(?<!\d)403(?!\d)|forbidden",
 "HTTP_404":r"(?<!\d)404(?!\d)|not found",
 "HTTP_429_5XX":r"(?<!\d)(?:429|5\d\d)(?!\d)|rate.limit",
 "TIMEOUT":r"\b(?:ETIMEDOUT|ESOCKETTIMEDOUT|timeout|timed out)\b",
 "ERROR_GENERIC":r"\b(?:error|failed|fatal|exception)\b",
 "SUCCESS":r"\bdownload(?:ed| complete| finished| succeeded)\b",
}
counts={k:sum(bool(re.search(v,line,re.I)) for line in lines) for k,v in patterns.items()}
proxy_keys=["HTTPS_PROXY","HTTP_PROXY","ALL_PROXY","NO_PROXY","https_proxy","http_proxy","all_proxy","no_proxy"]
present=[k for k in proxy_keys if os.environ.get(k)]
print("P156_MODE=OFFLINE_PRIVATE_LOG_AND_ENV_NAMES_ONLY")
print("P156_LOG_LINES="+str(len(lines)))
for key,v in counts.items():print("P156_LOG_"+key+"_LINES="+str(v))
print("P156_PROXY_KEYS_PRESENT_COUNT="+str(len(present)))
for key in proxy_keys:print("P156_PROXY_"+key.upper()+"_SET="+str(bool(os.environ.get(key))).upper())
print("P156_P155_WRAPPER_PRESERVES_PROXY_VARS=FALSE")
print("P156_PROXY_ENV_STRIPPED_RISK="+str(bool(present)).upper())
if counts["PROXY_ERROR"] or counts["DNS_ERROR"] or counts["CONNECT_ERROR"] or counts["TLS_ERROR"]:
    diagnosis="NETWORK_FAILURE_SIGNAL"
elif present and not counts["SUCCESS"]:
    diagnosis="PROXY_STRIPPED_CANDIDATE_NOT_CONFIRMED"
elif counts["DOWNLOAD"] and not counts["SUCCESS"]:
    diagnosis="DOWNLOAD_UNFINISHED_CAUSE_UNCONFIRMED"
else:
    diagnosis="LOCAL_LOG_INCONCLUSIVE"
print("P156_DIAGNOSTIC="+diagnosis)
print("P156_RAW_LOG_URLS_PROXY_VALUES_PRINTED=NO")
print("P156_NETWORK_CALLS=0 P156_FIREBASE_RUNS=0 P156_DEPLOYS=0")
print("P156_DECISION=NO_GO_RETRY_UNTIL_NETWORK_PATH_REVIEWED")
