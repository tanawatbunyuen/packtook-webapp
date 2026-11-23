#!/usr/bin/env python3
"""P154: offline static CLI manifest evidence and cache status; no Firebase execution."""
from pathlib import Path
import json, os, re, shutil, sys
JAR=re.compile(r"cloud-firestore-emulator-v(\d+(?:\.\d+){1,3})\.jar")
VERS=re.compile(r"\b(?:v)?(\d+\.\d+\.\d+)\b")
def cli_root():
    exe=shutil.which("firebase")
    if not exe:return None
    p=Path(exe).resolve()
    for x in (p.parent,*p.parents):
        q=x/"package.json"
        try:
            if q.is_file() and q.stat().st_size<1000000:
                info=json.loads(q.read_text(encoding="utf8"))
                if info.get("name")=="firebase-tools":return x,info.get("version","UNKNOWN")
        except (OSError,ValueError,UnicodeError):continue
    return None
def gather(root):
    """Search only selected CLI emulator JS/JSON with bounded sizes."""
    base=root/"lib"/"emulator"
    if not base.is_dir() or base.is_symlink():return 0,[],[],0
    checked=0
    jar_versions=set();nearby_versions=set();firestore_mentions=0
    for file in base.rglob("*"):
        if checked>=180:break
        try:
            if file.is_symlink() or not file.is_file() or file.suffix not in (".js",".json") or file.stat().st_size>600000:continue
            text=file.read_text(encoding="utf8",errors="replace")
        except OSError:continue
        checked+=1
        matches=list(re.finditer("firestore",text,re.I))
        firestore_mentions+=len(matches)
        for m in JAR.finditer(text):jar_versions.add(m.group(1))
        for m in matches:
            window=text[max(0,m.start()-150):m.end()+150]
            for v in VERS.finditer(window):nearby_versions.add(v.group(1))
    return checked,sorted(jar_versions),sorted(nearby_versions),firestore_mentions
def cache_versions(folder):
    if folder.is_symlink() or not folder.is_dir():return []
    out=set()
    for f in folder.iterdir():
        try:
            if f.is_symlink() or not f.is_file() or f.stat().st_size<1000000:continue
        except OSError:continue
        match=JAR.fullmatch(f.name)
        if match:out.add(match.group(1))
    return sorted(out)
def main():
    info=cli_root()
    if info is None:raise RuntimeError("CLI_PACKAGE_NOT_FOUND")
    root,cli_version=info
    if not re.fullmatch(r"\d+\.\d+\.\d+",cli_version):cli_version="UNKNOWN"
    checked,jars,nearby,mentions=gather(root)
    private=cache_versions(Path.home()/".packtook-demo-emulator-home/.cache/firebase/emulators")
    log=Path.home()/".packtook-demo-emulator-home/p141-emulator.log"
    if log.is_symlink() or not log.is_file() or log.stat().st_size>2000000:raise RuntimeError("PRIVATE_LOG_UNSAFE")
    lines=log.read_text(encoding="utf8",errors="replace").splitlines()
    starts=sum(bool(re.search(r"\bdownloading\b",line,re.I)) for line in lines)
    finishes=sum(bool(re.search(r"\bdownload(?:ed| complete| finished| succeeded)\b",line,re.I)) for line in lines)
    print("P154_MODE=STATIC_INSTALLED_FIREBASE_TOOLS_ONLY")
    print("P154_FIREBASE_TOOLS_VERSION="+cli_version)
    print("P154_EMULATOR_SOURCE_FILES_SCANNED="+str(checked))
    print("P154_FIRESTORE_SOURCE_MENTIONS="+str(mentions))
    print("P154_CLI_LITERAL_JAR_VERSIONS="+(",".join(jars) if jars else "NONE"))
    print("P154_CLI_FIRESTORE_NEARBY_VERSIONS="+(",".join(nearby) if nearby else "NONE"))
    print("P154_PRIVATE_CACHE_VERSIONS="+(",".join(private) if private else "NONE"))
    print("P154_DOWNLOAD_START_LINES="+str(starts))
    print("P154_DOWNLOAD_FINISH_LINES="+str(finishes))
    if jars and not set(jars).intersection(private):diagnostic="CLI_JAR_LITERAL_MISMATCH_CANDIDATE"
    elif jars and set(jars).intersection(private):diagnostic="CLI_JAR_LITERAL_MATCH_PRESENT"
    elif starts and not finishes:diagnostic="DOWNLOAD_STEP_UNCONFIRMED_WITH_STATIC_VERSION_UNKNOWN"
    else:diagnostic="STATIC_VERSION_UNRESOLVED"
    print("P154_DIAGNOSTIC="+diagnostic)
    print("P154_SOURCE_CODE_EXECUTION=0 P154_FIREBASE_RUNS=0 P154_NETWORK_CALLS=0 P154_CACHE_WRITES=0 P154_DEPLOYS=0")
    print("P154_DECISION=NO_GO_OWNER_IMPORT_OR_DEPLOY")
if __name__=="__main__":
    try:main()
    except Exception as e:
        reason=str(e) if isinstance(e,RuntimeError) and str(e) in ("CLI_PACKAGE_NOT_FOUND","PRIVATE_LOG_UNSAFE") else "STATIC_PREFLIGHT_FAILED"
        print("P154_BLOCK="+reason);sys.exit(1)
