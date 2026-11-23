#!/usr/bin/env python3
"""P142 synthetic log categorization & secret non-disclosure tests."""
import pathlib
import subprocess
import sys
import tempfile

script=pathlib.Path(__file__).with_name("p142-emulator-startup-log-diagnostics.py")
def probe(log):
    return subprocess.run([sys.executable,str(script),"--log",str(log)],capture_output=True,text=True,timeout=10)
with tempfile.TemporaryDirectory(prefix="p142-fixture-") as temp:
    base=pathlib.Path(temp)
    log=base/"emulator.log"
    secret="AIzaFictionalDoNotShareClientKey"
    log.write_text("Downloading firestore-emulator-v1.jar\nnetwork timeout ETIMEDOUT\nBearer "+secret+"\n")
    p=probe(log)
    assert p.returncode==0,(p.stdout,p.stderr)
    assert "P142_CATEGORY_DOWNLOAD_OR_UPDATE=TRUE" in p.stdout
    assert "P142_CATEGORY_NETWORK_DNS_PROXY=TRUE" in p.stdout
    assert "P142_DIAGNOSTIC=CHECK_DOWNLOAD_OR_NETWORK_BLOCKER" in p.stdout
    assert secret not in p.stdout and "Bearer" not in p.stdout
    print("P142_DOWNLOAD_NETWORK_AND_NO_SECRET_OUTPUT=PASS")
    log.write_text("java.lang.UnsupportedClassVersionError - Unable to access jarfile\n")
    p=probe(log)
    assert p.returncode==0 and "P142_DIAGNOSTIC=CHECK_JAVA_LAUNCH_ERROR" in p.stdout,(p.stdout,p.stderr)
    print("P142_JAVA_ERROR_CLASSIFICATION=PASS")
    log.write_text("Error: listen EADDRINUSE 127.0.0.1:18080\n")
    p=probe(log)
    assert p.returncode==0 and "P142_DIAGNOSTIC=CHECK_LOCAL_PORT_COLLISION" in p.stdout
    print("P142_PORT_ERROR_CLASSIFICATION=PASS")
    link=base/"symlink.log"
    link.symlink_to(log)
    p=probe(link)
    assert p.returncode==1 and "P142_BLOCK=LOG_MISSING_OR_SYMLINK" in p.stdout
    print("P142_SYMLINK_FAIL_CLOSED=PASS")
    print("P142_OFFLINE_FIXTURES=4/4_PASS")
