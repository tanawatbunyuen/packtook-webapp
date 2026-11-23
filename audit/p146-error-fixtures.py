#!/usr/bin/env python3
import pathlib,subprocess,sys,tempfile
script=pathlib.Path(__file__).with_name("p146-emulator-error-taxonomy.py")
def run(file):
    return subprocess.run([sys.executable,str(script),"--log",str(file)],capture_output=True,text=True,timeout=10)
with tempfile.TemporaryDirectory() as d:
    root=pathlib.Path(d);log=root/"private.log"
    secret="SuperSecretTokenThatMustNotAppear"
    log.write_text("Starting emulators: firestore, auth\nDownloading emulator\nError: Request failed HTTP 404 at https://secret.example/"+secret+"\n")
    r=run(log)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P146_CATEGORY_HTTP_404=1" in r.stdout
    assert "P146_DIAGNOSTIC=NETWORK_OR_PROVIDER_ERROR_SIGNAL" in r.stdout
    assert "P146_FIRST_ERROR_LINE_INDEX=3" in r.stdout
    assert secret not in r.stdout and str(root) not in r.stdout and "https://" not in r.stdout
    print("P146_HTTP_ERROR_AND_NO_SECRET_ECHO=PASS")
    log.write_text("Starting firestore\nError: Could not load firestore.rules: No such file or directory\n")
    r=run(log)
    assert "P146_CATEGORY_FIRESTORE_RULES_PATH=1" in r.stdout
    assert "P146_DIAGNOSTIC=RULES_RESOLUTION_ERROR_SIGNAL" in r.stdout
    print("P146_RULES_PATH_SIGNAL=PASS")
    log.write_text("Downloading emulator\nError: java.lang.UnsupportedClassVersionError\n")
    r=run(log)
    assert "P146_CATEGORY_JAVA_LAUNCH=1" in r.stdout
    assert "P146_DIAGNOSTIC=JAVA_LAUNCH_ERROR_SIGNAL" in r.stdout
    print("P146_JAVA_FAILURE_SIGNAL=PASS")
    log.write_text("Starting emulators\nDownloading emulator\nError: unexpected condition\n")
    r=run(log)
    assert "P146_DIAGNOSTIC=UNCLASSIFIED_ERROR_IN_PRIVATE_LOG" in r.stdout
    print("P146_UNCLASSIFIED_GENERIC_ERROR=PASS")
    symlink=root/"symlink.log";symlink.symlink_to(log)
    r=run(symlink)
    assert r.returncode==1 and "P146_BLOCK=LOG_MISSING_OR_UNSAFE" in r.stdout
    print("P146_SYMLINK_FAIL_CLOSED=PASS")
    print("P146_OFFLINE_FIXTURES=5/5_PASS")
