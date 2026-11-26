#!/usr/bin/env python3
"""P231.144: compare local staging Firebase client wiring with public hosted static assets.
READ-ONLY GET to staging static files, NO Cloud Function calls, no tokens.
Never emits site key, Firebase API key, app identifiers, HTML or JS source.
"""
import json,pathlib,re,sys,urllib.request,urllib.error
from hashlib import sha256
BASE="https://packtook-staging.web.app"
ROOT=pathlib.Path("firebase-staging")
def out(k,v):print(f"P231_{k}={v}",flush=True)
out("CHECK","NORMAL_CLIENT_APPCHECK_STATIC_WIRING_READONLY")
files={"bridge":"firebase-packing-bridge.js","config":"firebase-v4-config.js","index":"index.html"}
local={}
hosted={}
for label,name in files.items():
    try:
        local[label]=(ROOT/name).read_text(encoding="utf8")
    except Exception:
        out("GATE","BLOCKED_MISSING_LOCAL_STAGING_SOURCE");sys.exit(2)
for label,name in files.items():
    try:
        req=urllib.request.Request(BASE+"/"+name,headers={
          "User-Agent":"PACKTOOK-P231144-StaticAudit/1.0",
          "Accept":"text/javascript,text/html,*/*"
        },method="GET")
        with urllib.request.urlopen(req,timeout=15) as resp:
            if resp.status!=200:raise ValueError("HTTP !=200")
            chunk=resp.read(2_000_001)
            if len(chunk)>2_000_000:raise ValueError("asset too large")
            hosted[label]=chunk.decode("utf8")
    except Exception:
        out("HOSTED_"+label.upper(),"UNAVAILABLE")
        out("GATE","BLOCKED_HOSTED_STATIC_FETCH")
        out("RUNTIME_CALLS","0")
        out("RELEASE","NO_GO")
        sys.exit(2)
    out("HOSTED_"+label.upper()+"_HTTP","200")
for label in files:
    out(label.upper()+"_SOURCE_EQUALS_HOSTED",
        "YES" if sha256(local[label].encode()).digest()==sha256(hosted[label].encode()).digest() else "NO")

def parsed_bridge(text):
    return {
        "STAGING_FN_REGION":bool(re.search(r'getFunctions\s*\(\s*app\s*,\s*["\']asia-southeast1["\']',text)),
        "APPCHECK_SDK_INITIALIZE":bool(re.search(r'\binitializeAppCheck\s*\(',text)),
        "ENTERPRISE_PROVIDER":bool(re.search(r'\bnew\s+ReCaptchaEnterpriseProvider\s*\(',text)),
        "AUTO_REFRESH_ENABLED":bool(re.search(r'\bisTokenAutoRefreshEnabled\s*:\s*true\b',text)),
        "PROTECTED_USAGE":bool(re.search(r'protectedApi\s*\(\s*["\']usageStatus["\']',text)),
        "PROTECTED_RECORDING":bool(re.search(r'protectedApi\s*\(\s*["\']recordingStatus["\']',text)),
        "CALLABLE_SDK":bool(re.search(r'\bhttpsCallable\s*\(',text)),
    }
for mode in ("local","hosted"):
    for label,yes in parsed_bridge((local if mode=="local" else hosted)["bridge"]).items():
        out(mode.upper()+"_"+label,"YES" if yes else "NO")
    bridge=(local if mode=="local" else hosted)["bridge"]
    config=(local if mode=="local" else hosted)["config"]
    # Record only source shape, not values or Firebase app identifiers.
    out(mode.upper()+"_CONFIG_SITE_KEY_EXPORT",
        "YES" if re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=',config) else "NO")
    out(mode.upper()+"_CONFIG_SITE_KEY_NONEMPTY_LITERAL",
        "YES" if re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*["\'][^"\']+["\']',config) else "NO")
    out(mode.upper()+"_BRIDGE_PROVIDER_HARDCODED_LITERAL",
        "YES" if re.search(r'new\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\'])([^"\']+)\1\s*\)',bridge) else "NO")
    out(mode.upper()+"_BRIDGE_CONFIG_SITE_KEY_IMPORT",
        "YES" if re.search(r'import\s*\{[^}]*\brecaptchaEnterpriseSiteKey\b[^}]*\}\s*from\s*["\']\./firebase-v4-config\.js["\']',bridge) else "NO")
    out(mode.upper()+"_INDEX_MODULE_REFERENCES_BRIDGE",
        "YES" if re.search(r'<script[^>]*type=["\']module["\'][^>]*src=["\']firebase-packing-bridge\.js', (local if mode=="local" else hosted)["index"]) else "NO")
out("DIFFERENT_SOURCE_SHAPES","CHECK_REPORTED_FLAGS")
out("REAL_USER_CALLABLE_APPCHECK_TOKEN_ATTACHED","NOT_VERIFIED_BY_STATIC_INSPECTION")
out("ACTIVE_REQUESTS","NONE_STATIC_GET_ONLY")
out("CREDENTIALS","NONE_ACQUIRED")
out("CLOUD_WRITES","0")
out("RELEASE","NO_GO")
