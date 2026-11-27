#!/usr/bin/env python3
"""PACKTOOK Fast Track Gate A — offline-only persistent staging candidate build.

Reads three PUBLIC staging Hosting assets over HTTPS solely to construct candidate.
No Firebase Admin/API calls, deploys, signup, IAM or GitHub mutations.
Produces a review-only candidate ZIP + complete manifest in /tmp; source untouched.
Public reCAPTCHA site key is never printed or checked into Git.
The artifact is NOT authorized for deploy; only a human-reviewed version may be used.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from html.parser import HTMLParser
from zipfile import ZipFile,ZipInfo,ZIP_STORED
from io import BytesIO
import hashlib,json,os,re,stat,subprocess,sys

ROOT=Path("firebase-staging")
OUT=Path("/tmp/packtook-fast-track-gate-a-review")
BASE="https://packtook-staging.web.app/"
EXPECTED_NONCONFIG="1a3319c9890db096807383841f2cc03b1e5301671201c1177a56cf3812727098"
CORE={"index.html","firebase-v4-config.js","firebase-packing-bridge.js",
"app.js","video-history-db.js","video-stream-writer.js","performance-monitor.js"}
SCRIPTS={"firebase-packing-bridge.js","app.js","video-history-db.js","video-stream-writer.js","performance-monitor.js"}
IGNORED={"firebase.json","**/.*","**/node_modules/**"}
def out(k,v):print("PACKTOOK_"+k+"="+str(v),flush=True)
def sha(d):return hashlib.sha256(d).hexdigest()
def ignored(p):return any(s.startswith(".") for s in p) or "node_modules" in p or p[-1]=="firebase.json"
def read_tree():
 items={}
 for base,ds,fs in os.walk(ROOT,followlinks=False):
  b=Path(base)
  safe_dirs=[]
  for d in ds:
   p=b/d
   if p.is_symlink():raise ValueError("symlink directory")
   if not ignored(p.relative_to(ROOT).parts):safe_dirs.append(d)
  ds[:]=safe_dirs
  for f in fs:
   p=b/f
   name=p.relative_to(ROOT).as_posix()
   if ignored(p.relative_to(ROOT).parts):continue
   if p.is_symlink() or not stat.S_ISREG(p.stat().st_mode):raise ValueError("unsupported file")
   if p.stat().st_size>25000000:raise ValueError("oversize file")
   if p.suffix.lower() in (".pem",".key",".p12",".pfx",".sqlite",".db",".bak"):
    raise ValueError("risky extension")
   items[name]=p.read_bytes()
   if len(items)>10000:raise ValueError("too many files")
 return items
def source_digest(items):
 h=hashlib.sha256()
 for name,data in sorted(items.items()):
  if name=="firebase-v4-config.js":continue
  h.update(name.encode()+b"\0"+len(data).to_bytes(8,"big")+hashlib.sha256(data).digest())
 return h.hexdigest()
def fetch_public(name):
 r=Request(BASE+name,method="GET",headers={"Accept":"*/*","Cache-Control":"no-cache",
                                           "User-Agent":"PACKTOOK-GateA-StaticOnly"})
 with urlopen(r,timeout=18) as response:
  if response.status!=200:raise ValueError("public response")
  data=response.read(2000001)
  if len(data)>2000000:raise ValueError("public response too large")
  return data.decode("utf8")
PAT=re.compile(r'(<script\b[^>]*\bsrc\s*=\s*)(["\x27])([^"\x27]+)\2',re.I)
def normalize(s):
 def f(m):
  p,q,u=m.groups()
  return p+q+u.partition("?")[0]+"?v=MASKED"+q if re.fullmatch(
   r"[A-Za-z0-9._/-]+\.js\?v=[A-Za-z0-9._-]+",u) else m.group(0)
 return PAT.sub(f,s)
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.sources=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   src=dict(attrs).get("src")
   if src:self.sources.append(src)
def zip_bytes(items):
 buf=BytesIO()
 with ZipFile(buf,"w",compression=ZIP_STORED,allowZip64=False) as z:
  for name,data in sorted(items.items()):
   info=ZipInfo(name,date_time=(1980,1,1,0,0,0))
   info.compress_type=ZIP_STORED
   info.create_system=3
   info.external_attr=0o100644<<16
   z.writestr(info,data)
 return buf.getvalue()
out("CHECK","FAST_TRACK_GATE_A_COMPLETE_REVIEW_CANDIDATE_BUILD")
try:
 h=json.loads(Path("firebase.json").read_text("utf8"))["hosting"]
 if h.get("public")!="firebase-staging" or set(h.get("ignore",[]))!=IGNORED:
  raise ValueError("hosting config")
 base=read_tree()
 if len(base)!=12 or not CORE.issubset(base) or source_digest(base)!=EXPECTED_NONCONFIG:
  raise ValueError("unreviewed source baseline")
 cfg=base["firebase-v4-config.js"].decode("utf8")
 orig_idx=base["index.html"].decode("utf8")
 bridge=base["firebase-packing-bridge.js"].decode("utf8")
 if not all(x in bridge for x in (
    'protectedApi("usageStatus")','protectedApi("recordingStatus")',
    "initializeAppCheck(app,","new ReCaptchaEnterpriseProvider(recaptchaEnterpriseSiteKey.trim())")):
  raise ValueError("bridge guard")
 keypat=r'(export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*)(["\x27])\2\s*;'
 if len(re.findall(keypat,cfg))!=1:raise ValueError("config not empty")
 hosted_index=fetch_public("index.html")
 hosted_cfg=fetch_public("firebase-v4-config.js")
 hosted_bridge=fetch_public("firebase-packing-bridge.js")
 if normalize(orig_idx)!=normalize(hosted_index):raise ValueError("index content drift")
 for c in (cfg,hosted_cfg):
  if not re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',c):
   raise ValueError("project mismatch")
 key_match=re.search(r'new\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)',hosted_bridge)
 if not key_match or not re.fullmatch(r"[A-Za-z0-9_-]{20,300}",key_match.group(2)):
  raise ValueError("public staging key shape")
 key=key_match.group(2)
 idx=Scripts();idx.feed(hosted_index)
 found=[]
 for src in idx.sources:
  m=re.fullmatch(r"([A-Za-z0-9_-]+\.js)\?v=[A-Za-z0-9._-]+",src)
  if not m:raise ValueError("unsupported script reference")
  found.append(m.group(1))
 if len(found)!=5 or set(found)!=SCRIPTS:raise ValueError("unreviewed script graph")
 candidate=dict(base)
 candidate["index.html"]=hosted_index.encode("utf8")
 candidate["firebase-v4-config.js"]=re.sub(keypat,lambda m:m.group(1)+'"'+key+'";',cfg,count=1).encode("utf8")
 archive=zip_bytes(candidate)
 if archive!=zip_bytes(candidate):raise ValueError("nonrepeatable archive")
 with ZipFile(BytesIO(archive),"r") as z:
  if sorted(z.namelist())!=sorted(candidate):raise ValueError("archive manifest")
  if any(z.read(name)!=data for name,data in candidate.items()):
   raise ValueError("archive bytes mismatch")
 git=subprocess.run(["git","rev-parse","HEAD"],capture_output=True,text=True,timeout=10)
 if git.returncode or not re.fullmatch(r"[0-9a-f]{40}",git.stdout.strip()):
  raise ValueError("source commit unavailable")
 commit=git.stdout.strip()
 manifest={
  "schema_version":1,"classification":"REVIEW_CANDIDATE_NOT_AUTHORIZED_FOR_DEPLOY",
  "source_commit":commit,"source_directory":"firebase-staging",
  "staging_hosting_base":"packtook-staging.web.app",
  "file_count":len(candidate),
  "files":[{"path":name,"bytes":len(data),"sha256":sha(data)}
           for name,data in sorted(candidate.items())],
  "sha256_zip":sha(archive),
  "source_nonconfig_baseline_sha256":EXPECTED_NONCONFIG,
  "transforms":[
   "hosted_index_query_versions_only_after_normalized_parity",
   "staging_public_recaptcha_enterprise_site_key_temp_build_only"],
  "local_bridge_guard_preserved":candidate["firebase-packing-bridge.js"]==base["firebase-packing-bridge.js"],
  "public_signup_state_at_build":"NOT_PROBED",
  "registered_origin_browser_runtime_tested":False,
  "source_reconciliation_reviewed":False,
  "firebase_cli_packaging_verified":False,
  "rollback_exercised":False,
  "staging_deploy_authorized":False,
  "production_deploy_authorized":False,
  "public_signup_authorized":False,
 }
 OUT.mkdir(parents=True,mode=0o700,exist_ok=True)
 os.chmod(OUT,0o700)
 artifact=OUT/"gate-a-staging-REVIEW-NO-DEPLOY.zip"
 meta=OUT/"gate-a-staging-REVIEW-NO-DEPLOY.manifest.json"
 artifact.write_bytes(archive)
 meta.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
 os.chmod(artifact,0o600);os.chmod(meta,0o600)
 out("GATE_A_ARTIFACT_BUILD","PASS_REVIEW_ONLY")
 out("SOURCE_COMMIT_PINNED","YES")
 out("FILE_COUNT",len(candidate))
 out("DETERMINISTIC_ZIP","YES")
 out("ARCHIVE_ROUNDTRIP","PASS")
 out("LOCAL_BRIDGE_FAIL_CLOSED","PRESERVED")
 out("INDEX_VERSION_REFERENCES","HOSTED_PARITY")
 out("PUBLIC_STAGING_SITE_KEY","INJECTED_NOT_PRINTED")
 out("ARTIFACT_SHA256",manifest["sha256_zip"])
 out("MANIFEST_SHA256",sha(meta.read_bytes()))
 out("ARTIFACT_DIR",str(OUT))
 out("GATE_A1_SOURCE_REVIEW","OPEN")
 out("GATE_A2_ARTIFACT_BUILD","CANDIDATE_CREATED_REVIEW_PENDING")
 out("GATE_A3_BROWSER","OPEN")
 out("GATE_A4_ROLLBACK","OPEN")
 out("PUBLIC_SIGNUP","NOT_MODIFIED")
 out("FIREBASE_CLI_PACKAGING","NOT_VERIFIED")
 out("CLOUD_REQUESTS","THREE_PUBLIC_HOSTING_STATIC_GET_ONLY")
 out("CLOUD_WRITES","0")
 out("DEPLOY","NOT_PERFORMED")
 out("FULL_PUBLIC","NO_GO")
 sys.exit(0)
except Exception:
 out("GATE_A_ARTIFACT_BUILD","BLOCKED_OR_UNVERIFIED")
 out("ERROR_DETAILS","REDACTED")
 out("CLOUD_WRITES","0")
 out("DEPLOY","NOT_PERFORMED")
 out("FULL_PUBLIC","NO_GO")
 sys.exit(2)
