#!/usr/bin/env python3
import pathlib,subprocess,sys,tempfile,os
script=pathlib.Path(__file__).with_name("p152-last-startup-status.py")
with tempfile.TemporaryDirectory() as temp:
    home=pathlib.Path(temp)
    d=home/".packtook-demo-emulator-home";d.mkdir()
    log=d/"p141-emulator.log"
    log.write_text("Error: Could not check if port 4500 was available: listen EADDRNOTAVAIL ::1\n")
    result=subprocess.run([sys.executable,str(script)],env={**os.environ,"HOME":str(home)},capture_output=True,text=True,timeout=10)
    assert result.returncode==0,(result.stdout,result.stderr)
    assert "P152_EADDRNOTAVAIL_PORT_4500=1" in result.stdout
    assert "P152_DIAGNOSTIC=IPV6_BIND_ERROR_REMAINS" in result.stdout
    assert "::1" not in result.stdout
    print("P152_PRIVATE_LOG_IPV6_CATEGORY_ONLY=PASS")
    log.write_text("Starting emulators: firestore, auth\n")
    result=subprocess.run([sys.executable,str(script)],env={**os.environ,"HOME":str(home)},capture_output=True,text=True,timeout=10)
    assert result.returncode==0
    assert "P152_DIAGNOSTIC=NO_REMAINING_IPV6_BIND_ERROR_IN_LOG" in result.stdout
    print("P152_CLEAN_PRIVATE_LOG_CATEGORY_ONLY=PASS")
    log.unlink();log.symlink_to(d/"untrusted")
    result=subprocess.run([sys.executable,str(script)],env={**os.environ,"HOME":str(home)},capture_output=True,text=True,timeout=10)
    assert result.returncode==1 and "P152_BLOCK=PRIVATE_LOG_UNSAFE_OR_MISSING" in result.stdout
    print("P152_SYMLINK_LOG_FAIL_CLOSED=PASS")
    print("P152_LOG_FIXTURES=3/3_PASS")
