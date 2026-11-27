#!/usr/bin/env python3
"""P231.174 OFFLINE SOURCE SNAPSHOT (INTENTIONALLY NON-DEPLOYABLE).

Produces deterministic 12-file ZIP and SHA-256 manifest under /tmp ONLY.
The checked-in staging config has blank reCAPTCHA key; no key injection.
Never invokes Firebase CLI, cloud services, browser or network.
"""
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile, ZipInfo, ZIP_STORED
import hashlib,json,os,re,stat,sys

ROOT=Path("firebase-staging")
OUT=Path("/tmp/packtook-p231174-review-only")
EXPECTED_NONCONFIG="1a3319c9890db096807383841f2cc03b1e5301671201c1177a56cf3812727098"
REQUIRED={"index.html","firebase-v4-config.js","firebase-packing-bridge.js",
 "video-history-db.js","video-stream-writer.js","performance-monitor.js","app.js"}
DANGEROUS={".pem",".key",".p12",".pfx",".sqlite",".db",".bak"}
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
def ignored(parts):return any(x.startswith(".") for x in parts) or "node_modules" in parts or parts[-1]=="firebase.json"
def files():
 result={}
 for base,dirs,names in os.walk(ROOT,followlinks=False):
  b=Path(base)
  filtered=[]
  for name in dirs:
   p=b/name
   if p.is_symlink():raise ValueError("symlink directory")
   if not ignored(p.relative_to(ROOT).parts):filtered.append(name)
  dirs[:]=filtered
  for name in names:
   p=b/name;relative=p.relative_to(ROOT);parts=relative.parts
   if ignored(parts):continue
   if p.is_symlink() or not stat.S_ISREG(p.stat().st_mode):raise ValueError("unsafe file type")
   if p.suffix.lower() in DANGEROUS:raise ValueError("dangerous extension")
   if p.stat().st_size>25000000:raise ValueError("file too large")
   result[relative.as_posix()]=p.read_bytes()
   if len(result)>10000:raise ValueError("too many files")
 return result
def digest_nonconfig(content):
 h=hashlib.sha256()
 for name,data in sorted(content.items()):
  if name=="firebase-v4-config.js":continue
  h.update(name.encode()+b"\0"+len(data).to_bytes(8,"big")+hashlib.sha256(data).digest())
 return h.hexdigest()
def build_zip(content):
 buffer=BytesIO()
 with ZipFile(buffer,"w",compression=ZIP_STORED,allowZip64=False) as z:
  for name,contents in sorted(content.items()):
   zi=ZipInfo(name,date_time=(1980,1,1,0,0,0))
   zi.compress_type=ZIP_STORED
   zi.create_system=3
   zi.external_attr=(0o100644<<16)
   z.writestr(zi,contents)
 return buffer.getvalue()
emit("CHECK","OFFLINE_NONDEPLOYABLE_SOURCE_SNAPSHOT")
try:
 cfg=json.loads(Path("firebase.json").read_text("utf8"))["hosting"]
 if cfg.get("public")!="firebase-staging" or set(cfg.get("ignore",[]))!={"firebase.json","**/.*","**/node_modules/**"}:
  raise ValueError("hosting config")
 content=files()
 if len(content)!=12 or not REQUIRED.issubset(content):raise ValueError("file manifest unexpected")
 config=content["firebase-v4-config.js"].decode("utf8")
 if not re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1\s*;',config):raise ValueError("key not blank")
 fingerprint=digest_nonconfig(content)
 if fingerprint!=EXPECTED_NONCONFIG:raise ValueError("source changed")
 archive1=build_zip(content);archive2=build_zip(content)
 if archive1!=archive2:raise ValueError("non-deterministic archive")
 manifest={
  "schema_version":1,
  "classification":"REVIEW_ONLY_NON_DEPLOYABLE_SOURCE_SNAPSHOT",
  "source_directory":"firebase-staging",
  "file_count":len(content),
  "included_files":[{"path":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in sorted(content.items())],
  "nonconfig_source_fingerprint":fingerprint,
  "zip_sha256":hashlib.sha256(archive1).hexdigest(),
  "public_enterprise_key":"EMPTY_IN_SOURCE",
  "hosted_index_reconciled":False,
  "hosted_bridge_parity":False,
  "browser_runtime_tested":False,
  "firebase_cli_packaging_verified":False,
  "rollback_tested":False,
  "staging_deploy_authorized":False,
  "production_release_authorized":False,
 }
 with ZipFile(BytesIO(archive1),"r") as z:
  if sorted(z.namelist())!=sorted(content):raise ValueError("archive entries")
  for name,data in content.items():
   if z.read(name)!=data:raise ValueError("archive byte mismatch")
 OUT.mkdir(mode=0o700,parents=True,exist_ok=True)
 os.chmod(OUT,0o700)
 zip_path=OUT/"p231174-NONDEPLOYABLE-source-snapshot.zip"
 manifest_path=OUT/"p231174-source-manifest.json"
 # Only these explicitly named artifacts are overwritten; never touch cloud or repo files.
 zip_path.write_bytes(archive1)
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 os.chmod(zip_path,0o600);os.chmod(manifest_path,0o600)
 emit("SOURCE_FILE_COUNT",len(content))
 emit("SOURCE_BASELINE_NONCONFIG_SHA256",fingerprint)
 emit("TWO_ZIP_BUILDS_IDENTICAL","YES")
 emit("ARCHIVE_ROUNDTRIP_BYTES","PASS")
 emit("ARCHIVE_SHA256",manifest["zip_sha256"])
 emit("MANIFEST_SHA256",hashlib.sha256(manifest_path.read_bytes()).hexdigest())
 emit("REVIEW_ONLY_ARTIFACT_DIR",str(OUT))
 emit("PERSISTENT_REVIEW_ONLY_SOURCE_SNAPSHOT","YES")
 emit("DEPLOYABLE_CANDIDATE_ARTIFACT","NO")
 emit("STAGING_PUBLIC_SITE_KEY","EMPTY")
 emit("HOSTED_INDEX_RECONCILIATION","NOT_IN_ARCHIVE")
 emit("BROWSER_RUNTIME","NOT_VERIFIED")
 emit("ROLLBACK","NOT_VERIFIED")
 emit("CLOUD_REQUESTS","0")
 emit("CLOUD_WRITES","0")
 emit("GITHUB_WRITES","0")
 emit("PRODUCTION_RELEASE","NO_GO")
 emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO")
 sys.exit(0)
except Exception:
 emit("GATE","BLOCKED_SOURCE_OR_ARCHIVE_BUILD")
 emit("DETAILS","REDACTED")
 emit("CLOUD_WRITES","0")
 emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO")
 sys.exit(2)
