#!/usr/bin/env python3
"""PACKTOOK Fast Track Gate A consolidated, independent, OFFLINE artifact inspection.
Checks persisted candidate against operator-observed SHA-256 pins and source.
Requires no network, credentials, browser, deployment or code writes.
Outputs only aggregate flags; always NO_GO until independent release gates.
"""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import hashlib,json,re,shutil,subprocess,sys

DIR=Path("/tmp/packtook-fast-track-gate-a-review")
ZIP=DIR/"gate-a-staging-REVIEW-NO-DEPLOY.zip"
META=DIR/"gate-a-staging-REVIEW-NO-DEPLOY.manifest.json"
ARCHIVE_SHA="ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2"
# These are operator-observed manifests from two verified builds of the SAME ZIP.
# Their source_commit fields differ because the repository advanced between runs.
OBSERVED_MANIFEST_SHAS={
 "91f2c2d3b0b313cb1c777966213622550be9becdb5034d87f5b75c6d0ca57f2a",
 "761612812aa48e6c69d4c51778502c9020d04bbd525036371c1cbe6616131892",
}
SOURCE_BASELINE="1a3319c9890db096807383841f2cc03b1e5301671201c1177a56cf3812727098"
KEYPAT=r'(export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*)(["\x27])([^"\x27]*)\2\s*;'
ALLOWED={"index.html","firebase-v4-config.js","firebase-packing-bridge.js","app.js",
         "video-history-db.js","video-stream-writer.js","performance-monitor.js"}
def out(k,v):print("PACKTOOK_"+k+"="+str(v),flush=True)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def valid_name(name):
 return bool(name and not name.startswith("/") and "\\" not in name and
             not any(p in ("",".","..") for p in name.split("/")))
out("CHECK","GATE_A_INDEPENDENT_CANDIDATE_INTEGRITY_AND_RELEASE_BLOCKERS")
try:
 if not DIR.is_dir() or DIR.is_symlink() or ZIP.is_symlink() or META.is_symlink():
  raise ValueError("missing artifact")
 if ZIP.stat().st_size>30000000 or META.stat().st_size>300000:raise ValueError("size")
 arc=ZIP.read_bytes();metabytes=META.read_bytes()
 if sha(arc)!=ARCHIVE_SHA or sha(metabytes) not in OBSERVED_MANIFEST_SHAS:raise ValueError("observed pins")
 m=json.loads(metabytes)
 assert m["schema_version"]==1
 assert m["classification"]=="REVIEW_CANDIDATE_NOT_AUTHORIZED_FOR_DEPLOY"
 assert m["source_directory"]=="firebase-staging"
 assert m["staging_hosting_base"]=="packtook-staging.web.app"
 assert m["file_count"]==12 and len(m["files"])==12
 assert m["sha256_zip"]==ARCHIVE_SHA
 assert m["source_nonconfig_baseline_sha256"]==SOURCE_BASELINE
 assert re.fullmatch("[0-9a-f]{40}",m["source_commit"])
 assert m["local_bridge_guard_preserved"] is True
 for name in ("registered_origin_browser_runtime_tested","source_reconciliation_reviewed",
              "firebase_cli_packaging_verified","rollback_exercised",
              "staging_deploy_authorized","production_deploy_authorized","public_signup_authorized"):
  assert m[name] is False
 assert m["public_signup_state_at_build"]=="NOT_PROBED"
 rows=m["files"]
 names=[row["path"] for row in rows]
 assert len(names)==len(set(names)) and ALLOWED.issubset(names)
 assert all(valid_name(name) for name in names)
 table={row["path"]:row for row in rows}
 with ZipFile(BytesIO(arc),"r") as z:
  infos=z.infolist()
  assert len(infos)==12 and sorted(info.filename for info in infos)==sorted(names)
  payload={}
  for info in infos:
   assert not info.is_dir() and 0<=info.file_size<=25000000 and valid_name(info.filename)
   raw=z.read(info)
   r=table[info.filename]
   assert len(raw)==r["bytes"] and sha(raw)==r["sha256"]
   payload[info.filename]=raw
 base=Path("firebase-staging")
 assert (base/"firebase-packing-bridge.js").read_bytes()==payload["firebase-packing-bridge.js"]
 c=payload["firebase-v4-config.js"].decode("utf8")
 localc=(base/"firebase-v4-config.js").read_text("utf8")
 key=re.findall(KEYPAT,c)
 assert len(key)==1 and re.fullmatch("[A-Za-z0-9_-]{20,300}",key[0][2])
 assert len(re.findall(KEYPAT,localc))==1
 assert re.findall(KEYPAT,localc)[0][2]==""
 # Ensure ONLY the public site key was added to the candidate config.
 stripped=re.sub(KEYPAT,lambda x:x.group(1)+'"";',c,count=1)
 assert stripped==localc
 bridge=payload["firebase-packing-bridge.js"].decode("utf8")
 assert all(needle in bridge for needle in ('protectedApi("usageStatus")',
   'protectedApi("recordingStatus")',"initializeAppCheck(app,"))
 assert b"packtook-staging" in payload["firebase-v4-config.js"]
 # The builder pinned its own commit; Git pull to run the verifier advances HEAD.
 # Require the source commit is an ancestor, never falsely demand HEAD equality.
 lineage=subprocess.run(["git","merge-base","--is-ancestor",m["source_commit"],"HEAD"],
                        capture_output=True,text=True,timeout=10)
 assert lineage.returncode==0
 assert sha(arc)==ARCHIVE_SHA and sha(metabytes) in OBSERVED_MANIFEST_SHAS
