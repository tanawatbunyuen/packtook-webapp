#!/usr/bin/env python3
import pathlib,subprocess,sys,tempfile,zipfile
script=pathlib.Path(__file__).with_name("p144-emulator-startup-phase.py")
with tempfile.TemporaryDirectory() as tmp:
    root=pathlib.Path(tmp);src=root/"source";dst=root/"private";src.mkdir();dst.mkdir()
    for folder in (src,dst):
        with zipfile.ZipFile(folder/"demo.jar","w") as jar:
            jar.writestr("META-INF/MANIFEST.MF","Manifest-Version: 1.0\n")
    log=root/"private.log"
    secret="fictional-secret-string-should-not-appear"
    log.write_text("Starting emulators: firestore, auth\nChecking for updates\nFirestore Emulator: downloading emulator archive\n"+secret+"\n")
    cmd=[sys.executable,str(script),"--log",str(log),"--source-cache",str(src),"--private-cache",str(dst)]
    x=subprocess.run(cmd,capture_output=True,text=True,timeout=12)
    assert x.returncode==0,(x.stdout,x.stderr)
    assert "P144_SOURCE_PRIVATE_SHA256_EQUAL=TRUE" in x.stdout
    assert "P144_DIAGNOSTIC=DOWNLOAD_STARTED_NOT_CONFIRMED_FINISHED" in x.stdout
    assert secret not in x.stdout and str(root) not in x.stdout
    print("P144_IDENTICAL_JARS_AND_DOWNLOAD_STAGE_NO_SECRET=PASS")
    with zipfile.ZipFile(dst/"demo.jar","w") as jar:jar.writestr("META-INF/MANIFEST.MF","Altered\n")
    x=subprocess.run(cmd,capture_output=True,text=True,timeout=12)
    assert "P144_SOURCE_PRIVATE_SHA256_EQUAL=FALSE" in x.stdout
    print("P144_DIFFERENT_JAR_HASH_DETECTED=PASS")
    log.write_text("Starting emulators: firestore\njava process started\nError: ETIMEDOUT\n")
    x=subprocess.run(cmd,capture_output=True,text=True,timeout=12)
    assert "P144_DIAGNOSTIC=NETWORK_ERROR_EVIDENCE" in x.stdout
    assert "P144_STAGE_NETWORK_ERROR=TRUE" in x.stdout
    print("P144_NETWORK_ERROR_PRIORITY=PASS")
    log.unlink();log.symlink_to(root/"missing")
    x=subprocess.run(cmd,capture_output=True,text=True,timeout=12)
    assert x.returncode==1 and "P144_BLOCK=LOG_MISSING_OR_UNSAFE" in x.stdout
    print("P144_UNSAFE_LOG_BLOCK=PASS")
    print("P144_OFFLINE_FIXTURES=4/4_PASS")
