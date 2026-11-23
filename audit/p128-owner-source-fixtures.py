#!/usr/bin/env python3
"""P128 offline quarantine fixtures: hash, symbols, zip path safety and no overwrite."""
import hashlib,io,json,pathlib,subprocess,sys,tempfile,zipfile
script=pathlib.Path(__file__).with_name("p128-owner-source-quarantine.py")
symbols=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
def zfile(name,content):
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,"w",zipfile.ZIP_DEFLATED) as archive:archive.writestr(name,content)
    return buffer.getvalue()
with tempfile.TemporaryDirectory() as tmp:
    root=pathlib.Path(tmp)
    good=zfile("functions/index.js","\n".join("exports."+x+"=onCall(()=>{});" for x in symbols))
    zip_path=root/"good.zip";zip_path.write_bytes(good)
    digest=hashlib.sha256(good).hexdigest()
    target=root/"recovered"
    cmd=[sys.executable,str(script),"--fixture-archive",str(zip_path),"--expected-sha",digest,"--destination",str(target)]
    r=subprocess.run(cmd,capture_output=True,text=True)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P128_ARCHIVE_SHA256_MATCH=TRUE" in r.stdout
    assert all("P128_OWNER_SYMBOL="+x+" PRESENT=TRUE" in r.stdout for x in symbols)
    assert (target/"manifest.json").exists()
    assert (target/"recovered"/"functions"/"index.js").exists()
    print("P128_HASH_AND_PRIVATE_RECOVERY=PASS")
    r=subprocess.run(cmd,capture_output=True,text=True)
    assert r.returncode==1 and "RECOVERY_DESTINATION_EXISTS" in r.stdout
    print("P128_NO_OVERWRITE=PASS")
    bad_target=root/"bad-hash"
    r=subprocess.run([*cmd[:-1],str(bad_target)] if False else [sys.executable,str(script),"--fixture-archive",str(zip_path),"--expected-sha","0"*64,"--destination",str(bad_target)],capture_output=True,text=True)
    assert r.returncode==1 and "ARCHIVE_HASH_MISMATCH" in r.stdout and not bad_target.exists(),(r.stdout,r.stderr)
    print("P128_HASH_MISMATCH_FAIL_CLOSED=PASS")
    unsafe=root/"unsafe.zip";unsafe.write_bytes(zfile("../config.js","bad"))
    unsafe_target=root/"unsafe-recovery"
    r=subprocess.run([sys.executable,str(script),"--fixture-archive",str(unsafe),"--expected-sha",hashlib.sha256(unsafe.read_bytes()).hexdigest(),"--destination",str(unsafe_target)],capture_output=True,text=True)
    assert r.returncode==1 and "UNSAFE_ARCHIVE_PATH" in r.stdout and not unsafe_target.exists(),(r.stdout,r.stderr)
    print("P128_UNSAFE_ZIP_FAIL_CLOSED=PASS")
    print("P128_OFFLINE_FIXTURES=4/4_PASS")
