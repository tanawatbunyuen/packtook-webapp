#!/usr/bin/env python3
"""P231.168 — compare all local staging Hosting assets with current public hosting.

Read-only HTTP GET for public static files, no Firebase Auth, token or API calls.
Only counters and allowlisted findings print; does not write source/artifacts.
This is NOT a deploy packaging replica or a release authorization.
"""
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json, os, stat, sys

ROOT=Path("firebase-staging")
BASE="https://packtook-staging.web.app/"
KNOWN={"index.html","firebase-v4-config.js","firebase-packing-bridge.js",
       "video-history-db.js","video-stream-writer.js","performance-monitor.js","app.js"}
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
def ignored(parts):
    return any(x.startswith(".") for x in parts) or "node_modules" in parts or parts[-1]=="firebase.json"
def fetch(path, limit):
    req=Request(BASE+quote(path,safe="/"),method="GET",headers={
      "Accept":"*/*","Cache-Control":"no-cache","User-Agent":"PACKTOOK-P231168-StaticAudit"})
    with urlopen(req, timeout=18) as res:
        if res.status!=200:raise ValueError("unexpected HTTP status")
        data=res.read(limit+1)
        if len(data)>limit:raise ValueError("asset over limit")
        # Reject likely Hosting 404 fallback HTML for a non-HTML asset.
        ctype=res.headers.get("Content-Type","").lower()
        if not path.lower().endswith((".html",".htm")) and "text/html" in ctype:
            raise ValueError("unexpected HTML fallback")
        return data
emit("CHECK","STAGING_ALL_HOSTING_PUBLIC_ASSETS_PARITY_READONLY")
try:
    config=json.loads(Path("firebase.json").read_text("utf8"))
    h=config.get("hosting",{})
    if not isinstance(h,dict) or h.get("public")!="firebase-staging":
        raise ValueError("hosting directory")
    if set(h.get("ignore",[]))!={"firebase.json","**/.*","**/node_modules/**"}:
        raise ValueError("ignore set changed")
    files=[]
    for base,dirs,names in os.walk(ROOT,followlinks=False):
        basepath=Path(base);kept=[]
        for name in dirs:
            p=basepath/name;parts=p.relative_to(ROOT).parts
            if p.is_symlink():raise ValueError("symlink directory")
            if not ignored(parts):kept.append(name)
        dirs[:]=kept
        for name in names:
            p=basepath/name;rel=p.relative_to(ROOT)
            if ignored(rel.parts):continue
            if p.is_symlink() or not stat.S_ISREG(p.stat().st_mode):raise ValueError("unsafe entry")
            size=p.stat().st_size
            if size>25000000:raise ValueError("unexpected file size")
            files.append((rel.as_posix(),p,size))
            if len(files)>10000:raise ValueError("unexpected file count")
except Exception:
    emit("GATE","BLOCKED_LOCAL_CONFIG_OR_SOURCE_INVENTORY")
    emit("NETWORK_REQUESTS","0")
    emit("CLOUD_WRITES","0")
    emit("RELEASE","NO_GO")
    sys.exit(2)

counts={"MATCH":0,"DRIFT":0,"UNAVAILABLE":0}
known_out={}
other_count=0;remote_bytes=0
for rel,path,size in sorted(files):
    try:
        local=path.read_bytes()
        if len(local)!=size:raise ValueError("local size changed")
        hosted=fetch(rel,25000000)
        remote_bytes+=len(hosted)
        status="MATCH" if local==hosted else "DRIFT"
    except (HTTPError,URLError,TimeoutError,ValueError,OSError):
        status="UNAVAILABLE"
    counts[status]+=1
    if rel in KNOWN:
        known_out[rel]=status
    else:
        if status!="MATCH":other_count+=1
for name in sorted(KNOWN):
    tag=name.upper().replace("-","_").replace(".","_")
    emit("KNOWN_"+tag+"_PARITY",known_out.get(name,"MISSING"))
emit("LOCAL_INVENTORY_COUNT",len(files))
emit("PUBLIC_ASSETS_MATCH_COUNT",counts["MATCH"])
emit("PUBLIC_ASSETS_DRIFT_COUNT",counts["DRIFT"])
emit("PUBLIC_ASSETS_UNAVAILABLE_COUNT",counts["UNAVAILABLE"])
emit("OTHER_ASSETS_DRIFT_OR_UNAVAILABLE_COUNT",other_count)
emit("PUBLIC_RESPONSES_TOTAL_BYTES",remote_bytes)
emit("HOSTED_EXTRA_FILES","NOT_ENUMERATED")
emit("FIREBASE_CLI_PACKAGING_PARITY","NOT_VERIFIED")
emit("PUBLIC_SITE_KEY_VALUE","NOT_PRINTED")
emit("SOURCE_CONTENTS","NOT_PRINTED")
emit("CANONICAL_ASSET_PARITY","MATCH_LOCAL_INVENTORY_ONLY" if counts["DRIFT"]==counts["UNAVAILABLE"]==0 else "DRIFT_OR_UNAVAILABLE")
emit("PERSISTENT_CANDIDATE","NOT_CREATED")
emit("ROLLBACK_EXECUTION","NOT_VERIFIED")
emit("HOSTING_DEPLOY_GATE","BLOCKED_PENDING_REVIEW")
emit("CLOUD_REQUESTS","PUBLIC_STATIC_GET_ONLY")
emit("FILE_WRITES","0")
emit("CLOUD_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
sys.exit(2 if counts["UNAVAILABLE"] else 0)
