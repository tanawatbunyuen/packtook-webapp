#!/usr/bin/env python3
from pathlib import Path
import os,sys,subprocess,tempfile
tool=Path(__file__).with_name("p153-cache-version-preflight.py")
with tempfile.TemporaryDirectory() as tmp:
    home=Path(tmp)
    for rel in (".cache/firebase/emulators",".packtook-demo-emulator-home/.cache/firebase/emulators"):
        folder=home/rel;folder.mkdir(parents=True)
        (folder/"cloud-firestore-emulator-v1.22.0.jar").write_bytes(b"a"*1000001)
    log=home/".packtook-demo-emulator-home/p141-emulator.log"
    log.write_text("Downloading Cloud Firestore emulator\n")
    r=subprocess.run([sys.executable,str(tool)],env={**os.environ,"HOME":str(home),"PATH":"/usr/bin:/bin"},capture_output=True,text=True,timeout=10)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P153_PRIVATE_CACHE_VERSIONS=1.22.0" in r.stdout
    assert "P153_PRIVATE_CACHE_VERSION_PARITY=TRUE" in r.stdout
    assert "P153_EXPLICIT_DOWNLOAD_START_LINES=1" in r.stdout
    assert str(home) not in r.stdout
    print("P153_CACHE_PARITY_AND_DOWNLOAD_SIGNAL=PASS")
    (home/".packtook-demo-emulator-home/.cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar").unlink()
    r=subprocess.run([sys.executable,str(tool)],env={**os.environ,"HOME":str(home),"PATH":"/usr/bin:/bin"},capture_output=True,text=True,timeout=10)
    assert "P153_PRIVATE_CACHE_VERSIONS=NONE" in r.stdout
    assert "P153_PRIVATE_CACHE_VERSION_PARITY=FALSE" in r.stdout
    print("P153_MISSING_PRIVATE_CACHE_DETECTED=PASS")
    log.unlink();log.symlink_to(home/"untrusted")
    r=subprocess.run([sys.executable,str(tool)],env={**os.environ,"HOME":str(home),"PATH":"/usr/bin:/bin"},capture_output=True,text=True,timeout=10)
    assert r.returncode==1 and "P153_BLOCK=PRIVATE_LOG_UNSAFE_OR_MISSING" in r.stdout
    print("P153_SYMLINK_LOG_FAIL_CLOSED=PASS")
    print("P153_OFFLINE_FIXTURES=3/3_PASS")
