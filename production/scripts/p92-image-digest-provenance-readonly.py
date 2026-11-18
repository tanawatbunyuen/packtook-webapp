#!/usr/bin/env python3
"""P92 Staging-only read-only historical image provenance preflight.

Classifies visible Cloud Run revision image references as SHA256 digest-pinned
vs tag/other metadata, without printing image names, digests or revisions.
Never calls Artifact Registry, reads customer data or source bytes, or
attempts rollback. Even digest-pinned metadata is not artifact availability,
code safety, source-to-Git proof, or restorability evidence.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
NAMES=("recordingStatus","usageStatus")
ROOT=Path(__file__).resolve().parent
DIGEST=re.compile(r"^\\S+@sha256:[0-9a-fA-F]{64}$")
MAX_BYTES=250000

def load_previous():
    spec=importlib.util.spec_from_file_location("p92_p91",ROOT/"p91-staging-image-lineage-readonly.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def read(args):
    result=subprocess.run(args,capture_output=True,text=True,check=False,timeout=35)
    if result.returncode or len(result.stdout)>MAX_BYTES:
        raise ValueError("P92_READONLY_METADATA_FAILED")
    return result.stdout.strip()

def classify_images(raw,service,current_revision,helper):
    data=json.loads(raw)
    if not isinstance(data,list) or not data or len(data)>1000:
        raise ValueError("P92_EMPTY_OR_INVALID_HISTORY")
    current=helper.bounded_name(current_revision)
    seen=set()
    unique_digests=set()
    ready_digest=0
    digest_count=0
    mutable_or_other=0
    current_pinned=False
    current_seen=False
    for item in data:
        if not isinstance(item,dict):
            raise ValueError("P92_BAD_REVISION")
        metadata=item.get("metadata") or {}
        if not isinstance(metadata,dict):
            raise ValueError("P92_BAD_METADATA")
        name=helper.bounded_name(metadata.get("name") or item.get("name"))
        if not name.startswith(service+"-") or name in seen:
            raise ValueError("P92_BAD_REVISION_SCOPE_OR_DUPLICATE")
        seen.add(name)
        image=helper.image_value(item)
        is_digest=bool(DIGEST.fullmatch(image))
        if is_digest:
            digest_count+=1
            unique_digests.add(image.rsplit("@",1)[-1].lower())
        else:
            mutable_or_other+=1
        status=item.get("status") or {}
        if not isinstance(status,dict):
            raise ValueError("P92_BAD_STATUS")
        conditions=status.get("conditions") or []
        if not isinstance(conditions,list):
            raise ValueError("P92_BAD_CONDITIONS")
        ready=any(isinstance(c,dict) and c.get("type")=="Ready" and
                  str(c.get("status")).lower() in ("true","1") for c in conditions)
        if ready and is_digest:ready_digest+=1
        if name==current:
            current_seen=True
            current_pinned=is_digest
    return {"visible":len(data),"digestPinned":digest_count,
            "nonDigest":mutable_or_other,"distinctDigestValues":len(unique_digests),
            "readyDigestCount":ready_digest,"currentInHistory":current_seen,
            "currentImageDigestPinned":current_pinned,
            "imageAvailable":"NOT_VERIFIED",
            "knownGoodRevision":"NOT_SELECTED","restorableRollback":"NOT_VERIFIED"}

def inspect(reader=read,helper=None):
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P92_WRONG_ACTIVE_PROJECT")
    if helper is None:helper=load_previous()
    p89=helper.load_p89()
    rows=[]
    for name in NAMES:
        cmd=["gcloud","functions","describe",name,"--gen2",
             "--project",PROJECT,"--region",REGION,"--format=json"]
        before=reader(cmd)
        obj=json.loads(before)
        service=p89.service_name(obj)
        sc=obj.get("serviceConfig")
        if not isinstance(sc,dict):raise ValueError("P92_BAD_CONFIG")
        current=sc.get("revision") or sc.get("revisionName")
        if not current:raise ValueError("P92_CURRENT_REVISION_MISSING")
        raw=reader(["gcloud","run","revisions","list","--service",service,
                    "--project",PROJECT,"--region",REGION,"--format=json"])
        p89.revision_summary(raw,service)
        line=helper.summarize(raw,service,current)
        result=classify_images(raw,service,current,helper)
        if result["visible"]!=line["visibleRevisions"] or (
          result["currentInHistory"]!=line["currentRevisionInHistory"]):
            raise ValueError("P92_LINEAGE_CONTRADICTION")
        after=reader(cmd)
        result["stable"]=before==after
        result["name"]=name
        rows.append(result)
    return rows

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    args=p.parse_args()
    if not args.inspect:
        print("P92_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        rows=inspect()
        print("P92_PROJECT_GUARD=PASS_STAGING_ONLY")
        for r in rows:
            print("FUNCTION="+r["name"])
            print("  METADATA_STABLE="+("YES" if r["stable"] else "NO"))
            print("  VISIBLE_REVISIONS="+str(r["visible"]))
            print("  DIGEST_PINNED_IMAGE_REFERENCES="+str(r["digestPinned"]))
            print("  TAG_OR_OTHER_IMAGE_REFERENCES="+str(r["nonDigest"]))
            print("  DISTINCT_DIGEST_VALUES="+str(r["distinctDigestValues"]))
            print("  READY_DIGEST_METADATA_COUNT="+str(r["readyDigestCount"]))
            print("  CURRENT_REVISION_IN_HISTORY="+("YES" if r["currentInHistory"] else "NO"))
            print("  CURRENT_IMAGE_DIGEST_PINNED="+("YES" if r["currentImageDigestPinned"] else "NO"))
            print("  IMAGE_ACTUALLY_AVAILABLE=NOT_VERIFIED")
            print("  PRIOR_KNOWN_GOOD=NOT_SELECTED")
            print("  ROLLBACK_RESTORABLE=NOT_VERIFIED")
        print("P92_SOURCE_TO_GIT_COMMIT=NOT_VERIFIED")
        print("P92_SAFE_DEPLOY_SELECTOR=NOT_VERIFIED")
        print("P92_GUARD_DRIFT=P80_UNREMEDIATED")
        ok=all(r["stable"] and r["currentInHistory"] for r in rows)
        return 0 if ok else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P92_IMAGE_PROVENANCE=NOT_VERIFIABLE")
        return 2
    finally:
        print("P92_CLOUD_WRITES=0")
        print("P92_TRAFFIC_CHANGES=0")
        print("P92_DEPLOY=0")
        print("P92_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
