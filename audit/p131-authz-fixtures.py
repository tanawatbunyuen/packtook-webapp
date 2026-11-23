#!/usr/bin/env python3
"""P131 offline fixtures; synthetic JS only, no Cloud."""
import hashlib,json,pathlib,subprocess,sys,tempfile
source=pathlib.Path(__file__).with_name("p131-owner-authz-static-triage.py")
names=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
with tempfile.TemporaryDirectory() as d:
    root=pathlib.Path(d);folder=root/"recovered";folder.mkdir()
    code="\n".join("exports."+name+" = onCall(async (req) => { if (!req.auth) throw new HttpsError('unauthenticated'); assertAdmin(req.auth.uid); await db.collection('x').doc('a').update({x:1}); });" for name in names).encode()
    target=folder/"index.js";target.write_bytes(code)
    metadata={"archive_sha256":"e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456","files":[{"path":"index.js","sha256":hashlib.sha256(code).hexdigest()}]}
    (root/"manifest.json").write_text(json.dumps(metadata))
    args=[sys.executable,str(source),"--recovery",str(root)]
    r=subprocess.run(args,capture_output=True,text=True)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P131_TOTAL_EXPLICIT_OWNER_EXPORTS=4" in r.stdout
    assert "P131_FUNCTION=ownerGrantVideoCredits INDICATOR_ADMIN_ROLE_CHECK=TRUE" in r.stdout
    assert "P131_FUNCTION=ownerGrantVideoCredits AUTHORIZATION_PROVEN=NO" in r.stdout
    assert "P131_CLOUD_CALLS=0 P131_GIT_WRITES=0 P131_SOURCE_EXECUTION=0 P131_DEPLOYS=0" in r.stdout
    print("P131_EXPLICIT_EXPORT_HEURISTICS=PASS")
    target.write_bytes(code+b"\n// mutated")
    r=subprocess.run(args,capture_output=True,text=True)
    assert r.returncode==1 and "RECOVERED_FILE_HASH_MISMATCH" in r.stdout
    print("P131_INTEGRITY_TAMPER_BLOCK=PASS")
    target.write_bytes(b"const placeholder=1;")
    metadata["files"][0]["sha256"]=hashlib.sha256(target.read_bytes()).hexdigest()
    (root/"manifest.json").write_text(json.dumps(metadata))
    r=subprocess.run(args,capture_output=True,text=True)
    assert r.returncode==1 and "OWNER_EXPORT_DEFINITION_MISSING" in r.stdout,(r.stdout,r.stderr)
    print("P131_MISSING_OWNER_EXPORT_BLOCK=PASS")
    print("P131_OFFLINE_FIXTURES=3/3_PASS")
