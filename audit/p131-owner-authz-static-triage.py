#!/usr/bin/env python3
"""P131: offline Owner authorization indicators (heuristics, not proof).
Only reads P128 recovery directory and manifest; never executes or prints source.
"""
import argparse,hashlib,json,pathlib,re,sys
EXPECTED="e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456"
OWNERS=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
INDICATORS={
 "EXPORT_DEFINITION":rb'exports\s*\.\s*%s\s*=',
 "AUTH_CONTEXT":rb'\b(?:req\.auth|request\.auth|context\.auth|auth\.uid)\b',
 "AUTHENTICATION_ERROR":rb'\b(?:unauthenticated|permission-denied|HttpsError)\b',
 "ADMIN_ROLE_CHECK":rb'\b(?:assertAdmin|requireAdmin|isAdmin|assertOwner|requireOwner|customClaims|adminRole|role\s*===?\s*[\x22\x27]admin)\b',
 "OWNER_IDENTITY_CHECK":rb'\b(?:uid|ownerId|adminUid|accountId)\b',
 "EMAIL_VERIFIED_CHECK":rb'\b(?:email_verified|emailVerified)\b',
 "VALIDATION":rb'\b(?:validOp|validate|zod|Joi|isFinite|Number\.isFinite|typeof|throw)\b',
 "MUTATION":rb'\b(?:\.update\s*\(|\.set\s*\(|\.create\s*\(|runTransaction\s*\(|\.delete\s*\()',
 "AUDIT_EVENT":rb'\b(?:audit|adjustmentHistory|reason|operationId|idempotency)\b',
 "APPCHECK_CONTEXT":rb'\b(?:enforceAppCheck|appCheck|request\.app)\b',
}
WINDOW=12000
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--recovery",default=str(pathlib.Path.home()/".packtook-recovery"/("p128-owner-"+EXPECTED[:12])))
    args=parser.parse_args()
    root=pathlib.Path(args.recovery).expanduser()
    man=root/"manifest.json"
    if root.is_symlink() or not man.is_file() or man.is_symlink():raise RuntimeError("RECOVERY_MANIFEST_UNAVAILABLE")
    metadata=json.loads(man.read_text())
    if metadata.get("archive_sha256")!=EXPECTED:raise RuntimeError("RECOVERY_ARCHIVE_SHA_MISMATCH")
    entries=metadata.get("files")
    if not isinstance(entries,list) or len(entries)>1000:raise RuntimeError("RECOVERY_MANIFEST_INVALID")
    files=[]
    seen=set()
    for entry in entries:
        name=entry.get("path") if isinstance(entry,dict) else None
        if not isinstance(name,str) or not name or name in seen:raise RuntimeError("MANIFEST_ENTRY_INVALID")
        seen.add(name)
        rel=pathlib.PurePosixPath(name)
        if rel.is_absolute() or ".." in rel.parts or "\\" in name:raise RuntimeError("MANIFEST_UNSAFE_PATH")
        f=root.joinpath("recovered",*rel.parts)
        if f.is_symlink() or not f.is_file():raise RuntimeError("RECOVERED_FILE_UNAVAILABLE")
        content=f.read_bytes()
        if len(content)>4*1024*1024 or hashlib.sha256(content).hexdigest()!=entry.get("sha256"):
            raise RuntimeError("RECOVERED_FILE_HASH_MISMATCH")
        if f.suffix in (".js",".cjs",".mjs",".ts") and "node_modules" not in rel.parts:
            files.append(content)
    if not files:raise RuntimeError("NO_SOURCE_FILES")
    print("P131_MODE=LOCAL_READONLY_HEURISTIC_NO_SOURCE_OUTPUT")
    print("P131_SOURCE_FILES="+str(len(files)))
    definition_total=0
    for name in OWNERS:
        pattern=re.compile(INDICATORS["EXPORT_DEFINITION"].replace(b"%s",re.escape(name.encode())))
        bodies=[]
        for content in files:
            for match in pattern.finditer(content):
                # Restrict heuristic window to next explicit exports.* assignment,
                # or a maximum length. This is NOT a JavaScript parser.
                start=match.start()
                end=min(len(content),start+WINDOW)
                nxt=re.search(rb'\bexports\s*\.\s*[A-Za-z_][A-Za-z0-9_]*\s*=',content[match.end():end])
                if nxt:end=min(end,match.end()+nxt.start())
                bodies.append(content[start:end])
        definition_total+=len(bodies)
        print("P131_FUNCTION="+name+" EXPLICIT_EXPORT_COUNT="+str(len(bodies)))
        for key in INDICATORS:
            if key=="EXPORT_DEFINITION":continue
            present=bool(any(re.search(INDICATORS[key],b,re.I) for b in bodies))
            print("P131_FUNCTION="+name+" INDICATOR_"+key+"="+str(present).upper())
        print("P131_FUNCTION="+name+" AUTHORIZATION_PROVEN=NO")
    print("P131_TOTAL_EXPLICIT_OWNER_EXPORTS="+str(definition_total))
    print("P131_REVIEW_REQUIREMENTS=AUTHORIZATION,TENANT_ISOLATION,INPUT_VALIDATION,IDEMPOTENCY,AUDIT_TRAIL,APPCHECK")
    print("P131_CLOUD_CALLS=0 P131_GIT_WRITES=0 P131_SOURCE_EXECUTION=0 P131_DEPLOYS=0")
    print("P131_DECISION=NO_GO_MANUAL_SECURITY_REVIEW_REQUIRED")
    if definition_total<4:raise RuntimeError("OWNER_EXPORT_DEFINITION_MISSING")
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("P131_BLOCK="+(str(e) if isinstance(e,RuntimeError) else type(e).__name__))
        sys.exit(1)
