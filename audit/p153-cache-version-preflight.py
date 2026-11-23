#!/usr/bin/env python3
"""P153: static local Firestore emulator cache vs Firebase CLI inspection.
No network, no CLI/module execution, no printing arbitrary log/source text.
"""
from pathlib import Path
import os, re, shutil, sys
VERSION = re.compile(r"^cloud-firestore-emulator-v([0-9]+(?:\.[0-9]+){1,3})\.jar$")
def cli_root():
    exe = shutil.which("firebase")
    if not exe: return None
    p = Path(exe).resolve()
    for parent in (p.parent, *p.parents):
        package = parent / "package.json"
        if package.is_file() and package.stat().st_size < 2000000:
            # Only parse package name, never execute Node or CLI
            try:
                import json
                if json.loads(package.read_text(encoding="utf-8")).get("name")=="firebase-tools":
                    return parent
            except (OSError,ValueError,UnicodeError):
                pass
    return None
def versions(cache):
    if cache.is_symlink() or not cache.is_dir():return [],0
    valid=[];other=0
    for p in cache.iterdir():
        if p.is_symlink() or not p.is_file():continue
        m=VERSION.fullmatch(p.name)
        if m and p.stat().st_size > 1000000:
            valid.append(m.group(1))
        elif p.name.startswith("cloud-firestore-emulator"):other+=1
    return sorted(set(valid)),other
def expected_from_sources(root):
    if root is None:return []
    # Probe bounded fixed paths only. Matches complete literal names, not variables.
    paths=("lib/emulator/downloadableEmulators.js","lib/emulator/constants.js",
           "lib/emulator/download.js","lib/emulator/downloadableEmulators.json")
    found=set()
    for rel in paths:
        p=root/rel
        if p.is_symlink() or not p.is_file() or p.stat().st_size>2000000:continue
        raw=p.read_text(encoding="utf-8",errors="replace")
        for match in re.finditer(r"cloud-firestore-emulator-v([0-9]+(?:\.[0-9]+){1,3})\.jar",raw):
            found.add(match.group(1))
    return sorted(found)
def main():
    original=Path.home()/".cache/firebase/emulators"
    private=Path.home()/".packtook-demo-emulator-home/.cache/firebase/emulators"
    source_versions,source_other=versions(original)
    private_versions,private_other=versions(private)
    root=cli_root()
    expected=expected_from_sources(root)
    log=Path.home()/".packtook-demo-emulator-home/p141-emulator.log"
    if log.is_symlink() or not log.is_file() or log.stat().st_size>2000000:raise RuntimeError("PRIVATE_LOG_UNSAFE_OR_MISSING")
    lines=log.read_text(encoding="utf-8",errors="replace").splitlines()
    download_start=sum(bool(re.search(r"\bdownloading\b|download started|starting download",x,re.I)) for x in lines)
    download_done=sum(bool(re.search(r"\bdownload(?:ed| complete| succeeded| finished)\b",x,re.I)) for x in lines)
    print("P153_MODE=STATIC_CACHE_AND_PRIVATE_LOG_ONLY")
    print("P153_FIREBASE_PACKAGE_FOUND="+str(root is not None).upper())
    print("P153_SOURCE_CACHE_VERSIONS="+(",".join(source_versions) if source_versions else "NONE"))
    print("P153_PRIVATE_CACHE_VERSIONS="+(",".join(private_versions) if private_versions else "NONE"))
    print("P153_CLI_LITERAL_JAR_VERSIONS="+(",".join(expected) if expected else "NOT_EMBEDDED_OR_UNKNOWN"))
    print("P153_SOURCE_OTHER_FIRESTORE_FILES="+str(source_other))
    print("P153_PRIVATE_OTHER_FIRESTORE_FILES="+str(private_other))
    print("P153_PRIVATE_CACHE_VERSION_PARITY="+str(source_versions==private_versions).upper())
    print("P153_LOG_LINES="+str(len(lines)))
    print("P153_EXPLICIT_DOWNLOAD_START_LINES="+str(download_start))
    print("P153_EXPLICIT_DOWNLOAD_DONE_LINES="+str(download_done))
    if expected and private_versions and not set(expected).intersection(private_versions):
        diagnosis="LITERAL_EXPECTED_JAR_VERSION_MISSING"
    elif expected and set(expected).intersection(private_versions):
        diagnosis="EXPECTED_LITERAL_JAR_PRESENT"
    elif download_start and not download_done:
        diagnosis="DOWNLOAD_START_WITHOUT_COMPLETION_EXPECTED_VERSION_UNKNOWN"
    else:
        diagnosis="CACHE_VERSION_CAUSE_UNCONFIRMED"
    print("P153_DIAGNOSTIC="+diagnosis)
    print("P153_CACHE_MODIFICATIONS=0 P153_FIREBASE_CLI_RUNS=0 P153_NETWORK_CALLS=0 P153_EMULATOR_STARTS=0 P153_DEPLOYS=0")
    print("P153_DECISION=NO_GO_OWNER_IMPORT_OR_DEPLOY")
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("P153_BLOCK="+("PRIVATE_LOG_UNSAFE_OR_MISSING" if isinstance(e,RuntimeError) and str(e)=="PRIVATE_LOG_UNSAFE_OR_MISSING" else "LOCAL_DIAGNOSTIC_FAILED"))
        sys.exit(1)
