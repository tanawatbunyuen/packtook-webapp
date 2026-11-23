#!/usr/bin/env python3
"""P132 offline fixtures; synthetic only, no Cloud/API."""
import hashlib,json,pathlib,subprocess,sys,tempfile
script=pathlib.Path(__file__).with_name("p132-owner-authorization-callpath.py")
names=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
with tempfile.TemporaryDirectory() as t:
    root=pathlib.Path(t);folder=root/"recovered";folder.mkdir()
    code=("function assertOwner(req){if (!req.auth) throw new HttpsError('unauthenticated');return req.auth.uid;}\n"+
          "\n".join("exports."+x+" = onCall(async (req) => { const uid = assertOwner(req); return uid; });" for x in names)).encode()
    p=folder/"index.js";p.write_bytes(code)
    meta={"archive_sha256":"e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456","files":[{"path":"index.js","sha256":hashlib.sha256(code).hexdigest(),"bytes":len(code)}]}
    (root/"manifest.json").write_text(json.dumps(meta))
    args=[sys.executable,str(script),"--recovery",str(root)]
    r=subprocess.run(args,capture_output=True,text=True)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P132_SOURCE_FILES=1" in r.stdout
    assert all("P132_FUNCTION="+x+" EXPORT_COUNT=1" in r.stdout for x in names)
    assert "P132_CLOUD_CALLS=0 P132_GIT_WRITES=0 P132_SOURCE_EXECUTION=0 P132_DEPLOYS=0" in r.stdout
    print("P132_HELPER_CANDIDATE_FIXTURE=PASS")
    p.write_bytes(code+b"\nchanged")
    r=subprocess.run(args,capture_output=True,text=True)
    assert r.returncode==1 and "RECOVERY_HASH_MISMATCH" in r.stdout
    print("P132_SOURCE_INTEGRITY_FAIL_CLOSED=PASS")
    print("P132_OFFLINE_FIXTURES=2/2_PASS")
