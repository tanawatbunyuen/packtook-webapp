#!/usr/bin/env python3
"""P231.160 — read-only staging Hosting asset and rollback readiness manifest.
Fetch public static hosted files only; no API, auth, cloud writes, deploy.
Print only static asset names, parity and safety gate flags; never source/key.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request,urlopen
import json,re,sys,hashlib
BASE="https://packtook-staging.web.app"
ROOT=Path("firebase-staging")
ASSETS=("index.html","firebase-v4-config.js","firebase-packing-bridge.js",
        "video-history-db.js","video-stream-writer.js","performance-monitor.js","app.js")
def out(k,v):print("P231_"+k+"="+str(v),flush=True)
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   src=dict(attrs).get("src")
   if src:self.refs.append(src)
def public(name):
 req=Request(BASE+"/"+name,headers={"Accept":"*/*","Cache-Control":"no-cache",
       "User-Agent":"PACKTOOK-P231160-StaticAudit"},method="GET")
 with urlopen(req,timeout=18) as response:
  if response.status!=200:raise ValueError("HTTP status")
  data=response.read(2000001)
  if len(data)>2000000:raise ValueError("oversize")
  return data
out("CHECK","HOSTING_RELEASE_MANIFEST_READONLY")
try:
 firebase=json.loads(Path("firebase.json").read_text("utf8"))
 if firebase.get("hosting",{}).get("public")!="firebase-staging":
  raise ValueError("unexpected deploy source")
 local={a:(ROOT/a).read_bytes() for a in ASSETS}
 hosted={a:public(a) for a in ASSETS}
 index_l=Scripts();index_l.feed(local["index.html"].decode("utf8"))
 index_h=Scripts();index_h.feed(hosted["index.html"].decode("utf8"))
 allowed=set(a for a in ASSETS if a.endswith(".js") and a!="firebase-v4-config.js")
 def valid_refs(refs):
  got=[]
  for ref in refs:
   m=re.fullmatch(r"([A-Za-z0-9_-]+\.js)\?v=[A-Za-z0-9._-]+",ref)
   if not m: return False
   got.append(m.group(1))
  return len(got)==len(allowed) and set(got)==allowed
 if not valid_refs(index_l.refs) or not valid_refs(index_h.refs):
  raise ValueError("unreviewed script")
except Exception:
 out("MANIFEST_GATE","BLOCKED_SOURCE_OR_PUBLIC_ASSET")
 out("DEPLOY","NOT_PERFORMED")
 out("RELEASE","NO_GO")
 sys.exit(2)
out("STATIC_ASSET_COUNT",len(ASSETS))
out("INDEX_SCRIPT_MANIFEST","EXPECTED_FIVE")
out("LOCAL_HOSTED_CONTENT_MATCH_COUNT",sum(local[a]==hosted[a] for a in ASSETS))
out("LOCAL_HOSTED_CONTENT_DRIFT_COUNT",sum(local[a]!=hosted[a] for a in ASSETS))
for name in ASSETS:
 label=name.upper().replace("-","_").replace(".","_")
 out("ASSET_"+label+"_PARITY","MATCH" if local[name]==hosted[name] else "DRIFT")
# Integrity evidence without outputting source-dependent digests or public-key-derived hashes.
# We can verify bytes in memory but cannot claim a durable rollback snapshot without saving it.
local_config=local["firebase-v4-config.js"].decode("utf8")
hosted_config=hosted["firebase-v4-config.js"].decode("utf8")
out("REPO_SITE_KEY_EXPORT_EMPTY","YES" if re.search(
 r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1\s*;',local_config) else "NO")
out("HOSTED_CONFIG_STAGING_PROJECT","YES" if re.search(
 r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',hosted_config) else "NO")
out("ROLLBACK_SNAPSHOT_PERSISTED","NO")
out("ROLLBACK_FIREBASE_HOSTING_VERSION_PIN","NOT_CAPTURED")
out("CANDIDATE_BUILD_PERSISTED","NO")
out("CANDIDATE_RUNTIME_SMOKE","NOT_PERFORMED")
out("CANONICAL_SOURCE_PARITY","DRIFT" if any(local[a]!=hosted[a] for a in ASSETS) else "MATCH")
out("RELEASE_BLOCKERS","SOURCE_DRIFT_ROLLBACK_ARTIFACT_APPROVAL")
out("DEPLOY_SCOPE_REQUIRED","STAGING_HOSTING_ONLY")
out("PUBLIC_SITE_KEY_AND_SOURCE_VALUES","NOT_PRINTED")
out("NETWORK_REQUESTS","PUBLIC_STATIC_GET_ONLY")
out("CLOUD_WRITES","0")
out("BUSINESS_CALLS","0")
out("DEPLOY","NOT_PERFORMED")
out("RELEASE","NO_GO")
# Successful inventory is not deployment authorization.
sys.exit(0)
