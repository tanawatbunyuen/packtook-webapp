#!/usr/bin/env python3
"""P93 opt-in Staging Artifact Registry historical digest metadata check.

Checks at most 3 latest visible revisions for ONE status function per run,
including the current Function revision. No image downloads, source reads,
writes, registry listing, IAM or traffic changes. Prints aggregate counts
only; never outputs image references, digests, service names or raw errors.
A successful read proves only digest metadata resolvability, NOT that an
image is runnable, secure, restore-able or maps to Git source.
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
FUNCTIONS=("recordingStatus","usageStatus")
MAX_CHECKS=3
ROOT=Path(__file__).resolve().parent
DIGEST_RE=re.compile(r"^asia-southeast1-docker\.pkg\.dev/packtook-staging/[a-z0-9_-]+/[a-zA-Z0-9_.-]+(?:/[a-zA-Z0-9_.-]+)*@sha256:([0-9a-fA-F]{64})$")
ISO_UTC=re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/file)
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

def cli(args):
    p=subprocess.run(args,text=True,capture_output=True,timeout=30,check=False)
    if p.returncode or len(p.stdout)>100000:raise ValueError("P93_READ_UNAVAILABLE")
    return p.stdout.strip()

def image_digest(image):
    if not isinstance(image,str) or len(image)>2048:return None
    m=DIGEST_RE.fullmatch(image)
    if not m:return None
    return m.group(1).lower()

def registry_status(image,read=cli):
    wanted=image_digest(image)
    if wanted is None:return "UNSUPPORTED_LOCATION_OR_REFERENCE"
    try:
        response=read(["gcloud","artifacts","docker","images","describe",image,
                       "--project",PROJECT,"--format=json"])
        obj=json.loads(response)
        if not isinstance(obj,dict):return "REGISTRY_NOT_VERIFIABLE"
        summary=obj.get("image_summary") or obj.get("imageSummary")
        if not isinstance(summary,dict):return "REGISTRY_NOT_VERIFIABLE"
        reported=summary.get("digest")
        if isinstance(reported,str) and reported.lower()=="sha256:"+wanted:
            return "MATCHING_DIGEST_METADATA_READABLE_ONLY"
        return "REGISTRY_NOT_VERIFIABLE"
    except (OSError,ValueError,TypeError,subprocess.TimeoutExpired,json.JSONDecodeError):
        return "REGISTRY_NOT_VERIFIABLE"

def select_revisions(raw,service,current,p91):
    items=json.loads(raw)
    if not isinstance(items,list) or not items or len(items)>1000:
        raise ValueError("P93_INVALID_REVISION_LIST")
    cur=p91.bounded_name(current)
    entries=[]
    names=set()
    for item in items:
        if not isinstance(item,dict):raise ValueError("P93_INVALID_REVISION")
        metadata=item.get("metadata") or {}
        if not isinstance(metadata,dict):raise ValueError("P93_BAD_METADATA")
        n=p91.bounded_name(metadata.get("name") or item.get("name"))
        if not n.startswith(service+"-") or n in names:
            raise ValueError("P93_OUT_OF_SCOPE_OR_DUPLICATE")
        names.add(n)
        stamp=metadata.get("creationTimestamp")
        if not isinstance(stamp,str) or not ISO_UTC.fullmatch(stamp):
            raise ValueError("P93_INVALID_CREATION_TIME")
        image=p91.image_value(item)
        entries.append((stamp,n,image))
    if cur not in names:raise ValueError("P93_CURRENT_REVISION_MISSING")
    # Historical sampling explicitly does NOT select rollback candidates.
    past=sorted((e for e in entries if e[1]!=cur),reverse=True)[:MAX_CHECKS-1]
    current_entry=next(e for e in entries if e[1]==cur)
    return [current_entry]+past

def inspect(function,reader=cli,p91=None):
    if function not in FUNCTIONS:raise ValueError("P93_FUNCTION_OUT_OF_SCOPE")
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P93_WRONG_ACTIVE_PROJECT")
    if p91 is None:p91=load("p93_p91","p91-staging-image-lineage-readonly.py")
    p89=p91.load_p89()
    describe=["gcloud","functions","describe",function,"--gen2",
              "--project",PROJECT,"--region",REGION,"--format=json"]
    before=reader(describe)
    details=json.loads(before)
    service=p89.service_name(details)
    cfg=details.get("serviceConfig") or {}
    if not isinstance(cfg,dict):raise ValueError("P93_INVALID_CONFIG")
    current=cfg.get("revision") or cfg.get("revisionName")
    if not current:raise ValueError("P93_CURRENT_REVISION_UNKNOWN")
    raw=reader(["gcloud","run","revisions","list","--service",service,
                "--project",PROJECT,"--region",REGION,"--format=json"])
    p89.revision_summary(raw,service)
    sampled=select_revisions(raw,service,current,p91)
    statuses=[registry_status(item[2],reader) for item in sampled]
    after=reader(describe)
    return {"function":function,"stable":before==after,
      "sampled":len(sampled),
      "currentMetadataReadable":statuses[0]=="MATCHING_DIGEST_METADATA_READABLE_ONLY",
      "priorChecked":len(statuses)-1,
      "priorMetadataReadable":sum(s=="MATCHING_DIGEST_METADATA_READABLE_ONLY" for s in statuses[1:]),
      "unsupportedReferences":sum(s=="UNSUPPORTED_LOCATION_OR_REFERENCE" for s in statuses),
      "notVerifiable":sum(s=="REGISTRY_NOT_VERIFIABLE" for s in statuses),
      "knownGood":"NOT_SELECTED",
      "restore":"NOT_VERIFIED"}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    p.add_argument("--function",choices=FUNCTIONS)
    args=p.parse_args()
    if not args.inspect or args.function is None:
        print("P93_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        row=inspect(args.function)
        print("P93_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("FUNCTION="+row["function"])
        print("P93_FUNCTION_METADATA_STABLE="+("YES" if row["stable"] else "NO"))
        print("P93_IMAGE_REFERENCES_SAMPLED="+str(row["sampled"]))
        print("P93_CURRENT_DIGEST_METADATA_READABLE="+("YES" if row["currentMetadataReadable"] else "NOT_VERIFIABLE"))
        print("P93_PRIOR_IMAGES_CHECKED="+str(row["priorChecked"]))
        print("P93_PRIOR_DIGEST_METADATA_READABLE="+str(row["priorMetadataReadable"]))
        print("P93_UNSUPPORTED_IMAGE_REFERENCES="+str(row["unsupportedReferences"]))
        print("P93_OTHER_UNVERIFIABLE_REFERENCES="+str(row["notVerifiable"]))
        print("P93_IMAGE_PULLABILITY=NOT_VERIFIED")
        print("P93_KNOWN_GOOD_REVISION=NOT_SELECTED")
        print("P93_ROLLBACK_RESTORABLE=NOT_VERIFIED")
        return 0 if row["stable"] and row["currentMetadataReadable"] and row["unsupportedReferences"]==0 and row["notVerifiable"]==0 else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P93_REGISTRY_METADATA=NOT_VERIFIABLE")
        return 2
    finally:
        print("P93_CLOUD_WRITES=0")
        print("P93_TRAFFIC_CHANGES=0")
        print("P93_DEPLOY=0")
        print("P93_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
