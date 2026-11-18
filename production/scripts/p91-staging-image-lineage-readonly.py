#!/usr/bin/env python3
"""P91 Staging-only, strictly read-only revision image lineage inventory.

Counts distinct historical container images and checks whether the *current*
Cloud Function revision name is visible in history. No image identifiers,
revision names, hashes, service identities or user data are printed. Image
lineage is not a source-to-commit mapping or a rollback security attestation.
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
TARGETS=("recordingStatus","usageStatus")
HERE=Path(__file__).resolve().parent
REV=re.compile(r"^[a-z][a-z0-9-]{0,119}$")

def load_p89():
    p=HERE/"p89-staging-revision-history-readonly.py"
    spec=importlib.util.spec_from_file_location("p91_p89",p)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def command(argv):
    p=subprocess.run(argv,text=True,capture_output=True,timeout=35,check=False)
    if p.returncode or len(p.stdout)>250000:raise ValueError("P91_READ_UNAVAILABLE")
    return p.stdout.strip()

def bounded_name(value):
    if not isinstance(value,str) or not value:raise ValueError("P91_REVISION_MISSING")
    if "/" in value:
        prefixes=(f"projects/{PROJECT}/locations/{REGION}/revisions/",
                  f"projects/{PROJECT}/locations/{REGION}/services/")
        if not any(value.startswith(p) for p in prefixes):
            raise ValueError("P91_WRONG_REVISION_SCOPE")
    name=value.rsplit("/",1)[-1]
    if not REV.fullmatch(name):raise ValueError("P91_BAD_REVISION")
    return name

def image_value(item):
    spec=item.get("spec") or {}
    if not isinstance(spec,dict):raise ValueError("P91_BAD_SPEC")
    containers=spec.get("containers")
    if not isinstance(containers,list) or len(containers)!=1:
        raise ValueError("P91_EXPECT_ONE_CONTAINER")
    entry=containers[0]
    if not isinstance(entry,dict):raise ValueError("P91_BAD_CONTAINER")
    value=entry.get("image")
    if not isinstance(value,str) or not value or len(value)>2048:
        raise ValueError("P91_IMAGE_MISSING")
    return value

def summarize(raw,service,current_revision):
    items=json.loads(raw)
    if not isinstance(items,list) or len(items)>1000:raise ValueError("P91_BAD_HISTORY")
    current=bounded_name(current_revision)
    names=set()
    images={}
    current_image=None
    for item in items:
        if not isinstance(item,dict):raise ValueError("P91_BAD_ITEM")
        md=item.get("metadata") or {}
        if not isinstance(md,dict):raise ValueError("P91_BAD_METADATA")
        name=bounded_name(md.get("name") or item.get("name"))
        if not name.startswith(service+"-"):
            raise ValueError("P91_SERVICE_MISMATCH")
        if name in names:raise ValueError("P91_DUPLICATE_REVISION")
        names.add(name)
        img=image_value(item)
        images.setdefault(img,0)
        images[img]+=1
        if name==current:current_image=img
    # Comparison is in RAM only. Never log image reference.
    matching=sum(count for img,count in images.items() if current_image is not None and img==current_image)
    return {"visibleRevisions":len(items),
       "distinctImageReferences":len(images),
       "currentRevisionInHistory":current in names,
       "currentImageReferencePresent":current_image is not None,
       "revisionsSharingCurrentImage":matching,
       "priorKnownGoodImage":"NOT_VERIFIED",
       "sourceToGitCommit":"NOT_VERIFIED",
       "restoreFeasibility":"NOT_VERIFIED"}

def inspect(reader=command):
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P91_WRONG_PROJECT")
    p89=load_p89()
    rows=[]
    for name in TARGETS:
        cmd=["gcloud","functions","describe",name,"--gen2","--project",PROJECT,
             "--region",REGION,"--format=json"]
        before=reader(cmd)
        obj=json.loads(before)
        service=p89.service_name(obj)
        config=obj.get("serviceConfig") or {}
        if not isinstance(config,dict):raise ValueError("P91_BAD_FUNCTION_CONFIG")
        current=config.get("revision") or config.get("revisionName")
        if not current:raise ValueError("P91_CURRENT_REVISION_MISSING")
        raw=reader(["gcloud","run","revisions","list","--service",service,
                    "--project",PROJECT,"--region",REGION,"--format=json"])
        p89.revision_summary(raw,service)  # reuse strict historic syntax checks
        row=summarize(raw,service,current)
        after=reader(cmd)
        row["metadataStable"]=before==after
        row["function"]=name
        rows.append(row)
    return rows

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    args=p.parse_args()
    if not args.inspect:
        print("P91_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        rows=inspect()
        print("P91_PROJECT_GUARD=PASS_STAGING_ONLY")
        for r in rows:
            print("FUNCTION="+r["function"])
            print("  FUNCTION_METADATA_STABLE="+("YES" if r["metadataStable"] else "NO"))
            print("  VISIBLE_REVISIONS="+str(r["visibleRevisions"]))
            print("  DISTINCT_IMAGE_REFERENCES="+str(r["distinctImageReferences"]))
            print("  CURRENT_REVISION_IN_HISTORY="+("YES" if r["currentRevisionInHistory"] else "NO"))
            print("  REVISIONS_SHARING_CURRENT_IMAGE="+str(r["revisionsSharingCurrentImage"]))
            print("  PRIOR_KNOWN_GOOD_IMAGE=NOT_VERIFIED")
            print("  SOURCE_TO_GIT_COMMIT=NOT_VERIFIED")
            print("  ROLLBACK_RESTORABLE=NOT_VERIFIED")
        print("P91_STATUS_GUARD_DRIFT=P80_UNREMEDIATED")
        print("P91_DEPLOY_SELECTOR=NOT_VERIFIED")
        return 0 if all(r["metadataStable"] and r["currentRevisionInHistory"] for r in rows) else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P91_IMAGE_LINEAGE=NOT_VERIFIABLE")
        return 2
    finally:
        print("P91_CLOUD_WRITES=0")
        print("P91_TRAFFIC_CHANGES=0")
        print("P91_DEPLOY=0")
        print("P91_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
