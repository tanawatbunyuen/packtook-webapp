#!/usr/bin/env python3
"""P231.151: Staging Hosting source-drift predeploy gate (read-only).
Fetches only 3 publicly hosted static assets. Prints no source, keys or hashes.
Exits nonzero when deploying local staging source without reconciliation is unsafe.
"""
import json,pathlib,re,sys,urllib.request
BASE="https://packtook-staging.web.app"
NAMES=["firebase-packing-bridge.js","firebase-v4-config.js","index.html"]
ROOT=pathlib.Path("firebase-staging")
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
emit("CHECK","STAGING_HOSTING_PREDEPLOY_SOURCE_DRIFT_GATE_READONLY")
try:
    cfg=json.loads(pathlib.Path("firebase.json").read_text(encoding="utf8"))
    public=cfg.get("hosting",{}).get("public")
    if public!="firebase-staging":raise ValueError("unexpected hosting public directory")
    emit("HOSTING_PUBLIC_DIRECTORY","EXPECTED_STAGING")
    local={n:(ROOT/n).read_text(encoding="utf8") for n in NAMES}
    remote={}
    for n in NAMES:
        req=urllib.request.Request(BASE+"/"+n,headers={"Cache-Control":"no-cache",
          "Accept":"text/javascript,text/html,*/*","User-Agent":"PACKTOOK-P231151-Audit"},
          method="GET")
        with urllib.request.urlopen(req,timeout=16) as res:
            if res.status!=200:raise ValueError("hosted asset unavailable")
            b=res.read(2000001)
            if len(b)>2000000:raise ValueError("unexpected asset size")
            remote[n]=b.decode("utf8")
except Exception:
    emit("GATE","BLOCKED_READ_FAILURE")
    emit("CLOUD_WRITES","0")
    emit("RELEASE","NO_GO")
    sys.exit(2)

for n in NAMES:
    label={"firebase-packing-bridge.js":"BRIDGE","firebase-v4-config.js":"CONFIG","index.html":"INDEX"}[n]
    emit(label+"_SOURCE_PARITY","MATCH" if local[n]==remote[n] else "DRIFT")

def site_key_state(config):
    m=re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\'])(.*?)\1\s*;',config,re.S)
    return "EXPORT_EMPTY" if m and not m.group(2).strip() else ("EXPORT_NONEMPTY" if m else "NOT_EXPORTED")
emit("LOCAL_SITE_KEY_EXPORT",site_key_state(local["firebase-v4-config.js"]))
emit("HOSTED_SITE_KEY_EXPORT",site_key_state(remote["firebase-v4-config.js"]))
emit("LOCAL_HAS_PROTECTED_STATUS_WRAPPER","YES" if
    'protectedApi("usageStatus")' in local["firebase-packing-bridge.js"] and
    'protectedApi("recordingStatus")' in local["firebase-packing-bridge.js"] else "NO")
emit("HOSTED_HAS_PROTECTED_STATUS_WRAPPER","YES" if
    'protectedApi("usageStatus")' in remote["firebase-packing-bridge.js"] and
    'protectedApi("recordingStatus")' in remote["firebase-packing-bridge.js"] else "NO")
emit("HOSTED_PROVIDER_LITERAL_PRESENT","YES" if re.search(
    r'new\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\'])([^"\']+)\1\s*\)',
    remote["firebase-packing-bridge.js"]) else "NO")

blocked=(any(local[n]!=remote[n] for n in NAMES)
    or site_key_state(local["firebase-v4-config.js"])=="EXPORT_EMPTY")
emit("UNRECONCILED_DEPLOY_GATE","BLOCKED" if blocked else "REVIEW_REQUIRED")
emit("CANONICAL_ASSET_CHANGE","NOT_PERFORMED")
emit("CLOUD_REQUESTS","STATIC_GET_ONLY")
emit("IAM_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("CLEANUP","NOT_PERFORMED")
emit("RELEASE","NO_GO")
sys.exit(3 if blocked else 0)