except Exception:
 out("INDEPENDENT_ARTIFACT_EVIDENCE","BLOCKED_OR_CHANGED")
 out("GATE_A","BLOCKED")
 out("FILE_WRITES","0")
 out("NETWORK_REQUESTS","0")
 out("CLOUD_WRITES","0")
 out("DEPLOY","NOT_PERFORMED")
 out("FULL_PUBLIC","NO_GO")
 sys.exit(2)
out("INDEPENDENT_ARTIFACT_EVIDENCE","PASS_REVIEW_ONLY")
out("CANDIDATE_FILE_HASHES","12/12_PASS")
out("OPERATOR_OBSERVED_PINS","MATCH")\nout("MANIFEST_REBUILD_HASH","OBSERVED_ALLOWLIST_MATCH")
out("SOURCE_COMMIT","PIN_IS_ANCESTOR_OF_CURRENT_HEAD")
out("BRIDGE_BYTES","SAME_AS_REPOSITORY")
out("CONFIG_ONLY_PUBLIC_SITE_KEY_CHANGE","VERIFIED")
out("SOURCE_KEY_EXPORT","STILL_EMPTY")
out("NO_DEPLOY_APPROVAL_FLAGS","VERIFIED")
out("GATE_A1_SOURCE_SEMANTIC_REVIEW","REQUIRED")
out("GATE_A2_PERSISTENT_CANDIDATE_INTEGRITY","VERIFIED_REVIEW_ONLY")
out("GATE_A2_FIREBASE_CLI_PACKAGING","NOT_VERIFIED")
out("GATE_A3_BROWSER_SMOKE","NOT_PERFORMED")
out("GATE_A4_ROLLBACK_REHEARSAL","NOT_PERFORMED")
out("BROWSER_RUNNER_AVAILABLE","YES" if any(shutil.which(x) for x in ("chromium","chromium-browser","google-chrome","google-chrome-stable")) else "NO")
out("CANDIDATE_ORIGIN_REGISTERED","NOT_VERIFIED")
out("GATE_A","BLOCKED")
out("FILE_WRITES","0")
out("NETWORK_REQUESTS","0")
out("CLOUD_WRITES","0")
out("DEPLOY","NOT_PERFORMED")
out("PUBLIC_SIGNUP","NOT_MODIFIED")
out("FULL_PUBLIC","NO_GO")
sys.exit(0)
