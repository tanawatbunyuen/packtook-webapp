#!/usr/bin/env python3
import pathlib,subprocess,sys,tempfile,os
script=pathlib.Path(__file__).with_name("p154-cli-manifest-preflight.py")
with tempfile.TemporaryDirectory() as tmp:
    home=pathlib.Path(tmp)
    package=home/"node_modules/firebase-tools"
    (package/"lib/emulator").mkdir(parents=True)
    (package/"package.json").write_text('{"name":"firebase-tools","version":"15.34.2"}')
    (package/"lib/emulator/downloadableEmulators.js").write_text('const jar="cloud-firestore-emulator-v1.22.0.jar"; const firestoreVersion="1.22.0";')
    (home/"bin").mkdir()
    (package/"lib/emulator/downloadableEmulators.js").chmod(0o755)
    (home/"bin/firebase").symlink_to(package/"lib/emulator/downloadableEmulators.js")
    cache=home/".packtook-demo-emulator-home/.cache/firebase/emulators"
    cache.mkdir(parents=True)
    (cache/"cloud-firestore-emulator-v1.21.0.jar").write_bytes(b"Z"*1000001)
    log=home/".packtook-demo-emulator-home/p141-emulator.log"
    log.write_text("Downloading Cloud Firestore emulator\n")
    env={**os.environ,"HOME":str(home),"PATH":str(home/"bin")+":/usr/bin:/bin"}
    r=subprocess.run([sys.executable,str(script)],env=env,capture_output=True,text=True,timeout=10)
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P154_FIREBASE_TOOLS_VERSION=15.34.2" in r.stdout
    assert "P154_CLI_LITERAL_JAR_VERSIONS=1.22.0" in r.stdout
    assert "P154_PRIVATE_CACHE_VERSIONS=1.21.0" in r.stdout
    assert "P154_DIAGNOSTIC=CLI_JAR_LITERAL_MISMATCH_CANDIDATE" in r.stdout
    assert str(home) not in r.stdout
    print("P154_STATIC_MISMATCH_CANDIDATE=PASS")
    (cache/"cloud-firestore-emulator-v1.22.0.jar").write_bytes(b"Q"*1000001)
    r=subprocess.run([sys.executable,str(script)],env=env,capture_output=True,text=True,timeout=10)
    assert r.returncode==0 and "P154_DIAGNOSTIC=CLI_JAR_LITERAL_MATCH_PRESENT" in r.stdout
    print("P154_STATIC_LITERAL_MATCH=PASS")
    log.unlink();log.symlink_to(home/"unsafe")
    r=subprocess.run([sys.executable,str(script)],env=env,capture_output=True,text=True,timeout=10)
    assert r.returncode==1 and "P154_BLOCK=PRIVATE_LOG_UNSAFE" in r.stdout
    print("P154_LOG_SYMLINK_FAIL_CLOSED=PASS")
    print("P154_OFFLINE_FIXTURES=3/3_PASS")
