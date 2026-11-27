#!/usr/bin/env python3
"""PACKTOOK Gate A2 read-only Hosting packaging preflight.

Local only. Verify immutable review ZIP, every file SHA and Firebase Hosting config
selection without invoking 'firebase deploy' (including its --dry-run flag).
This is NOT official Firebase CLI upload/manifest parity and does not approve release.
"""
import hashlib,io,json,pathlib,re,subprocess,sys,zipfile
ROOT=pathlib.Path.cwd()
DIR=pathlib.Path("/tmp/packtook-fast-track-gate-a-review")
Z=DIR/"gate-a-staging-REVIEW-NO-DEPLOY.zip"
M=DIR/"gate-a-staging-REVIEW-NO-DEPLOY.manifest.json"
PIN="ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2"
def show(k,v): print("PACKTOOK_"+k+"="+str(v),flush=True)
def sha(b):return hashlib.sha256(b).hexdigest()
show("CHECK","GATE_A2_HOSTING_ONLY_OFFLINE_PACKAGING_PREFLIGHT")
try:
 cfg=json.loads((ROOT/"firebase.json").read_text(encoding="utf8"))
 hosting=cfg["hosting"]
 if isinstance(hosting,list) or hosting.get("public")!="firebase-staging":raise ValueError("hosting scope")
 if set(hosting.get("ignore",[]))!={"firebase.json","**/.*","**/node_modules/**"}:
  raise ValueError("hosting ignores changed")
 # In-scope release includes Hosting ONLY. Functions/Firestore in the repository config
 # are not authorization to deploy those products.
 assert "functions" in cfg and "firestore" in cfg
 content=Z.read_bytes()
 if sha(content)!=PIN:raise ValueError("ZIP pin")
 manifest=json.loads(M.read_text(encoding="utf8"))
 if manifest["sha256_zip"]!=PIN or manifest["classification"]!="REVIEW_CANDIDATE_NOT_AUTHORIZED_FOR_DEPLOY":
  raise ValueError("manifest classification")
 assert manifest["file_count"]==12
 assert manifest["staging_deploy_authorized"] is False
 assert manifest["production_deploy_authorized"] is False
 assert manifest["public_signup_authorized"] is False
 expected={v["path"]:v for v in manifest["files"]}
 assert len(expected)==12
 with zipfile.ZipFile(io.BytesIO(content)) as z:
  infos=z.infolist()
  assert len(infos)==12 and len(set(i.filename for i in infos))==12
  for i in infos:
   p=i.filename
   if p not in expected or p.startswith("/") or "\\" in p or any(s in ("",".","..") for s in p.split("/")):
    raise ValueError("unsafe ZIP path")
   assert not i.is_dir() and 0<=i.file_size<=25000000
   b=z.read(i)
   assert expected[p]["bytes"]==len(b) and sha(b)==expected[p]["sha256"]
  assert {"index.html","firebase-v4-config.js","firebase-packing-bridge.js","app.js"}.issubset(expected)
  assert not any(p.startswith(".") or "/." in p or "node_modules" in p or p=="firebase.json" for p in expected)
  index=z.read("index.html").decode("utf8")
  assert len(re.findall(r'<script\b[^>]*\bsrc\s*=',index,re.I))==5
  for name in ("firebase-packing-bridge.js","app.js","video-history-db.js","video-stream-writer.js","performance-monitor.js"):
   assert re.search(r'\bsrc=["\x27]'+re.escape(name)+r'\?v=[A-Za-z0-9._-]+["\x27]',index)
 # Source package and repo remain staging scoped; review site target at approval.
 assert manifest["source_directory"]=="firebase-staging"
 assert manifest["staging_hosting_base"]=="packtook-staging.web.app"
 git=subprocess.run(["git","merge-base","--is-ancestor",manifest["source_commit"],"HEAD"],
  capture_output=True,timeout=10)
 assert git.returncode==0
except Exception:
 show("A2_LOCAL_PACKAGING","BLOCKED_INPUT_OR_SCOPE")
 show("FIREBASE_CLI_DRY_RUN","NOT_EXECUTED")
 show("CLOUD_WRITES","0")
 show("DEPLOY","NOT_PERFORMED")
 show("FULL_PUBLIC","NO_GO")
 sys.exit(2)
show("A2_LOCAL_PACKAGING","PASS_SCOPE_AND_MANIFEST")
show("ZIP_FILE_DIGESTS","12/12_PASS")
show("HOSTING_ONLY_INTENDED_SCOPE","YES")
show("FIRESTORE_AND_FUNCTIONS_IN_REPO","PRESENT_NOT_INCLUDED")
show("SOURCE_COMMIT_ANCESTRY","PASS")
show("INDEX_SCRIPT_GRAPH","5/5_PASS")
show("FIREBASE_CLI_UPLOAD_MANIFEST_PARITY","NOT_PROVEN")
show("FIREBASE_CLI_DRY_RUN","NOT_EXECUTED_SAFETY_BOUNDARY")
show("A2","PARTIAL_OFFLINE_PACKAGING_PASS")
show("CLOUD_WRITES","0")
show("DEPLOY","NOT_PERFORMED")
show("PUBLIC_SIGNUP","NOT_MODIFIED")
show("FULL_PUBLIC","NO_GO")
sys.exit(0)
