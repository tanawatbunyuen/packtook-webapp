#!/usr/bin/env python3
import pathlib,subprocess,sys,tempfile
script=pathlib.Path(__file__).with_name("p147-runtime-and-error-tags.py")
with tempfile.TemporaryDirectory() as t:
    log=pathlib.Path(t)/"startup.log"
    secret="mySecretCustomerEmail-abc@example.com"
    log.write_text("Starting emulator\nError: Unexpected TypeError failed to download https://example.com/path?token="+secret+"\n")
    r=subprocess.run([sys.executable,str(script),"--log",str(log)],capture_output=True,text=True,timeout=10)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P147_NODE_MAJOR=" in r.stdout
    assert "P147_ERROR_LINE_COUNT=1" in r.stdout
    assert "P147_ERROR_LINE_2_ALLOWLIST_TAGS=" in r.stdout
    assert "P147_FIREBASE_CLI_RUNS=0" in r.stdout
    assert secret not in r.stdout and "example.com" not in r.stdout and str(log) not in r.stdout
    print("P147_REDACTED_ERROR_TAGS_AND_NODE_MAJOR=PASS")
    link=pathlib.Path(t)/"link.log"
    link.symlink_to(log)
    r=subprocess.run([sys.executable,str(script),"--log",str(link)],capture_output=True,text=True,timeout=10)
    assert r.returncode==1 and "P147_BLOCK=LOG_UNSAFE_OR_MISSING" in r.stdout
    print("P147_SYMLINK_LOG_FAIL_CLOSED=PASS")
    print("P147_OFFLINE_FIXTURES=2/2_PASS")
