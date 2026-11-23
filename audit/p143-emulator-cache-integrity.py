#!/usr/bin/env python3
"""P143: offline emulator cache integrity inventory. Never prints file paths, names or contents."""
import argparse
import pathlib
import stat
import sys
import zipfile

LIMIT_FILES=1000
LIMIT_BYTES=2_000_000_000

def inspect(root):
    result={"present":False,"regular_files":0,"jar_files":0,"jar_valid":0,"jar_invalid":0,
            "other_files":0,"symlinks":0,"oversize":0,"bytes":0}
    if not root.exists():
        return result
    if root.is_symlink() or not root.is_dir():
        raise RuntimeError("CACHE_ROOT_UNSAFE")
    result["present"]=True
    pending=[root]
    while pending:
        folder=pending.pop()
        for child in folder.iterdir():
            if child.is_symlink():
                result["symlinks"]+=1
                continue
            mode=child.lstat().st_mode
            if stat.S_ISDIR(mode):
                pending.append(child)
                continue
            if not stat.S_ISREG(mode):
                result["other_files"]+=1
                continue
            result["regular_files"]+=1
            if result["regular_files"]>LIMIT_FILES:raise RuntimeError("CACHE_TOO_MANY_FILES")
            size=child.stat().st_size
            result["bytes"]+=size
            if result["bytes"]>LIMIT_BYTES:raise RuntimeError("CACHE_TOO_LARGE")
            if child.suffix.lower()!=".jar":
                result["other_files"]+=1
                continue
            result["jar_files"]+=1
            if size>500_000_000:
                result["oversize"]+=1
                continue
            try:
                with zipfile.ZipFile(child) as z:
                    entries=z.infolist()
                    if not entries or len(entries)>200000:
                        result["jar_invalid"]+=1
                    elif z.testzip() is not None:
                        result["jar_invalid"]+=1
                    else:
                        result["jar_valid"]+=1
            except (zipfile.BadZipFile, OSError, EOFError, RuntimeError, ValueError):
                result["jar_invalid"]+=1
    return result

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source-cache", default=str(pathlib.Path.home()/".cache/firebase/emulators"))
    ap.add_argument("--private-cache",default=str(pathlib.Path.home()/".packtook-demo-emulator-home/.cache/firebase/emulators"))
    args=ap.parse_args()
    a=inspect(pathlib.Path(args.source_cache).expanduser())
    b=inspect(pathlib.Path(args.private_cache).expanduser())
    print("P143_MODE=LOCAL_CACHE_FILE_INTEGRITY_ONLY")
    for key,r in (("SOURCE",a),("PRIVATE",b)):
        for field,value in r.items():
            val=str(value).upper() if isinstance(value,bool) else str(value)
            print("P143_"+key+"_"+field.upper()+"="+val)
    copied=(a["present"] and b["present"] and a["regular_files"]==b["regular_files"] and a["bytes"]==b["bytes"])
    print("P143_CACHE_COUNTS_AND_BYTES_MATCH="+str(copied).upper())
    if b["jar_files"]==0:
        diagnostic="PRIVATE_CACHE_HAS_NO_JAR"
    elif b["jar_invalid"] or b["oversize"] or b["symlinks"]:
        diagnostic="CACHE_HAS_UNSAFE_OR_INVALID_FILES"
    elif not copied:
        diagnostic="CACHE_CONTENT_COUNTS_DIFFER"
    else:
        diagnostic="CACHE_JAR_INTEGRITY_NO_OBVIOUS_ERROR"
    print("P143_DIAGNOSTIC="+diagnostic)
    print("P143_FILE_PATHS_OR_CONTENTS_PRINTED=NO")
    print("P143_EMULATOR_STARTS=0 P143_NETWORK_CALLS=0 P143_CLOUD_WRITES=0 P143_DEPLOYS=0")
    print("P143_DECISION=NO_GO_EMULATOR_STARTUP_NOT_ATTESTED")
if __name__=="__main__":
    try:main()
    except Exception as e:
        msg=str(e) if isinstance(e,RuntimeError) else "LOCAL_CACHE_SCAN_FAILED"
        if msg not in ("CACHE_ROOT_UNSAFE","CACHE_TOO_MANY_FILES","CACHE_TOO_LARGE"):msg="LOCAL_CACHE_SCAN_FAILED"
        print("P143_BLOCK="+msg)
        sys.exit(1)
