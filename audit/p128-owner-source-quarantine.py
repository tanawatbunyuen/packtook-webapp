#!/usr/bin/env python3
"""P128 recovery: locally quarantine verified staging Owner archive, never execute recovered code.
Only GET from one pinned staging function/build storage; no Cloud writes or Git pushes.
"""
import argparse,hashlib,io,json,os,pathlib,re,stat,subprocess,sys,tempfile,zipfile
PROJECT="packtook-staging"
REGION="asia-southeast1"
FUNCTION="ownerGetCustomerAdjustmentHistory"
EXPECTED="e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456"
SYMBOLS=("ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
MAX_ARCHIVE=5*1024*1024
MAX_TOTAL=20*1024*1024
MAX_FILE=3*1024*1024
def cmd_json(args):
    p=subprocess.run(args,capture_output=True,text=True,timeout=40)
    if p.returncode:raise RuntimeError("GCLOUD_METADATA_READ_FAILED")
    try:return json.loads(p.stdout)
    except json.JSONDecodeError:raise RuntimeError("GCLOUD_METADATA_JSON_INVALID")
def source_url(fn):
    expected="projects/"+PROJECT+"/locations/"+REGION+"/functions/"+FUNCTION
    if fn.get("name")!=expected:raise RuntimeError("FUNCTION_ID_MISMATCH")
    source=(fn.get("buildConfig") or {}).get("source") or {}
    storage=source.get("storageSource") if isinstance(source,dict) else None
    if not isinstance(storage,dict):raise RuntimeError("NO_STORAGE_SOURCE")
    bucket,obj=storage.get("bucket"),storage.get("object")
    if not isinstance(bucket,str) or not re.fullmatch(r"[A-Za-z0-9._-]{3,222}",bucket):raise RuntimeError("INVALID_BUCKET")
    if not isinstance(obj,str) or not obj or len(obj)>1024 or any(ord(c)<32 for c in obj):raise RuntimeError("INVALID_OBJECT")
    return "gs://"+bucket+"/"+obj
def extract_verified(contents,dest,expected_sha):
    if len(contents)>MAX_ARCHIVE:raise RuntimeError("ARCHIVE_TOO_LARGE")
    digest=hashlib.sha256(contents).hexdigest()
    if digest!=expected_sha:raise RuntimeError("ARCHIVE_HASH_MISMATCH")
    manifest=[]
    found=set()
    with zipfile.ZipFile(io.BytesIO(contents)) as archive:
        entries=archive.infolist()
        if len(entries)>1000:raise RuntimeError("ZIP_TOO_MANY_ENTRIES")
        total=0
        paths=set()
        for entry in entries:
            name=entry.filename
            p=pathlib.PurePosixPath(name)
            if not name or p.is_absolute() or "\\" in name or ".." in p.parts or ":" in name or name.startswith("~"):
                raise RuntimeError("UNSAFE_ARCHIVE_PATH")
            if name.rstrip("/") in paths:raise RuntimeError("DUPLICATE_ZIP_PATH")
            paths.add(name.rstrip("/"))
            filetype=(entry.external_attr>>16)&0o170000
            if filetype not in (0,stat.S_IFREG,stat.S_IFDIR):raise RuntimeError("UNSAFE_ZIP_FILE_TYPE")
            if entry.file_size>MAX_FILE:raise RuntimeError("ZIP_FILE_TOO_LARGE")
            total+=entry.file_size
            if total>MAX_TOTAL:raise RuntimeError("ZIP_TOTAL_TOO_LARGE")
        # Validation completed; only now write private extracted files.
        for entry in entries:
            p=dest.joinpath(*pathlib.PurePosixPath(entry.filename).parts)
            if entry.is_dir():
                p.mkdir(mode=0o700,parents=True,exist_ok=True)
                continue
            p.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
            raw=archive.read(entry)
            with open(p,"xb") as out:
                os.chmod(p,0o600)
                out.write(raw)
            manifest.append({"path":entry.filename,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()})
            if entry.filename.endswith((".js",".cjs",".mjs",".ts")) and "node_modules/" not in entry.filename:
                for symbol in SYMBOLS:
                    if symbol.encode() in raw:found.add(symbol)
    return digest,manifest,found
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--fixture-archive",help="CI offline fixture only: skip gcloud")
    ap.add_argument("--expected-sha",help="CI fixture expected archive sha; only valid with --fixture-archive")
    ap.add_argument("--destination",help="Optional fresh private directory; no existing destination allowed")
    args=ap.parse_args()
    if args.expected_sha and not args.fixture_archive:raise RuntimeError("EXPECTED_HASH_OVERRIDE_DISALLOWED")
    target=pathlib.Path(args.destination).expanduser() if args.destination else pathlib.Path.home()/".packtook-recovery"/("p128-owner-"+EXPECTED[:12])
    if target.exists():raise RuntimeError("RECOVERY_DESTINATION_EXISTS")
    target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    if target.parent.is_symlink():raise RuntimeError("SYMLINK_PARENT_BLOCKED")
    try:
        if args.fixture_archive:
            data=pathlib.Path(args.fixture_archive).read_bytes()
            expected_sha=args.expected_sha or EXPECTED
        else:
            fn=cmd_json(["gcloud","functions","describe",FUNCTION,"--v2","--project="+PROJECT,"--region="+REGION,"--format=json"])
            url=source_url(fn)
            with tempfile.TemporaryDirectory(prefix="p128-staging-copy-") as d:
                os.chmod(d,0o700)
                zip_path=pathlib.Path(d)/"source.zip"
                p=subprocess.run(["gcloud","storage","cp",url,str(zip_path),"--project="+PROJECT,"--quiet"],capture_output=True,text=True,timeout=90)
                if p.returncode:raise RuntimeError("SOURCE_ARCHIVE_READ_FAILED")
                data=zip_path.read_bytes()
            expected_sha=EXPECTED
        # Extract into a fresh private directory, without placing anything inside Git.
        target.mkdir(mode=0o700)
        recovered=target/"recovered"
        recovered.mkdir(mode=0o700)
        digest,manifest,found=extract_verified(data,recovered,expected_sha)
        (target/"source.sha256").write_text(digest+"\n")
        (target/"manifest.json").write_text(json.dumps({"archive_sha256":digest,"files":manifest},indent=2)+"\n")
        for f in (target/"source.sha256",target/"manifest.json"):os.chmod(f,0o600)
        print("P128_ARCHIVE_SHA256_MATCH=TRUE")
        print("P128_EXTRACTED_FILE_COUNT="+str(len(manifest)))
        for symbol in SYMBOLS:
            print("P128_OWNER_SYMBOL="+symbol+" PRESENT="+str(symbol in found).upper())
        print("P128_QUARANTINE_DIRECTORY="+str(target))
        print("P128_REPOSITORY_WRITES=0 P128_CLOUD_WRITES=0 P128_DEPLOYS=0")
        print("P128_DECISION=LOCAL_SOURCE_RECOVERY_REQUIRES_SECURITY_REVIEW")
    except BaseException:
        # If extraction failed, leave no partial archive in quarantine.
        if target.exists():
            import shutil
            shutil.rmtree(target)
        raise
if __name__=="__main__":
    try:main()
    except Exception as ex:
        print("P128_BLOCK="+(str(ex) if isinstance(ex,RuntimeError) else type(ex).__name__))
        sys.exit(1)
