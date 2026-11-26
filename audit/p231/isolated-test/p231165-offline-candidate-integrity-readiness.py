#!/usr/bin/env python3
"""P231.165 offline candidate asset manifest and recovery checklist.
No network, no credentials, no file writes; hashes only NON-config JS/HTML.
Does not claim the current staged Hosting release can be restored.
"""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re,sys

ROOT=Path("firebase-staging")
PIN=Path("audit/p231/isolated-test/p231164-staging-live-release-pin.json")
SAFE_ASSETS=("index.html","firebase-packing-bridge.js","video-history-db.js",
             "video-stream-writer.js","performance-monitor.js","app.js")
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
class Index(HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   src=dict(attrs).get("src")
   if src:self.refs.append(src)
emit("CHECK","OFFLINE_RELEASE_CANDIDATE_MANIFEST_AND_RECOVERY_READINESS")
try:
 pin=json.loads(PIN.read_text(encoding="utf8"))
 assert pin["site"]=="packtook-staging" and pin["channel"]=="live"
 assert pin["rollback_tested"] is False
 assert pin["artifact_backup_created"] is False
 assert pin["staging_deploy_authorized"] is False
 assert pin["production_release_authorized"] is False
 cfg=json.loads(Path("firebase.json").read_text("utf8"))
 assert cfg["hosting"]["public"]=="firebase-staging"
 config_text=(ROOT/"firebase-v4-config.js").read_text("utf8")
 empty_key=bool(re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1\s*;',config_text))
 assert empty_key
 assets={f:(ROOT/f).read_bytes() for f in SAFE_ASSETS}
 parsed=Index();parsed.feed(assets["index.html"].decode("utf8"))
 matched=[]
 for src in parsed.refs:
  m=re.fullmatch(r"([a-zA-Z0-9_-]+\.js)\?v=[a-zA-Z0-9._-]+",src)
  if not m:raise ValueError("unexpected script ref")
  matched.append(m.group(1))
 assert len(matched)==5 and set(matched)==set(SAFE_ASSETS)-{"index.html"}
except Exception:
 emit("GATE","BLOCKED_OFFLINE_INPUT_OR_MANIFEST")
 emit("CLOUD_WRITES","0")
 emit("RELEASE","NO_GO")
 sys.exit(2)

# Do not emit candidate config hashes or a non-reproducible placeholder.
digest=hashlib.sha256()
for name in sorted(SAFE_ASSETS):
 raw=assets[name]
 digest.update(name.encode("utf8")+b"\0"+len(raw).to_bytes(8,"big")+raw)
non_config_digest=digest.hexdigest()
emit("RELEASE_PIN_FILE","P231164_PRESENT")
emit("RELEASE_PIN_CURRENTNESS","LAST_VALIDATED_P231164_NOT_RECHECKED")
emit("LOCAL_HOSTING_DIRECTORY","EXPECTED_STAGING")
emit("NONCONFIG_ASSETS_COUNT",len(SAFE_ASSETS))
emit("NONCONFIG_ASSET_MANIFEST_SHA256",non_config_digest)
emit("CONFIG_EXCLUDED_FROM_HASH","YES")
emit("SITE_KEY_CONFIG","EMPTY_IN_REPO")
emit("SITE_KEY_INJECTION","REQUIRED_FOR_DEPLOYABLE_CANDIDATE")
emit("COMPLETE_CANDIDATE_MANIFEST","NOT_CREATED")
emit("PERSISTENT_CANDIDATE_BUILD","NOT_CREATED")
emit("HOSTED_SOURCE_PARITY","NOT_ESTABLISHED")
emit("BACKUP_OF_CURRENT_HOSTING","NOT_CREATED")
emit("ROLLBACK_EXECUTION","NOT_TESTED")
emit("ROLLBACK_READINESS","BLOCKED")
emit("RUNTIME_SMOKE","NOT_PERFORMED")
emit("STAGING_DEPLOY_APPROVAL","NOT_GRANTED")
emit("PRODUCTION_RELEASE","NO_GO")
emit("API_REQUESTS","0")
emit("FILE_WRITES","0")
emit("CLOUD_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
sys.exit(0)
