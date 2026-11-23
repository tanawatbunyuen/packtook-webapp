#!/usr/bin/env python3
"""P129 guard for default HOME quarantine path, no cloud requests."""
import hashlib,io,os,pathlib,subprocess,sys,tempfile,zipfile
root=pathlib.Path(__file__).resolve().parent
script=root/"p128-owner-source-quarantine.py"
symbols=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
with tempfile.TemporaryDirectory(prefix="p129-default-home-") as t:
    home=pathlib.Path(t)
    b=io.BytesIO()
    with zipfile.ZipFile(b,"w",compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("functions/index.js","\n".join("exports."+x+"=onCall(()=>{});" for x in symbols))
    data=b.getvalue()
    archive=home/"fixture.zip";archive.write_bytes(data)
    digest=hashlib.sha256(data).hexdigest()
    env=dict(os.environ,HOME=str(home))
    args=[sys.executable,str(script),"--fixture-archive",str(archive),"--expected-sha",digest]
    first=subprocess.run(args,env=env,capture_output=True,text=True,timeout=15)
    assert first.returncode==0,(first.stdout,first.stderr)
    destination=home/".packtook-recovery"/"p128-owner-e82154a69b8d"
    assert destination.exists(),first.stdout
    assert (destination/"manifest.json").exists()
    assert "P128_ARCHIVE_SHA256_MATCH=TRUE" in first.stdout
    assert str(destination) in first.stdout
    print("P129_DEFAULT_HOME_QUARANTINE_PATH=PASS")
    second=subprocess.run(args,env=env,capture_output=True,text=True,timeout=15)
    assert second.returncode==1,(second.stdout,second.stderr)
    assert "P128_BLOCK=RECOVERY_DESTINATION_EXISTS" in second.stdout
    assert (destination/"manifest.json").exists()
    print("P129_DEFAULT_PATH_NO_OVERWRITE=PASS")
print("P129_OFFLINE_FIXTURES=2/2_PASS")
