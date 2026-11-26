#!/usr/bin/env python3
"""P231.167: offline full Hosting source inventory and safety preflight.

No network, no file writes, no site-key values, no filenames outside an allowlist.
This models the explicitly configured Hosting ignore entries but does NOT claim
byte-exact Firebase CLI deploy packaging. Release stays blocked.
"""
from pathlib import Path
import hashlib,json,os,re,stat,sys

ROOT=Path("firebase-staging")
EXPECTED_IGNORE={"firebase.json","**/.*","**/node_modules/**"}
REQUIRED={"index.html","firebase-v4-config.js","firebase-packing-bridge.js",
          "video-history-db.js","video-stream-writer.js","performance-monitor.js","app.js"}
RISK_EXT={".pem",".p12",".pfx",".key",".sqlite",".db",".bak"}
RISK_NAMES={"service-account.json","serviceaccount.json","credentials.json",
            "firebase-adminsdk.json","id_rsa","id_ed25519",".env"}
def emit(k,v):print(f"P231_{k}={v}",flush=True)
def excluded(parts):
    # Explicit Firebase Hosting ignore patterns used by this repo.
    return any(p.startswith(".") for p in parts) or "node_modules" in parts or parts[-1]=="firebase.json"
def sensitive(parts):
    return any(p.lower() in RISK_NAMES for p in parts) or Path(parts[-1]).suffix.lower() in RISK_EXT
emit("CHECK","FULL_STAGING_HOSTING_ASSET_INVENTORY_OFFLINE")
try:
    cfg=json.loads(Path("firebase.json").read_text(encoding="utf8"))
    hosting=cfg.get("hosting")
    if not isinstance(hosting,dict) or hosting.get("public")!="firebase-staging":
        raise ValueError("hosting directory")
    ignore=set(hosting.get("ignore",[]))
    if ignore!=EXPECTED_IGNORE:raise ValueError("ignore rules changed")
    if not ROOT.is_dir() or ROOT.is_symlink():raise ValueError("root directory")
    n=0;raw_bytes=0;risk=0;symlinks=0;ignored=0;unsupported=0
    inventory=[]
    for base,dirs,files in os.walk(ROOT,topdown=True,followlinks=False):
        base_path=Path(base)
        kept=[]
        for d in dirs:
            p=base_path/d
            rel=p.relative_to(ROOT).parts
            if p.is_symlink():symlinks+=1;continue
            if excluded(rel):ignored+=1;continue
            kept.append(d)
        dirs[:]=kept
        for name in files:
            path=base_path/name
            parts=path.relative_to(ROOT).parts
            if path.is_symlink():symlinks+=1;continue
            if excluded(parts):ignored+=1;continue
            if sensitive(parts):risk+=1
            mode=path.stat().st_mode
            if not stat.S_ISREG(mode):unsupported+=1;continue
            size=path.stat().st_size
            if size>25000000:unsupported+=1;continue
            n+=1;raw_bytes+=size
            # Hash only nonconfig candidate source. Contents never printed.
            if path.relative_to(ROOT).as_posix()!="firebase-v4-config.js":
                digest=hashlib.sha256(path.read_bytes()).digest()
                inventory.append((path.relative_to(ROOT).as_posix(),size,digest))
            if n>10000:raise ValueError("file count bound")
    root_files={p.name for p in ROOT.iterdir() if p.is_file() and not p.is_symlink()}
    required_present=REQUIRED.issubset(root_files)
    config=(ROOT/"firebase-v4-config.js").read_text(encoding="utf8")
    key_empty=bool(re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1\s*;',config))
    h=hashlib.sha256()
    for path,size,digest in sorted(inventory):
        h.update(path.encode("utf8")+b"\0"+size.to_bytes(8,"big")+digest)
except Exception:
    emit("GATE","BLOCKED_CONFIG_OR_SOURCE_INSPECTION")
    emit("NETWORK_REQUESTS","0")
    emit("FILE_WRITES","0")
    emit("DEPLOY","NOT_PERFORMED")
    emit("RELEASE","NO_GO")
    sys.exit(2)

emit("HOSTING_PUBLIC_DIR","EXPECTED_STAGING")
emit("HOSTING_IGNORE_RULES","EXPECTED")
emit("DEPLOYABLE_FILE_COUNT_ESTIMATE",n)
emit("DEPLOYABLE_TOTAL_BYTES_ESTIMATE",raw_bytes)
emit("IGNORED_ENTRY_COUNT",ignored)
emit("SYMLINK_ENTRY_COUNT",symlinks)
emit("RISK_FILENAME_COUNT",risk)
emit("UNSUPPORTED_ENTRY_COUNT",unsupported)
emit("REQUIRED_SEVEN_FILES_PRESENT","YES" if required_present else "NO")
emit("REPO_SITE_KEY_EMPTY","YES" if key_empty else "NO")
emit("NONCONFIG_FULL_SOURCE_FINGERPRINT_SHA256",h.hexdigest())
emit("CONFIG_EXCLUDED_FROM_FINGERPRINT","YES")
emit("FIREBASE_CLI_PACKAGING_PARITY","NOT_VERIFIED")
emit("PERSISTENT_CANDIDATE_ARTIFACT","NOT_CREATED")
emit("LIVE_HOSTED_ASSET_COMPLETENESS","NOT_VERIFIED")
blocked=symlinks>0 or risk>0 or unsupported>0 or not required_present or not key_empty
emit("SOURCE_INVENTORY_GATE","BLOCKED_REVIEW" if blocked else "PASS_INVENTORY_ONLY")
emit("DEPLOY_GATE","BLOCKED_PENDING_CONFIG_RECONCILIATION_AND_APPROVAL")
emit("SOURCE_CONTENT_OR_FILE_PATHS","NOT_PRINTED")
emit("NETWORK_REQUESTS","0")
emit("FILE_WRITES","0")
emit("CLOUD_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
sys.exit(3 if blocked else 0)
