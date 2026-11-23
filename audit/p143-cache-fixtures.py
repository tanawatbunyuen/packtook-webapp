#!/usr/bin/env python3
import pathlib,subprocess,sys,tempfile,zipfile
script=pathlib.Path(__file__).with_name("p143-emulator-cache-integrity.py")
with tempfile.TemporaryDirectory() as t:
    root=pathlib.Path(t);src=root/"src";dst=root/"private";src.mkdir();dst.mkdir()
    for d in (src,dst):
        with zipfile.ZipFile(d/"firestore-emu.jar","w",compression=zipfile.ZIP_DEFLATED) as f:
            f.writestr("META-INF/MANIFEST.MF","Manifest-Version: 1.0\n")
    args=[sys.executable,str(script),"--source-cache",str(src),"--private-cache",str(dst)]
    r=subprocess.run(args,capture_output=True,text=True,timeout=12)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P143_PRIVATE_JAR_VALID=1" in r.stdout
    assert "P143_CACHE_COUNTS_AND_BYTES_MATCH=TRUE" in r.stdout
    assert "P143_DIAGNOSTIC=CACHE_JAR_INTEGRITY_NO_OBVIOUS_ERROR" in r.stdout
    assert str(src) not in r.stdout and str(dst) not in r.stdout
    print("P143_VALID_PRIVATE_CACHE_AND_NO_PATHS=PASS")
    (dst/"firestore-emu.jar").write_bytes(b"not a jar")
    r=subprocess.run(args,capture_output=True,text=True,timeout=12)
    assert r.returncode==0
    assert "P143_PRIVATE_JAR_INVALID=1" in r.stdout
    assert "P143_DIAGNOSTIC=CACHE_HAS_UNSAFE_OR_INVALID_FILES" in r.stdout
    print("P143_INVALID_JAR_DETECTED=PASS")
    (dst/"firestore-emu.jar").unlink()
    r=subprocess.run(args,capture_output=True,text=True,timeout=12)
    assert "P143_DIAGNOSTIC=PRIVATE_CACHE_HAS_NO_JAR" in r.stdout
    print("P143_MISSING_PRIVATE_JAR_DETECTED=PASS")
    link=dst/"link.jar";link.symlink_to(src/"firestore-emu.jar")
    r=subprocess.run(args,capture_output=True,text=True,timeout=12)
    assert r.returncode==0
    assert "P143_PRIVATE_SYMLINKS=1" in r.stdout
    print("P143_SYMLINK_NOT_FOLLOWED=PASS")
    print("P143_OFFLINE_FIXTURES=4/4_PASS")
