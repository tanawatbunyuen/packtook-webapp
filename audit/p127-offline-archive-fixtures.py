#!/usr/bin/env python3
"""P127 offline ZIP fixture checks, no Cloud calls."""
import io,pathlib,subprocess,sys,tempfile,zipfile
root=pathlib.Path(__file__).resolve().parent
names=("recordingStatus","usageStatus","ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
symbols=names[2:]
def makezip(code,unsafe=False):
    b=io.BytesIO()
    with zipfile.ZipFile(b,"w",compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("../bad.js" if unsafe else "functions/index.js",code)
    return b.getvalue()
with tempfile.TemporaryDirectory() as folder:
    base=pathlib.Path(folder)
    common="\n".join("exports."+x+"=onCall(()=>{});" for x in symbols)
    for name in names:
        (base/(name+".zip")).write_bytes(makezip(common if name in symbols else "exports."+name+"=onCall(()=>{});"))
    def run():
        return subprocess.run([sys.executable,str(root/"p127-stage-source-archive-preflight.py"),"--fixture-dir",str(base)],capture_output=True,text=True)
    r=run()
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P127_ARCHIVES_INSPECTED=6/6" in r.stdout
    assert "P127_FOUR_OWNER_ARCHIVE_HASHES_EQUAL=TRUE" in r.stdout
    assert all("P127_OWNER_SYMBOL="+x+" PRESENT=TRUE" in r.stdout for x in symbols)
    print("P127_IDENTICAL_OWNER_ARCHIVES=PASS")
    (base/(symbols[0]+".zip")).write_bytes(makezip("exports."+symbols[0]+"=onCall(()=>{});"))
    r=run()
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P127_FOUR_OWNER_ARCHIVE_HASHES_EQUAL=FALSE" in r.stdout
    print("P127_MISMATCH_ARCHIVE_DETECTED=PASS")
    (base/(symbols[0]+".zip")).write_bytes(makezip("exports.bad=1;",True))
    r=run()
    assert r.returncode==1 and "UNSAFE_ZIP_PATH" in r.stdout,(r.stdout,r.stderr)
    print("P127_UNSAFE_ARCHIVE_BLOCK=PASS")
    print("P127_OFFLINE_FIXTURES=3/3_PASS")
