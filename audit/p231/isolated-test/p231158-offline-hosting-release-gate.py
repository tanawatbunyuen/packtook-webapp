#!/usr/bin/env python3
"""P231.158 — offline hosting candidate release-readiness manifest preflight.
No network, no file writes, no credentials, no source/key values printed.
Intentionally blocks release because repository staging site-key export is blank.
"""
import json,pathlib,re,sys
from html.parser import HTMLParser
ROOT=pathlib.Path("firebase-staging")
SCRIPTS=("firebase-packing-bridge.js","video-history-db.js","video-stream-writer.js","performance-monitor.js","app.js")
def out(k,v):print("P231_"+k+"="+str(v),flush=True)
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.urls=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   d=dict(attrs)
   if d.get("src"):self.urls.append(d["src"])
out("CHECK","OFFLINE_STAGING_HOSTING_CANDIDATE_RELEASE_PREFLIGHT")
try:
 cfg=json.loads(pathlib.Path("firebase.json").read_text("utf8"))
 hosting=cfg["hosting"]
 assert hosting["public"]=="firebase-staging"
 index=(ROOT/"index.html").read_text("utf8")
 bridge=(ROOT/"firebase-packing-bridge.js").read_text("utf8")
 config=(ROOT/"firebase-v4-config.js").read_text("utf8")
 parser=Scripts();parser.feed(index)
 found={}
 for url in parser.urls:
  m=re.fullmatch(r"([A-Za-z0-9_-]+\.js)\?v=([A-Za-z0-9._-]+)",url)
  if not m:raise ValueError("unsupported reference")
  if m.group(1) in found:raise ValueError("duplicate reference")
  found[m.group(1)]=m.group(2)
 if set(found)!=set(SCRIPTS):raise ValueError("unexpected scripts")
 missing=[x for x in SCRIPTS if not (ROOT/x).is_file()]
 if missing:raise ValueError("missing asset")
 staging=bool(re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',config))
 emptykey=bool(re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1\s*;',config))
 nonempty=bool(re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])[^"\x27]+\1\s*;',config))
 bridge_checks={
  "SDK_APPCHECK_PRESENT":all(x in bridge for x in ("initializeAppCheck","ReCaptchaEnterpriseProvider","isTokenAutoRefreshEnabled:true")),
  "STAGING_FUNCTIONS_REGION_PRESENT":bool(re.search(r'getFunctions\s*\(\s*app\s*,\s*["\x27]asia-southeast1["\x27]',bridge)),
  "STATUS_GUARD_PRESENT":all(x in bridge for x in ('protectedApi("usageStatus")','protectedApi("recordingStatus")','appCheckReady')),
  "SITE_KEY_CONFIG_IMPORT_PRESENT":bool(re.search(r'import\s*\{[^}]*\brecaptchaEnterpriseSiteKey\b',bridge)),
 }
except Exception:
 out("GATE","BLOCKED_OFFLINE_MANIFEST_OR_SOURCE")
 out("SOURCE_WRITES","0")
 out("CLOUD_WRITES","0")
 out("DEPLOY","NOT_PERFORMED")
 out("RELEASE","NO_GO")
 sys.exit(2)
out("HOSTING_PUBLIC_DIRECTORY","EXPECTED_STAGING")
out("EXPECTED_VERSIONED_SCRIPT_COUNT",len(found))
out("ALL_REFERENCED_JS_PRESENT","YES")
out("STAGING_PROJECT_ID_PATTERN","YES" if staging else "NO")
out("PUBLIC_SITE_KEY_EXPORT_EMPTY","YES" if emptykey else "NO")
out("PUBLIC_SITE_KEY_EXPORT_NONEMPTY","YES" if nonempty else "NO")
for k,v in bridge_checks.items():out(k,"YES" if v else "NO")
out("FIREBASE_DEPLOY_TARGET_SCOPE","MUST_BE_HOSTING_ONLY")
out("CANDIDATE_BUILD_ARTIFACT","NOT_CREATED")
out("CANDIDATE_RUNTIME_SMOKE","NOT_PERFORMED")
out("CANDIDATE_HOSTED_PARITY","NOT_ESTABLISHED")
out("CANONICAL_SOURCE_DECISION","PENDING_REVIEW")
out("HOSTING_DEPLOY_GATE","BLOCKED")
out("PUBLIC_SITE_KEY_VALUE","NOT_READ_OR_PRINTED")
out("NETWORK_REQUESTS","0")
out("SOURCE_WRITES","0")
out("CLOUD_WRITES","0")
out("DEPLOY","NOT_PERFORMED")
out("RELEASE","NO_GO")
# 3 = intentionally blocked release, even when local manifest is structurally valid.
sys.exit(3)
