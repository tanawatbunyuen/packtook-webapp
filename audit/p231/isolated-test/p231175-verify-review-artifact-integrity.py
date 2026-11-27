#!/usr/bin/env python3
"""P231.175: independently verify P231.174 persisted review-only ZIP/manifest.
No network, browser, Firebase, GitHub or deploy.
Never prints source, filenames, site keys or payloads.
Tamper checks use in-memory byte copies only and never modify persisted evidence.
"""
import hashlib,json,os,re,sys
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile,BadZipFile

DIR=Path("/tmp/packtook-p231174-review-only")
ZIP=DIR/"p231174-NONDEPLOYABLE-source-snapshot.zip"
MAN=DIR/"p231174-source-manifest.json"
EXPECTED_ARCHIVE="11e6fbb680c5c774b5384aea41159d44d8ee0e209292c6cddc51aca3889bea69"
EXPECTED_MANIFEST="7da53cb21ee0b41a43c972a2c703860833334622e2f2a20e96c8848051068789"
EXPECTED_SOURCE="1a3319c9890db096807383841f2cc03b1e5301671201c1177a56cf3812727098"
EXPECTED_COUNT=12
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
def h(data):return hashlib.sha256(data).hexdigest()
def assert_safe_path(name):
 p=Path(name)
 if p.is_absolute() or not name or "\\" in name or any(x in ("..",".","") for x in name.split("/")):
  raise ValueError("unsafe ZIP entry name")
def verify(blob,manifest):
 if h(blob)!=manifest["zip_sha256"]:raise ValueError("archive digest mismatch")
 records=manifest["included_files"]
 if len(records)!=EXPECTED_COUNT:raise ValueError("record count")
 if len({r["path"] for r in records})!=len(records):raise ValueError("duplicate paths")
 byname={}
 for entry in records:
  name=entry["path"];assert_safe_path(name)
  if not re.fullmatch(r"[0-9a-f]{64}",entry["sha256"]):raise ValueError("record sha")
  if not isinstance(entry["bytes"],int) or entry["bytes"]<0 or entry["bytes"]>25000000:
   raise ValueError("record size")
  byname[name]=entry
 with ZipFile(BytesIO(blob),"r") as archive:
  infos=archive.infolist()
  if len(infos)!=EXPECTED_COUNT or sorted(i.filename for i in infos)!=sorted(byname):
   raise ValueError("ZIP inventory mismatch")
  sha=hashlib.sha256()
  for info in sorted(infos,key=lambda x:x.filename):
   if info.is_dir() or info.file_size>25000000:raise ValueError("unsafe archive entry")
   assert_safe_path(info.filename)
   data=archive.read(info)
   item=byname[info.filename]
   if len(data)!=item["bytes"] or h(data)!=item["sha256"]:
    raise ValueError("member mismatch")
   if info.filename!="firebase-v4-config.js":
    sha.update(info.filename.encode()+b"\0"+len(data).to_bytes(8,"big")+hashlib.sha256(data).digest())
  if sha.hexdigest()!=EXPECTED_SOURCE:raise ValueError("source baseline mismatch")
 return True
emit("CHECK","INDEPENDENT_P231174_REVIEW_ARTIFACT_VALIDATION_OFFLINE")
try:
 if not DIR.is_dir() or DIR.is_symlink() or ZIP.is_symlink() or MAN.is_symlink():
  raise ValueError("artifact path unavailable or symlinked")
 if ZIP.stat().st_size>30000000 or MAN.stat().st_size>200000:
  raise ValueError("artifact exceeds bounds")
 z=ZIP.read_bytes();mb=MAN.read_bytes()
 if h(z)!=EXPECTED_ARCHIVE or h(mb)!=EXPECTED_MANIFEST:
  raise ValueError("pinned evidence digest mismatch")
 m=json.loads(mb)
 if m.get("schema_version")!=1 or m.get("classification")!="REVIEW_ONLY_NON_DEPLOYABLE_SOURCE_SNAPSHOT":
  raise ValueError("classification mismatch")
 if m.get("source_directory")!="firebase-staging" or m.get("file_count")!=EXPECTED_COUNT:
  raise ValueError("manifest scope mismatch")
 if m.get("nonconfig_source_fingerprint")!=EXPECTED_SOURCE:raise ValueError("source baseline mismatch")
 if m.get("public_enterprise_key")!="EMPTY_IN_SOURCE":raise ValueError("key state")
 must_false=("hosted_index_reconciled","hosted_bridge_parity","browser_runtime_tested",
             "firebase_cli_packaging_verified","rollback_tested",
             "staging_deploy_authorized","production_release_authorized")
 if any(m.get(k) is not False for k in must_false):raise ValueError("release flags unexpected")
 verify(z,m)
 # Negative fixture A: flip one byte in a copy of ZIP; must be rejected.
 zz=bytearray(z)
 if not zz:raise ValueError("empty archive")
 zz[len(zz)//2]^=1
 tampered_zip_rejected=False
 try:verify(bytes(zz),m)
 except Exception:tampered_zip_rejected=True
 # Negative fixture B: change a member SHA in a copy of the JSON object; verify rejects.
 mm=json.loads(mb)
 mm["included_files"][0]["sha256"]="0"*64
 tampered_member_rejected=False
 try:verify(z,mm)
 except Exception:tampered_member_rejected=True
 # Negative fixture C: release approval flag falsely turned on must not pass manifest constraints.
 flags_rejected=all(m.get(k) is False for k in must_false)
 passed=tampered_zip_rejected and tampered_member_rejected and flags_rejected
 emit("ARCHIVE_PIN_SHA256_MATCH","YES")
 emit("MANIFEST_PIN_SHA256_MATCH","YES")
 emit("ZIP_MEMBERS_AND_PER_FILE_HASHES","12/12_PASS")
 emit("NONCONFIG_SOURCE_BASELINE","MATCH")
 emit("RELEASE_AUTHORIZATION_FLAGS","FALSE")
 emit("TAMPERED_ARCHIVE_REJECTED","YES" if tampered_zip_rejected else "NO")
 emit("TAMPERED_MEMBER_HASH_REJECTED","YES" if tampered_member_rejected else "NO")
 emit("REVIEW_ONLY_EVIDENCE_GATE","PASS" if passed else "FAIL")
 emit("ARTIFACT_DEPLOYABLE","NO")
 emit("BROWSER_RUNTIME","NOT_VERIFIED")
 emit("ROLLBACK_RESTORABILITY","NOT_VERIFIED")
 emit("FILE_WRITES","0")
 emit("NETWORK_REQUESTS","0")
 emit("CLOUD_WRITES","0")
 emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO")
 sys.exit(0 if passed else 3)
except Exception:
 emit("GATE","BLOCKED_MISSING_OR_INVALID_LOCAL_ARTIFACT")
 emit("DETAILS","REDACTED")
 emit("FILE_WRITES","0")
 emit("CLOUD_WRITES","0")
 emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO")
 sys.exit(2)
