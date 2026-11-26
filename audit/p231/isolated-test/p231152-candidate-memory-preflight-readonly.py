#!/usr/bin/env python3
"""P231.152 — dry-run public Enterprise site-key candidate, NEVER deploy.
Reads reviewed local staging source and hosted public JS. Candidate exists only
in memory, and no site key, raw JS, URLs, identifiers, or credential values print.
"""
import pathlib,re,sys,urllib.request
from hashlib import sha256

BASE="https://packtook-staging.web.app"
ROOT=pathlib.Path("firebase-staging")
def emit(name,value):print(f"P231_{name}={value}",flush=True)
def yes(value):return "YES" if value else "NO"
emit("CHECK","STAGING_APPCHECK_CANDIDATE_MEMORY_ONLY")
try:
    config=(ROOT/"firebase-v4-config.js").read_text(encoding="utf-8")
    bridge=(ROOT/"firebase-packing-bridge.js").read_text(encoding="utf-8")
    index=(ROOT/"index.html").read_text(encoding="utf-8")
    def hosted(name):
        req=urllib.request.Request(BASE+"/"+name,method="GET",headers={
          "Accept":"text/javascript,text/html,*/*",
          "Cache-Control":"no-cache","User-Agent":"PACKTOOK-P231152-ReadOnly"})
        with urllib.request.urlopen(req,timeout=18) as resp:
            if resp.status!=200:raise ValueError("hosted status")
            b=resp.read(2000001)
            if len(b)>2000000:raise ValueError("hosted asset too large")
            return b.decode("utf-8")
    hosted_bridge=hosted("firebase-packing-bridge.js")
    hosted_config=hosted("firebase-v4-config.js")
    hosted_index=hosted("index.html")
except Exception:
    emit("GATE","BLOCKED_SOURCE_OR_STATIC_FETCH")
    emit("DEPLOY","NOT_PERFORMED")
    emit("RELEASE","NO_GO")
    sys.exit(2)

# Trust only shape of the previously inspected, publicly hosted Enterprise site key.
match=re.search(r'\bnew\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)',hosted_bridge)
if not match:
    emit("GATE","BLOCKED_HOSTED_PROVIDER_NOT_LITERAL")
    sys.exit(2)
public_key=match.group(2)
if not re.fullmatch(r"[A-Za-z0-9_-]{20,300}",public_key):
    emit("GATE","BLOCKED_PUBLIC_SITE_KEY_FORMAT")
    sys.exit(2)
if not re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',config) or not re.search(
    r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',hosted_config):
    emit("GATE","BLOCKED_STAGING_PROJECT_MISMATCH")
    sys.exit(2)

# Require one empty public-site-key binding in local repo before constructing candidate.
pattern=r'(export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*)(["\x27])\2\s*;'
found=list(re.finditer(pattern,config))
if len(found)!=1:
    emit("GATE","BLOCKED_LOCAL_SITE_KEY_NOT_SINGLE_EMPTY_EXPORT")
    sys.exit(2)
m=found[0]
candidate_config=config[:m.start()]+m.group(1)+'"'+public_key+'";'+config[m.end():]
candidate_bridge=bridge
candidate_index=index

def check_bridge(s):
    return all([
       bool(re.search(r'\binitializeAppCheck\s*\(\s*app\s*,',s)),
       bool(re.search(r'\bnew\s+ReCaptchaEnterpriseProvider\s*\(\s*recaptchaEnterpriseSiteKey\.trim\(\)',s)),
       bool(re.search(r'\bgetFunctions\s*\(\s*app\s*,\s*["\x27]asia-southeast1["\x27]',s)),
       'protectedApi("usageStatus")' in s,
       'protectedApi("recordingStatus")' in s,
       bool(re.search(r'\bisTokenAutoRefreshEnabled\s*:\s*true\b',s))
    ])
checks={
 "PUBLIC_SITE_KEY_AVAILABLE":True,
 "CANDIDATE_SITE_KEY_NONEMPTY": public_key in candidate_config,
 "CANDIDATE_CONFIG_PROJECT_STAGING":'projectId: "packtook-staging"' in candidate_config,
 "CANDIDATE_PROTECTED_BRIDGE_PRESERVED":check_bridge(candidate_bridge),
 "CANDIDATE_INDEX_UNCHANGED_FROM_REPO":candidate_index==index,
 "CANDIDATE_BRIDGE_UNCHANGED_FROM_REPO":candidate_bridge==bridge,
 "HOSTED_INDEX_PARITY":candidate_index==hosted_index,
 "HOSTED_BRIDGE_PARITY":candidate_bridge==hosted_bridge,
 "HOSTED_CONFIG_PARITY":candidate_config==hosted_config,
}
for name,value in checks.items():emit(name,yes(value))
local_safety=all(checks[k] for k in (
 "PUBLIC_SITE_KEY_AVAILABLE","CANDIDATE_SITE_KEY_NONEMPTY",
 "CANDIDATE_CONFIG_PROJECT_STAGING","CANDIDATE_PROTECTED_BRIDGE_PRESERVED",
 "CANDIDATE_INDEX_UNCHANGED_FROM_REPO","CANDIDATE_BRIDGE_UNCHANGED_FROM_REPO"))
emit("CANDIDATE_STATIC_SAFETY","PASS_MEMORY_ONLY" if local_safety else "BLOCKED")
emit("HOSTED_PARITY","MATCH" if all(checks[k] for k in (
 "HOSTED_INDEX_PARITY","HOSTED_BRIDGE_PARITY","HOSTED_CONFIG_PARITY")) else "DRIFT_REMAINS")
emit("DEPLOY_READINESS","BLOCKED_PENDING_ASSET_RECONCILIATION_AND_APPROVAL")
emit("PUBLIC_SITE_KEY_VALUE","NOT_PRINTED")
emit("ARTIFACT_WRITTEN_TO_DISK","NO")
emit("SOURCE_MODIFIED","NO")
emit("CREDENTIALS","NONE")
emit("CLOUD_WRITES","0")
emit("RUNTIME_CALLS","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
# A successful dry-run says *only* the memory-only candidate construction passed.
sys.exit(0 if local_safety else 3)
