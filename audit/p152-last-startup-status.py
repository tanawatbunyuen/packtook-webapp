#!/usr/bin/env python3
"""P152 read-only private startup log check for remaining IPv6 errors.
No raw log text, URLs, paths, DNS, or account details displayed.
"""
from pathlib import Path
import re
import sys
p=Path.home()/".packtook-demo-emulator-home"/"p141-emulator.log"
if p.is_symlink() or not p.is_file() or p.stat().st_size>2000000:
    print("P152_BLOCK=PRIVATE_LOG_UNSAFE_OR_MISSING")
    raise SystemExit(1)
lines=p.read_text(encoding="utf-8",errors="replace").splitlines()
counts={str(port):0 for port in (4500,14400,18080,19099)}
ipv6=0;unavailable=0; errors=0; ready=0
for line in lines:
    if re.search(r"\bEADDRNOTAVAIL\b",line,re.I):
        unavailable+=1
        for key in counts:
            if re.search(r"(?<!\d)"+key+r"(?!\d)",line):
                counts[key]+=1
    if "::1" in line:ipv6+=1
    if re.search(r"\b(?:error|failed|fatal)\b",line,re.I):errors+=1
    if re.search(r"all emulators ready|emulators are ready",line,re.I):ready+=1
print("P152_MODE=OFFLINE_EXISTING_PRIVATE_LOG_ONLY")
print("P152_LOG_LINES="+str(len(lines)))
print("P152_EADDRNOTAVAIL_LINES="+str(unavailable))
print("P152_IPV6_LOOPBACK_LINES="+str(ipv6))
for key,num in counts.items():print("P152_EADDRNOTAVAIL_PORT_"+key+"="+str(num))
print("P152_ERROR_LINES="+str(errors))
print("P152_READY_LINES="+str(ready))
print("P152_DIAGNOSTIC="+("IPV6_BIND_ERROR_REMAINS" if unavailable and ipv6 else ("NO_REMAINING_IPV6_BIND_ERROR_IN_LOG" if not unavailable else "ADDRESS_ERROR_NEEDS_REVIEW")))
print("P152_RAW_LOG_PRINTED=NO P152_NETWORK_CALLS=0 P152_CLOUD_CALLS=0 P152_DEPLOYS=0")
print("P152_DECISION=NO_GO_OWNER_SOURCE_IMPORT_OR_DEPLOY")
