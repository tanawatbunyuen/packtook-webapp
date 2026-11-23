#!/usr/bin/env python3
from pathlib import Path
import tempfile,subprocess,sys,os
program=Path(__file__).with_name("p156-timeout-env-diagnostic.py")
with tempfile.TemporaryDirectory() as directory:
    home=Path(directory)
    private=home/".packtook-demo-emulator-home";private.mkdir()
    log=private/"p155-setup.log"
    secret="this-must-never-appear-or-secret-host.example"
    log.write_text("Downloading emulator at https://"+secret+"\n")
    env={**os.environ,"HOME":str(home),"HTTPS_PROXY":"https://"+secret}
    run=subprocess.run([sys.executable,str(program)],capture_output=True,text=True,env=env,timeout=5)
    assert run.returncode==0,(run.stdout,run.stderr)
    assert "P156_PROXY_ENV_STRIPPED_RISK=TRUE" in run.stdout
    assert "P156_DIAGNOSTIC=PROXY_STRIPPED_CANDIDATE_NOT_CONFIRMED" in run.stdout
    assert secret not in run.stdout
    print("P156_PROXY_NAMES_ONLY=PASS")
    env.pop("HTTPS_PROXY",None)
    for k in ("HTTP_PROXY","ALL_PROXY","NO_PROXY","https_proxy","http_proxy","all_proxy","no_proxy"):env.pop(k,None)
    log.write_text("Downloading emulator\nERROR: ETIMEDOUT\n")
    run=subprocess.run([sys.executable,str(program)],capture_output=True,text=True,env=env,timeout=5)
    assert run.returncode==0 and "P156_LOG_TIMEOUT_LINES=1" in run.stdout
    print("P156_NETWORK_ERROR_TAGS=PASS")
    log.unlink();log.symlink_to(private/"missing")
    run=subprocess.run([sys.executable,str(program)],capture_output=True,text=True,env=env,timeout=5)
    assert run.returncode!=0 and "P156_BLOCK=PRIVATE_SETUP_LOG_MISSING_OR_UNSAFE" in run.stdout
    print("P156_SYMLINK_FAIL_CLOSED=PASS")
    print("P156_OFFLINE_FIXTURES=3/3_PASS")
