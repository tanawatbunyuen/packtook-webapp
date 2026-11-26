#!/usr/bin/env python3
"""P231.159 — transient, local-only staging Hosting candidate build and offline tests.
Reads hosted PUBLIC Enterprise site key from static Hosting bridge only.
The temporary candidate is deleted before exit. No deploy, business API, auth or IAM.
No source material, keys, paths, hashes, URLs or credentials are printed.
"""
from __future__ import annotations
from pathlib import Path
from tempfile import TemporaryDirectory
from html.parser import HTMLParser
from urllib.request import Request,urlopen
import json,re,shutil,sys

ROOT=Path("firebase-staging")
BASE="https://packtook-staging.web.app"
JS=("firebase-packing-bridge.js","video-history-db.js","video-stream-writer.js",
    "performance-monitor.js","app.js")
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
def flag(v):return "YES" if v else "NO"
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.src=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   x=dict(attrs).get("src")
   if x:self.src.append(x)
def get_public(name):
 req=Request(BASE+"/"+name,method="GET",headers={
  "Accept":"text/javascript,text/html,*/*","Cache-Control":"no-cache",
  "User-Agent":"PACKTOOK-P231159-StaticReadOnly"})
 with urlopen(req,timeout=18) as rsp:
  if rsp.status!=200:raise ValueError("public fetch status")
  content=rsp.read(2000001)
  if len(content)>2000000:raise ValueError("unexpected asset size")
  return content.decode("utf8")

emit("CHECK","STAGING_HOSTING_TRANSIENT_CANDIDATE_OFFLINE_TEST")
try:
 cfg=json.loads(Path("firebase.json").read_text("utf8"))
 if cfg.get("hosting",{}).get("public")!="firebase-staging":
  raise ValueError("hosting path mismatch")
 bridge=get_public("firebase-packing-bridge.js")
 hostcfg=get_public("firebase-v4-config.js")
 m=re.search(r'\bnew\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)',bridge)
 if not m or not re.fullmatch(r"[A-Za-z0-9_-]{20,300}",m.group(2)):
  raise ValueError("provider site key shape unverified")
 public_key=m.group(2)
 if not re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',hostcfg):
  raise ValueError("hosted config not staging")
 if not ROOT.is_dir():raise ValueError("missing staging directory")
except Exception:
 emit("GATE","BLOCKED_SOURCE_OR_HOSTED_PUBLIC_STATIC_READ")
 emit("CLOUD_WRITES","0");emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO");sys.exit(2)

try:
 with TemporaryDirectory(prefix="p231159-offline-") as tmp:
  target=Path(tmp)/"firebase-staging"
  shutil.copytree(ROOT,target)
  local_config=(target/"firebase-v4-config.js").read_text("utf8")
  pattern=r'(export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*)(["\x27])\2\s*;'
  if len(list(re.finditer(pattern,local_config)))!=1:
   raise ValueError("expected single empty site key")
  def replace(m):return m.group(1)+'"'+public_key+'";'
  candidate_config=re.sub(pattern,replace,local_config,count=1)
  (target/"firebase-v4-config.js").write_text(candidate_config,encoding="utf8")
  # Do not persist or print key or candidate files beyond this temporary scope.
  candidate_bridge=(target/"firebase-packing-bridge.js").read_text("utf8")
  candidate_index=(target/"index.html").read_text("utf8")
  parsed=Scripts();parsed.feed(candidate_index)
  got=[]
  for src in parsed.src:
   mm=re.fullmatch(r"([A-Za-z0-9_-]+\.js)\?v=([A-Za-z0-9._-]+)",src)
   if not mm:raise ValueError("unsupported or unversioned script")
   got.append(mm.group(1))
  tests={
   "HOSTING_MANIFEST_EXACT_FIVE_SCRIPTS":len(got)==5 and set(got)==set(JS),
   "ALL_FIVE_JS_ASSETS_PRESENT":all((target/n).is_file() for n in JS),
   "CANDIDATE_CONFIG_PUBLIC_SITE_KEY_NONEMPTY":'recaptchaEnterpriseSiteKey = "'+public_key+'";' in candidate_config,
   "STAGING_PROJECT_ID_PRESERVED":bool(re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',candidate_config)),
   "FUNCTIONS_SAME_APP_AND_REGION":bool(re.search(r'\bgetFunctions\s*\(\s*app\s*,\s*["\x27]asia-southeast1["\x27]',candidate_bridge)),
   "APPCHECK_INIT_AND_REFRESH":all(s in candidate_bridge for s in (
       "initializeAppCheck(app,","new ReCaptchaEnterpriseProvider(recaptchaEnterpriseSiteKey.trim())","isTokenAutoRefreshEnabled:true")),
   "STATUS_GUARD_PRESERVED":all(s in candidate_bridge for s in (
       "appCheckReady","protectedApi(\"usageStatus\")","protectedApi(\"recordingStatus\")")),
   "BRIDGE_BYTE_IDENTICAL_TO_REPO":candidate_bridge==(ROOT/"firebase-packing-bridge.js").read_text("utf8"),
   "INDEX_BYTE_IDENTICAL_TO_REPO":candidate_index==(ROOT/"index.html").read_text("utf8"),
   "UNRELATED_FOUR_JS_IDENTICAL":all((target/n).read_bytes()==(ROOT/n).read_bytes()
       for n in JS if n!="firebase-packing-bridge.js")
  }
  for k,v in tests.items():emit(k,flag(v))
  test_pass=all(tests.values())
  emit("OFFLINE_TESTS",f"{sum(tests.values())}/{len(tests)}_"+("PASS" if test_pass else "FAIL"))
  emit("CANDIDATE_ARTIFACT","TRANSIENT_ONLY")
  emit("CANDIDATE_PUBLIC_KEY_VALUE","NOT_PRINTED")
  emit("KEY_CONFIG_EXPORT_AFTER_BUILD","NONEMPTY")
  emit("SITE_KEY_PROVENANCE","HOSTED_STAGING_PUBLIC_ASSET")
 # TemporaryDirectory cleans up only the local test copy, never Cloud resources.
 emit("TEMPORARY_CANDIDATE_AFTER_SCOPE","DISCARDED")
 emit("GIT_SOURCE_MODIFIED","NO")
 emit("HOSTED_SOURCE_PARITY","STILL_UNVERIFIED")
 emit("RUNTIME_SMOKE","NOT_PERFORMED")
 emit("HOSTING_DEPLOY_GATE","BLOCKED_PENDING_RECONCILIATION_AND_RELEASE_APPROVAL")
 emit("CLOUD_REQUESTS","STATIC_GET_ONLY")
 emit("AUTH_TOKEN_REQUESTS","0")
 emit("FUNCTION_INVOCATIONS","0")
 emit("CLOUD_WRITES","0")
 emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO")
 sys.exit(0 if test_pass else 3)
except Exception:
 emit("GATE","BLOCKED_CANDIDATE_BUILD_OR_ASSERTION")
 emit("CLOUD_WRITES","0")
 emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO")
 sys.exit(2)
