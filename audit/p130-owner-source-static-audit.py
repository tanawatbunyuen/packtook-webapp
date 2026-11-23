#!/usr/bin/env python3
"""P130 — local, read-only triage of recovered Owner Functions. Does not execute source.
Prints aggregate counts and generic flags only, never source contents or matched values.
Heuristics are not a substitute for manual security review.
"""
import argparse,hashlib,json,os,pathlib,re,stat,sys
EXPECTED="e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456"
OWNERS=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
PATTERNS={
 "CREDENTIAL_ASSIGNMENT":re.compile(rb'(?i)(?:api[_-]?key|secret|password|private[_-]?key|access[_-]?token)\s*[:=]\s*["\x27][^"\x27\r\n]{8,}["\x27]'),
 "PRIVATE_KEY_BLOCK":re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
 "DANGEROUS_DYNAMIC_EVAL":re.compile(rb'\b(?:eval|new\s+Function)\s*\('),
 "SHELL_EXEC":re.compile(rb'\b(?:execSync|spawnSync|child_process)\b'),
 "REMOTE_DYNAMIC_IMPORT":re.compile(rb'\bimport\s*\(\s*["\x27]https?://'),
}
SOURCE_EXT={".js",".cjs",".mjs",".ts"}
MAX_FILE=4*1024*1024
MAX_TOTAL=30*1024*1024
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--recovery",default=str(pathlib.Path.home()/".packtook-recovery"/("p128-owner-"+EXPECTED[:12])))
    ap.add_argument("--review-repo",default=".")
    args=ap.parse_args()
    root=pathlib.Path(args.recovery).expanduser()
    repo=pathlib.Path(args.review_repo).resolve()
    manifest_path=root/"manifest.json"
    recovered=root/"recovered"
    if not root.is_dir() or not recovered.is_dir() or not manifest_path.is_file():
        raise RuntimeError("RECOVERY_LAYOUT_UNAVAILABLE")
    if root.is_symlink() or recovered.is_symlink() or manifest_path.is_symlink():
        raise RuntimeError("RECOVERY_SYMLINK_BLOCKED")
    manifest=json.loads(manifest_path.read_text())
    if manifest.get("archive_sha256")!=EXPECTED:
        raise RuntimeError("ARCHIVE_MANIFEST_HASH_MISMATCH")
    fileinfo=manifest.get("files")
    if not isinstance(fileinfo,list) or not fileinfo or len(fileinfo)>1000:
        raise RuntimeError("MANIFEST_INVALID")
    indicators={name:0 for name in PATTERNS}
    matches={name:set() for name in OWNERS}
    jsfiles=0
    scanned=0
    mismatch=0
    total=0
    seen=set()
    for item in fileinfo:
        if not isinstance(item,dict):raise RuntimeError("MANIFEST_ENTRY_INVALID")
        name=item.get("path")
        if not isinstance(name,str) or not name or name in seen:raise RuntimeError("MANIFEST_PATH_INVALID")
        seen.add(name)
        p=pathlib.PurePosixPath(name)
        if p.is_absolute() or ".." in p.parts or "\\" in name:raise RuntimeError("MANIFEST_PATH_TRAVERSAL")
        f=recovered.joinpath(*p.parts)
        if f.is_symlink() or not f.is_file():raise RuntimeError("RECOVERY_FILE_MISSING_OR_SYMLINK")
        if f.stat().st_size>MAX_FILE:raise RuntimeError("RECOVERY_FILE_TOO_LARGE")
        total+=f.stat().st_size
        if total>MAX_TOTAL:raise RuntimeError("RECOVERY_TOTAL_TOO_LARGE")
        raw=f.read_bytes()
        scanned+=1
        if hashlib.sha256(raw).hexdigest()!=item.get("sha256") or len(raw)!=item.get("bytes"):
            mismatch+=1
        if f.suffix not in SOURCE_EXT or "node_modules" in p.parts:continue
        jsfiles+=1
        for indicator,pattern in PATTERNS.items():
            indicators[indicator]+=len(pattern.findall(raw))
        for symbol in OWNERS:
            if symbol.encode() in raw:matches[symbol].add(name)
    repo_source=repo/"functions"/"index.js"
    if not repo_source.is_file():raise RuntimeError("REVIEW_SOURCE_NOT_FOUND")
    reviewed=repo_source.read_bytes()
    print("P130_MODE=LOCAL_STATIC_ONLY_NO_SOURCE_OUTPUT")
    print("P130_RECOVERED_FILES="+str(scanned))
    print("P130_JS_TS_FILES="+str(jsfiles))
    print("P130_MANIFEST_MISMATCHES="+str(mismatch))
    for sym in OWNERS:
        print("P130_SYMBOL="+sym+" RECOVERED_FILES_WITH_SYMBOL="+str(len(matches[sym]))+" REVIEWED_SOURCE_HAS_SYMBOL="+str(sym.encode() in reviewed).upper())
    for label,num in indicators.items():
        print("P130_HEURISTIC_"+label+"_COUNT="+str(num))
    print("P130_AUTHORIZATION_REVIEW=REQUIRED")
    print("P130_SOURCE_PARITY=NOT_ATTESTED P130_DEPLOY_AUTHORIZED=NO")
    print("P130_GIT_WRITES=0 P130_CLOUD_CALLS=0 P130_SOURCE_EXECUTION=0")
    print("P130_DECISION=NO_GO_MANUAL_SECURITY_AND_SOURCE_RECONCILIATION")
    if mismatch or jsfiles==0 or any(not matches[x] for x in OWNERS):
        raise RuntimeError("INTEGRITY_OR_OWNER_SYMBOL_CHECK_FAILED")
if __name__=="__main__":
    try:main()
    except Exception as e:
        reason=str(e) if isinstance(e,RuntimeError) else type(e).__name__
        print("P130_BLOCK="+reason)
        sys.exit(1)
