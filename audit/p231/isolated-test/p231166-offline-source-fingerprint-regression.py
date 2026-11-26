#!/usr/bin/env python3
"""P231.166: offline source-integrity regression gate with pinned P231.165 SHA-256.
No cloud or network access, no source writes. A changed baseline fails closed.
Config remains excluded; passing does not mean full Hosting release readiness.
"""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re,sys
EXPECTED="62b0608c2b617f9dcd30c6a06fed78c7b62301f52cd5064ff8624d8633224bc4"
ROOT=Path("firebase-staging")
PIN=Path("audit/p231/isolated-test/p231164-staging-live-release-pin.json")
ASSETS=("index.html","firebase-packing-bridge.js","video-history-db.js",
        "video-stream-writer.js","performance-monitor.js","app.js")
def emit(k,v):print(f"P231_{k}={v}",flush=True)
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.sources=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   src=dict(attrs).get("src")
   if src:self.sources.append(src)
emit("CHECK","OFFLINE_SOURCE_FINGERPRINT_REGRESSION_GATE")
try:
 p=json.loads(PIN.read_text("utf8"))
 assert p["site"]=="packtook-staging" and p["channel"]=="live"
 assert p["staging_deploy_authorized"] is False
 assert p["production_release_authorized"] is False
 cfg=json.loads(Path("firebase.json").read_text("utf8"))
 assert cfg["hosting"]["public"]=="firebase-staging"
 data={name:(ROOT/name).read_bytes() for name in ASSETS}
 s=Scripts();s.feed(data["index.html"].decode("utf8"))
 found=[]
 for source in s.sources:
  m=re.fullmatch(r"([A-Za-z0-9_-]+\.js)\?v=[A-Za-z0-9._-]+",source)
  if not m:raise ValueError("unexpected script reference")
  found.append(m.group(1))
 if len(found)!=5 or set(found)!=(set(ASSETS)-{"index.html"}):
  raise ValueError("manifest has changed")
 conf=(ROOT/"firebase-v4-config.js").read_text("utf8")
 is_empty=bool(re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1\s*;',conf))
 if not is_empty:raise ValueError("unexpected site key config state")
except Exception:
 emit("GATE","BLOCKED_MISSING_OR_CHANGED_INPUTS")
 emit("NETWORK_REQUESTS","0")
 emit("CLOUD_WRITES","0")
 emit("RELEASE","NO_GO")
 sys.exit(2)

h=hashlib.sha256()
for name in sorted(ASSETS):
 raw=data[name]
 h.update(name.encode("utf8")+b"\0"+len(raw).to_bytes(8,"big")+raw)
actual=h.hexdigest()
same=actual==EXPECTED
emit("SOURCE_ASSET_COUNT",len(ASSETS))
emit("BASELINE_SOURCE_SHA256",EXPECTED)
emit("CURRENT_SOURCE_SHA256",actual)
emit("FINGERPRINT_PARITY","MATCH" if same else "DRIFT")
emit("SITE_KEY_CONFIG_EXCLUDED","YES")
emit("SOURCE_CHANGE_POLICY","BLOCK_AND_REVIEW" if not same else "BASELINE_INTACT")
emit("PERSISTENT_CANDIDATE","NOT_CREATED")
emit("COMPLETE_DEPLOY_ARTIFACT","NOT_FINGERPRINTED")
emit("ROLLBACK_READINESS","NOT_VERIFIED")
emit("DEPLOY_APPROVAL","NOT_GRANTED")
emit("NETWORK_REQUESTS","0")
emit("FILE_WRITES","0")
emit("CLOUD_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
sys.exit(0 if same else 3)
