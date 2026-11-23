#!/usr/bin/env python3
"""P158: bounded official Firestore JAR download to isolated cache.
Explicit flag required. No Firebase CLI, emulator start or cloud writes.
"""
import argparse,hashlib,os,pathlib,re,socket,sys,time,urllib.request,zipfile

URL="https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar"
NAME="cloud-firestore-emulator-v1.22.0.jar"
SIZE=136707194
LIMIT=230
def validate_jar(file,expected_size):
    if file.is_symlink() or not file.is_file() or file.stat().st_size!=expected_size:return False
    try:
        with zipfile.ZipFile(file,"r") as z:
            names=z.namelist()
            if not names or not any(x.endswith(".class") for x in names):return False
            return z.testzip() is None
    except (OSError,zipfile.BadZipFile,RuntimeError,ValueError):
        return False
def download_to(cache,opener,expected_size=SIZE,clock=time.monotonic):
    # Existing directory must be private; never overwrite a valid or invalid JAR.
    if cache.is_symlink() or not cache.is_dir():return "CACHE_UNSAFE"
    target=cache/NAME
    if target.is_symlink():return "TARGET_SYMLINK"
    if target.exists():return "ALREADY_VALID" if validate_jar(target,expected_size) else "TARGET_EXISTS_INVALID_NO_OVERWRITE"
    tmp=cache/".p158-firestore-1.22.0.partial"
    if tmp.exists() or tmp.is_symlink():return "PARTIAL_EXISTS_NO_OVERWRITE"
    start=clock()
    total=0
    try:
        req=urllib.request.Request(URL,headers={"User-Agent":"PACKTOOK-P158-verified-artifact"})
        with opener.open(req,timeout=15) as response, tmp.open("xb") as out:
            if response.status!=200:return "HTTP_STATUS_NOT_200"
            advertised=response.headers.get("Content-Length","")
            if not advertised.isdecimal() or int(advertised)!=expected_size:return "CONTENT_LENGTH_MISMATCH"
            while True:
                if clock()-start>LIMIT:return "TRANSFER_DEADLINE_EXCEEDED"
                data=response.read(1024*1024)
                if not data:break
                total+=len(data)
                if total>expected_size:return "TRANSFER_OVERFLOW"
                out.write(data)
            out.flush();os.fsync(out.fileno())
        if total!=expected_size:return "INCOMPLETE_DOWNLOAD"
        if not validate_jar(tmp,expected_size):return "JAR_SIZE_ZIP_OR_CRC_INVALID"
        # atomic rename only after full verification; do not touch original v1.21.0
        if target.exists() or target.is_symlink():return "TARGET_APPEARED_NO_OVERWRITE"
        os.replace(tmp,target)
        return "VALIDATED_AND_INSTALLED"
    except (OSError,ValueError,TimeoutError,urllib.error.URLError):
        return "NETWORK_OR_IO_FAILURE"
    finally:
        if tmp.exists() and not tmp.is_symlink():
            tmp.unlink()
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--download-verified-only",action="store_true")
    a=parser.parse_args()
    if not a.download_verified_only:
        print("P158_BLOCK=EXPLICIT_VERIFIED_DOWNLOAD_FLAG_REQUIRED");return 2
    home=pathlib.Path.home()
    if not home.is_absolute():print("P158_BLOCK=INVALID_HOME");return 2
    cache=home/".packtook-demo-emulator-home/.cache/firebase/emulators"
    print("P158_MODE=EXPLICIT_BOUNDED_VERIFIED_OFFICIAL_GET")
    print("P158_EXPECTED_VERSION=1.22.0")
    print("P158_EXPECTED_BYTES="+str(SIZE))
    print("P158_TARGET=EXISTING_PRIVATE_ISOLATED_CACHE")
    print("P158_NO_FIREBASE_CLI_NO_EMULATOR_START_NO_OWNER_IMPORT=TRUE")
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    status=download_to(cache,opener)
    path=cache/NAME
    valid=path.exists() and validate_jar(path,SIZE)
    print("P158_RESULT="+status)
    print("P158_JAR_1_22_0_SIZE_AND_ZIP_CRC_VALID="+str(valid).upper())
    if valid:
        sha=hashlib.file_digest(path.open("rb"),"sha256").hexdigest()
        print("P158_JAR_SHA256="+sha)
    print("P158_NO_RAW_URLS_LOGS_CREDENTIALS=TRUE")
    print("P158_FIREBASE_CLI_RUNS=0 P158_EMULATOR_STARTS=0 P158_STAGING_PROD_WRITES=0 P158_DEPLOYS=0")
    print("P158_DECISION="+("ARTIFACT_READY_NOT_EMULATOR_ATTESTED" if valid else "NO_GO_ARTIFACT_NOT_VERIFIED"))
    return 0 if valid else 1
if __name__=="__main__":
    try:sys.exit(main())
    except Exception:
        print("P158_BLOCK=UNEXPECTED_LOCAL_FAILURE")
        sys.exit(1)
