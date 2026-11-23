#!/usr/bin/env python3
"""P130 offline fixtures do not read actual recovered source or Cloud."""
import hashlib,json,pathlib,subprocess,sys,tempfile
script=pathlib.Path(__file__).with_name("p130-owner-source-static-audit.py")
repo=script.parent.parent
symbols=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
with tempfile.TemporaryDirectory() as t:
    root=pathlib.Path(t)
    recovered=root/"recovered"
    recovered.mkdir()
    code=("\n".join("exports."+n+"=onCall(()=>{});" for n in symbols)).encode()
    path=recovered/"index.js";path.write_bytes(code)
    manifest={"archive_sha256":"e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456",
              "files":[{"path":"index.js","bytes":len(code),"sha256":hashlib.sha256(code).hexdigest()}]}
    (root/"manifest.json").write_text(json.dumps(manifest))
    args=[sys.executable,str(script),"--recovery",str(root),"--review-repo",str(repo)]
    r=subprocess.run(args,capture_output=True,text=True)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P130_MANIFEST_MISMATCHES=0" in r.stdout
    assert all("P130_SYMBOL="+n+" RECOVERED_FILES_WITH_SYMBOL=1" in r.stdout for n in symbols)
    assert "P130_GIT_WRITES=0 P130_CLOUD_CALLS=0 P130_SOURCE_EXECUTION=0" in r.stdout
    print("P130_VALID_MANIFEST_AND_SYMBOLS=PASS")
    path.write_bytes(code+b"\nsecret='xxxxxxxxxxxxxxxx'")
    r=subprocess.run(args,capture_output=True,text=True)
    assert r.returncode==1 and "INTEGRITY_OR_OWNER_SYMBOL_CHECK_FAILED" in r.stdout
    assert "xxxxxxxxxxxxxxxx" not in r.stdout
    print("P130_TAMPERED_MANIFEST_BLOCK=PASS")
    path.write_bytes(code)
    manifest["files"][0]["path"]="../index.js"
    (root/"manifest.json").write_text(json.dumps(manifest))
    r=subprocess.run(args,capture_output=True,text=True)
    assert r.returncode==1 and "MANIFEST_PATH_TRAVERSAL" in r.stdout
    print("P130_PATH_TRAVERSAL_BLOCK=PASS")
print("P130_OFFLINE_FIXTURES=3/3_PASS")
