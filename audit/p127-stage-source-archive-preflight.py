#!/usr/bin/env python3
"""P127: inspect deployed build archives locally. Staging-only Cloud reads, no deploy.
Never print source, bucket/object names, archive paths, or secret values.
Archives copied into private temporary files and deleted on exit.
"""
import argparse,hashlib,io,json,os,pathlib,re,stat,subprocess,sys,tempfile,zipfile
PROJECT="packtook-staging"
REGION="asia-southeast1"
NAMES=("recordingStatus","usageStatus","ownerGetCustomerAdjustmentHistory",
       "ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
OWNER=NAMES[2:]
MAX_ARCHIVE=5*1024*1024
MAX_MEMBER=3*1024*1024
MAX_TOTAL=20*1024*1024
def gcloud_json(args):
    p=subprocess.run(["gcloud",*args],capture_output=True,text=True,timeout=45)
    if p.returncode:raise RuntimeError("GCLOUD_READ_FAILED")
    try:return json.loads(p.stdout)
    except json.JSONDecodeError:raise RuntimeError("GCLOUD_JSON_INVALID")
def safe_storage(source):
    store=source.get("storageSource") if isinstance(source,dict) else None
    if not isinstance(store,dict):raise RuntimeError("NON_STORAGE_BUILD_SOURCE")
    bucket,obj=store.get("bucket"),store.get("object")
    if not isinstance(bucket,str) or not re.fullmatch(r"[A-Za-z0-9._-]{3,222}",bucket):
        raise RuntimeError("INVALID_SOURCE_BUCKET")
    if not isinstance(obj,str) or not obj or len(obj)>1024 or any(ord(c)<32 for c in obj):
        raise RuntimeError("INVALID_SOURCE_OBJECT")
    return "gs://"+bucket+"/"+obj
def inspect_zip(b):
    if len(b)>MAX_ARCHIVE:raise RuntimeError("ARCHIVE_TOO_LARGE")
    found=set()
    has_source=False
    total=0
    try:
        with zipfile.ZipFile(io.BytesIO(b)) as z:
            members=z.infolist()
            if len(members)>1000:raise RuntimeError("TOO_MANY_ZIP_ENTRIES")
            for info in members:
                n=info.filename
                p=pathlib.PurePosixPath(n)
                if n.startswith("/") or "\\" in n or ".." in p.parts:
                    raise RuntimeError("UNSAFE_ZIP_PATH")
                if (info.external_attr >> 16) & 0o170000 == stat.S_IFLNK:
                    raise RuntimeError("ZIP_SYMLINK_BLOCKED")
                if info.file_size>MAX_MEMBER:raise RuntimeError("ZIP_ENTRY_TOO_LARGE")
                total+=info.file_size
                if total>MAX_TOTAL:raise RuntimeError("ZIP_TOTAL_TOO_LARGE")
                if info.is_dir() or not n.endswith((".js",".cjs",".mjs",".ts")):
                    continue
                if "node_modules/" in n:continue
                has_source=True
                raw=z.read(info)
                for symbol in OWNER:
                    if symbol.encode() in raw:found.add(symbol)
    except (zipfile.BadZipFile,RuntimeError):
        raise
    return has_source,found
def analyze(files):
    hashes={}
    found={}
    all_ok=True
    print("P127_MODE=ARCHIVE_CONTENT_LOCAL_READONLY")
    print("P127_TARGET_PROJECT="+PROJECT+" P127_REGION="+REGION)
    for name in NAMES:
        p=files.get(name)
        if not p:print("P127_FUNCTION="+name+" RESULT=NO_ARCHIVE");all_ok=False;continue
        try:
            data=pathlib.Path(p).read_bytes()
            digest=hashlib.sha256(data).hexdigest()
            has_source,symbols=inspect_zip(data)
            hashes[name]=digest;found[name]=symbols
            print("P127_FUNCTION="+name+" RESULT=INSPECTED ZIP_SHA256="+digest+
                  " SOURCE_FILES="+("YES" if has_source else "NO")+
                  " OWNER_SYMBOL_COUNT="+str(len(symbols)))
            if not has_source:all_ok=False
        except Exception as e:
            reason=str(e) if isinstance(e,RuntimeError) else type(e).__name__
            print("P127_FUNCTION="+name+" RESULT=BLOCKED REASON="+reason)
            all_ok=False
    owner_hashes=[hashes.get(x) for x in OWNER]
    if all(owner_hashes):
        equal=len(set(owner_hashes))==1
        print("P127_FOUR_OWNER_ARCHIVE_HASHES_EQUAL="+str(equal).upper())
    else:
        print("P127_FOUR_OWNER_ARCHIVE_HASHES_EQUAL=UNVERIFIED")
    union=set().union(*(found.get(x,set()) for x in OWNER))
    for symbol in OWNER:
        print("P127_OWNER_SYMBOL="+symbol+" PRESENT="+str(symbol in union).upper())
    print("P127_ARCHIVES_INSPECTED="+str(len(hashes))+"/6")
    print("P127_SOURCE_COMMIT_PARITY=UNVERIFIED P127_DEPLOY_AUTHORIZED=NO")
    print("P127_CLOUD_WRITES=0 P127_DEPLOYS=0 P127_SECRET_READS=0")
    if not all_ok or len(hashes)!=6:raise SystemExit(1)
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--fixture-dir",help="Offline CI only: six local named ZIP files, no Cloud calls")
    args=parser.parse_args()
    if args.fixture_dir:
        directory=pathlib.Path(args.fixture_dir)
        return analyze({n:directory/(n+".zip") for n in NAMES})
    with tempfile.TemporaryDirectory(prefix="p127-local-") as folder:
        os.chmod(folder,0o700)
        files={}
        for n in NAMES:
            try:
                fn=gcloud_json(["functions","describe",n,"--v2","--project="+PROJECT,
                                "--region="+REGION,"--format=json"])
                if fn.get("name")!="projects/"+PROJECT+"/locations/"+REGION+"/functions/"+n:
                    raise RuntimeError("OUT_OF_SCOPE_FUNCTION")
                url=safe_storage((fn.get("buildConfig") or {}).get("source") or {})
                dest=pathlib.Path(folder)/(n+".zip")
                # Exact build-source GCS object only. No printing source URL or command stderr.
                result=subprocess.run(["gcloud","storage","cp",url,str(dest),
                        "--project="+PROJECT,"--quiet"],capture_output=True,text=True,timeout=90)
                if result.returncode:raise RuntimeError("ARCHIVE_COPY_FAILED")
                files[n]=dest
            except Exception as e:
                reason=str(e) if isinstance(e,RuntimeError) else type(e).__name__
                print("P127_FUNCTION="+n+" RESULT=BLOCKED REASON="+reason)
                raise SystemExit(2)
        analyze(files)
if __name__=="__main__":main()
