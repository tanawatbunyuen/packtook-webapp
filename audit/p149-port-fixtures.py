#!/usr/bin/env python3
import pathlib,subprocess,sys,tempfile
tool=pathlib.Path(__file__).with_name("p149-emulator-port-diagnostic.py")
with tempfile.TemporaryDirectory() as tmp:
    root=pathlib.Path(tmp);log=root/"private.log"
    secret="secret-token-an-internal-url"
    log.write_text("Error: Could not check if port 18080 is available: Error: listen EADDRNOTAVAIL: address not available ::1\n"+secret+"\n")
    proc=subprocess.run([sys.executable,str(tool),"--log",str(log)],capture_output=True,text=True,timeout=10)
    assert proc.returncode==0,(proc.stdout,proc.stderr)
    assert "P149_SIGNAL_PORT_CHECK_AVAILABLE=1" in proc.stdout,proc.stdout
    assert "P149_SIGNAL_EADDRNOTAVAIL=1" in proc.stdout
    assert "P149_DIAGNOSTIC=PORT_CHECK_ADDRESS_NOT_AVAILABLE" in proc.stdout
    assert secret not in proc.stdout and str(root) not in proc.stdout
    print("P149_PORT_CHECK_EADDRNOTAVAIL=PASS")
    log.write_text("Error: Could not check if port 19099 is available\n")
    proc=subprocess.run([sys.executable,str(tool),"--log",str(log)],capture_output=True,text=True,timeout=10)
    assert "P149_DIAGNOSTIC=PORT_CHECK_ERROR_NEEDS_LOCAL_INVESTIGATION" in proc.stdout
    print("P149_GENERIC_PORT_CHECK=PASS")
    log.write_text("Downloading emulator\nError: unexpected failure\n")
    proc=subprocess.run([sys.executable,str(tool),"--log",str(log)],capture_output=True,text=True,timeout=10)
    assert "P149_DIAGNOSTIC=PORT_CHECK_NOT_CONFIRMED" in proc.stdout
    print("P149_NO_FALSE_PORT_CAUSE=PASS")
    link=root/"link";link.symlink_to(log)
    proc=subprocess.run([sys.executable,str(tool),"--log",str(link)],capture_output=True,text=True,timeout=10)
    assert proc.returncode==1 and "P149_BLOCK=LOG_MISSING_OR_UNSAFE" in proc.stdout
    print("P149_SYMLINK_FAIL_CLOSED=PASS")
    print("P149_OFFLINE_FIXTURES=4/4_PASS")
