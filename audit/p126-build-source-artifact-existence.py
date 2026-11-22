#!/usr/bin/env python3
"""P126 — staging read-only source artifact existence (metadata only).
No archives downloaded, no secret values, no Cloud writes.
"""
import json,subprocess,sys,re
PROJECT="packtook-staging"
REGION="asia-southeast1"
NAMES=("recordingStatus","usageStatus","ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry")
def cmd(args):
    p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=30)
    if p.returncode!=0:return None
    try:return json.loads(p.stdout)
    except json.JSONDecodeError:return None
def valid_bucket(v):
    return isinstance(v,str) and bool(re.fullmatch(r"[A-Za-z0-9._-]{3,222}",v))
def valid_object(v):
    return isinstance(v,str) and 0<len(v)<=1024 and not any(ord(c)<32 for c in v)
print("P126_MODE=STAGING_READONLY_METADATA_ONLY")
print("P126_PROJECT="+PROJECT+" P126_REGION="+REGION)
available=0; missing=0; other=0
for name in NAMES:
    fn=cmd(["gcloud","functions","describe",name,"--v2","--project="+PROJECT,"--region="+REGION,"--format=json"])
    expected="projects/"+PROJECT+"/locations/"+REGION+"/functions/"+name
    if not isinstance(fn,dict) or fn.get("name")!=expected:
        print("P126_FUNCTION="+name+" SOURCE=FUNCTION_NOT_VERIFIED")
        other+=1;continue
    source=(fn.get("buildConfig") or {}).get("source") or {}
    storage=source.get("storageSource") if isinstance(source,dict) else None
    if not isinstance(storage,dict):
        print("P126_FUNCTION="+name+" SOURCE=NON_STORAGE_OR_UNAVAILABLE")
        other+=1;continue
    bucket=storage.get("bucket");obj=storage.get("object")
    if not valid_bucket(bucket) or not valid_object(obj):
        print("P126_FUNCTION="+name+" SOURCE=INVALID_STORAGE_REFERENCE")
        other+=1;continue
    # URLs/paths and content never printed. Metadata-only object describe.
    filemeta=cmd(["gcloud","storage","objects","describe","gs://"+bucket+"/"+obj,"--project="+PROJECT,"--format=json"])
    if not isinstance(filemeta,dict):
        print("P126_FUNCTION="+name+" SOURCE=NOT_ACCESSIBLE_OR_NOT_FOUND")
        missing+=1;continue
    size=filemeta.get("size")
    if size is None:size=filemeta.get("sizeBytes")
    print("P126_FUNCTION="+name+" SOURCE=METADATA_ACCESSIBLE SIZE_BYTES="+str(size if isinstance(size,(int,str)) else "UNKNOWN"))
    available+=1
print("P126_ACCESSIBLE="+str(available)+" P126_INACCESSIBLE="+str(missing)+" P126_OTHER="+str(other))
print("P126_SOURCE_CONTENT_PARITY=NOT_VERIFIED P126_GIT_SHA_PARITY=NOT_VERIFIED")
print("P126_DECISION=NO_GO_SOURCE_RECOVERY_REVIEW_REQUIRED")
print("P126_WRITES=0 P126_ARCHIVE_DOWNLOADS=0 P126_SECRET_READS=0")
