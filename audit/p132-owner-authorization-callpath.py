#!/usr/bin/env python3
"""P132: local-only conservative owner authorization call-path triage.
NOT a JS parser, does not prove authorization. No source output, execution or cloud calls.
"""
import argparse,hashlib,json,pathlib,re,sys
EXPECTED="e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456"
OWNERS=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
MAX_BYTES=4*1024*1024
AUTH=re.compile(rb'\b(?:req|request|context)\s*\.\s*auth\b|\b(?:getAuth|verifyIdToken)\s*\(',re.I)
DENY=re.compile(rb'\b(?:unauthenticated|permission-denied|HttpsError|assertAdmin|requireOwner|requireAdmin)\b',re.I)
IDENTITY=re.compile(rb'\b(?:uid|ownerId|adminUid|email_verified|emailVerified)\b',re.I)
APPCHECK=re.compile(rb'\b(?:enforceAppCheck|appCheck|request\.app)\b',re.I)
CALLS=re.compile(rb'\b([a-zA-Z_$][\w$]*)\s*\(')
DECL=re.compile(rb'\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>')
FUNCTION_SCAN_LIMIT=32000
def guarded_region(raw,pos):
    # Approximate bounded region from named export assignment to next export assignment.
    # Not AST; lexical comments/strings and nested constructs remain unverified.
    end=min(len(raw),pos+FUNCTION_SCAN_LIMIT)
    next_export=re.search(rb'\bexports\s*\.\s*[\w$]+\s*=',raw[pos+8:end])
    if next_export:end=min(end,pos+8+next_export.start())
    return raw[pos:end]
def read_verified(root):
    manifest=root/"manifest.json";base=root/"recovered"
    if root.is_symlink() or base.is_symlink() or manifest.is_symlink():raise RuntimeError("SYMLINK_BLOCKED")
    meta=json.loads(manifest.read_text())
    if meta.get("archive_sha256")!=EXPECTED:raise RuntimeError("ARCHIVE_MANIFEST_MISMATCH")
    files=[];names=set()
    for f in meta.get("files",[]):
        name=f.get("path") if isinstance(f,dict) else None
        if not isinstance(name,str) or not name or name in names:raise RuntimeError("MANIFEST_BAD_ENTRY")
        names.add(name)
        pure=pathlib.PurePosixPath(name)
        if pure.is_absolute() or ".." in pure.parts or "\\" in name:raise RuntimeError("UNSAFE_PATH")
        p=base.joinpath(*pure.parts)
        if p.is_symlink() or not p.is_file() or p.stat().st_size>MAX_BYTES:raise RuntimeError("BAD_SOURCE_FILE")
        raw=p.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=f.get("sha256") or len(raw)!=f.get("bytes"):raise RuntimeError("RECOVERY_HASH_MISMATCH")
        if p.suffix in (".js",".cjs",".mjs",".ts") and "node_modules" not in pure.parts:files.append(raw)
    if not files:raise RuntimeError("NO_JS_SOURCE")
    return files
def extract_helper_regions(src):
    helpers={}
    for m in DECL.finditer(src):
        name=(m.group(1) or m.group(2)).decode()
        if name in helpers:continue
        end=min(len(src),m.start()+6000)
        # Conservative bounded slice: may bleed into other functions, hence candidate-only.
        helpers[name]=src[m.start():end]
    return helpers
def analyze(files):
    combined=b"\n".join(files)
    helpers=extract_helper_regions(combined)
    all_symbols=set(helpers)
    print("P132_MODE=LOCAL_STATIC_CANDIDATE_ONLY")
    print("P132_SOURCE_FILES="+str(len(files)))
    print("P132_HELPER_DECLARATIONS="+str(len(helpers)))
    candidate_total=0
    for name in OWNERS:
        export=re.compile(rb'\bexports\s*\.\s*'+re.escape(name.encode())+rb'\s*=')
        found=[guarded_region(raw,m.start()) for raw in files for m in export.finditer(raw)]
        if len(found)!=1:
            print("P132_FUNCTION="+name+" EXPORT_COUNT="+str(len(found))+" RESULT=REVIEW_REQUIRED")
            continue
        region=found[0]
        direct_auth=bool(AUTH.search(region))
        direct_deny=bool(DENY.search(region))
        direct_identity=bool(IDENTITY.search(region))
        direct_appcheck=bool(APPCHECK.search(region))
        calls=set(x.decode() for x in CALLS.findall(region))
        linked=(calls & all_symbols)
        # Only a candidate: helper lexically contains auth + deny patterns, no control-flow proof.
        guarded=[h for h in linked if AUTH.search(helpers[h]) and DENY.search(helpers[h])]
        candidate_total+=len(guarded)
        print("P132_FUNCTION="+name+" EXPORT_COUNT=1")
        print("P132_FUNCTION="+name+" DIRECT_AUTH_INDICATOR="+str(direct_auth).upper())
        print("P132_FUNCTION="+name+" DIRECT_DENY_INDICATOR="+str(direct_deny).upper())
        print("P132_FUNCTION="+name+" IDENTITY_INDICATOR="+str(direct_identity).upper())
        print("P132_FUNCTION="+name+" DIRECT_APPCHECK_INDICATOR="+str(direct_appcheck).upper())
        print("P132_FUNCTION="+name+" LOCAL_HELPER_CALL_CANDIDATES="+str(len(linked)))
        print("P132_FUNCTION="+name+" AUTH_HELPER_CANDIDATES="+str(len(guarded)))
        print("P132_FUNCTION="+name+" AUTHORIZATION_PROVEN=NO")
    print("P132_TOTAL_AUTH_HELPER_CANDIDATES="+str(candidate_total))
    print("P132_LIMITATIONS=LEXICAL_NOT_AST_NOT_DATAFLOW")
    print("P132_DECISION=NO_GO_MANUAL_AUTHORIZATION_REVIEW")
    print("P132_CLOUD_CALLS=0 P132_GIT_WRITES=0 P132_SOURCE_EXECUTION=0 P132_DEPLOYS=0")
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--recovery",default=str(pathlib.Path.home()/".packtook-recovery"/("p128-owner-"+EXPECTED[:12])))
    args=ap.parse_args()
    analyze(read_verified(pathlib.Path(args.recovery).expanduser()))
if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("P132_BLOCK="+(str(exc) if isinstance(exc,RuntimeError) else type(exc).__name__))
        sys.exit(1)
