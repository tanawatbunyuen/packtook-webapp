#!/usr/bin/env python3
"""P90 read-only Staging revision metadata quality inventory.

This does not select a rollback candidate, infer known-good code, or change
traffic. Metadata can be incomplete; only bounded counts are reported.
No service/revision identifiers, image refs, principals, source paths,
environment values, IAM policies or secrets printed.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
TARGETS=("recordingStatus","usageStatus")
HERE=Path(__file__).resolve().parent

def load_p89():
    spec=importlib.util.spec_from_file_location("p90_p89",HERE/"p89-staging-revision-history-readonly.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def read(argv):
    result=subprocess.run(argv,capture_output=True,text=True,check=False,timeout=35)
    if result.returncode or len(result.stdout)>250000:
        raise ValueError("P90_METADATA_QUERY_UNAVAILABLE")
    return result.stdout.strip()

def summarize_revisions(raw,service):
    obj=json.loads(raw)
    if not isinstance(obj,list) or len(obj)>1000:
        raise ValueError("P90_INVALID_HISTORY_RESPONSE")
    total=len(obj)
    ready=0
    timestamped=0
    image_present=0
    for r in obj:
        if not isinstance(r,dict):
            raise ValueError("P90_BAD_REVISION")
        md=r.get("metadata") or {}
        st=r.get("status") or {}
        spec=r.get("spec") or {}
        if not isinstance(md,dict) or not isinstance(st,dict) or not isinstance(spec,dict):
            raise ValueError("P90_BAD_REVISION_SCHEMA")
        name=md.get("name") or r.get("name")
        if not isinstance(name,str) or not name:
            raise ValueError("P90_REVISION_NAME_MISSING")
        suffix=name.rsplit("/",1)[-1]
        if "/" in name and not name.startswith("projects/"+PROJECT+"/locations/"+REGION+"/"):
            raise ValueError("P90_WRONG_RESOURCE_PROJECT")
        if not suffix.startswith(service+"-"):
            raise ValueError("P90_UNEXPECTED_SERVICE_REVISION")
        # Ready status is a historical metadata observation, NOT a
        # health/authorization or rollback guarantee.
        conditions=st.get("conditions") or []
        if not isinstance(conditions,list):raise ValueError("P90_BAD_CONDITIONS")
        if any(isinstance(c,dict) and c.get("type")=="Ready" and
               str(c.get("status")).lower() in ("true","1") for c in conditions):
            ready+=1
        if isinstance(md.get("creationTimestamp"),str) and md["creationTimestamp"]:
            timestamped+=1
        containers=spec.get("containers") or []
        if not isinstance(containers,list):raise ValueError("P90_BAD_CONTAINERS")
        if any(isinstance(c,dict) and isinstance(c.get("image"),str) and c["image"] for c in containers):
            image_present+=1
    return {"count":total,"readyMetadataCount":ready,
            "creationTimePresentCount":timestamped,
            "imageReferencePresentCount":image_present,
            "knownGood":"NOT_VERIFIED","rollbackRestorable":"NOT_VERIFIED"}

def inspect(reader=read):
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P90_WRONG_ACTIVE_PROJECT")
    p89=load_p89()
    rows=[]
    for name in TARGETS:
        describe=["gcloud","functions","describe",name,"--gen2",
                 "--project",PROJECT,"--region",REGION,"--format=json"]
        before=reader(describe)
        service=p89.service_name(json.loads(before))
        revs=reader(["gcloud","run","revisions","list","--service",service,
                     "--project",PROJECT,"--region",REGION,"--format=json"])
        # Validate names/count using the previously reviewed P89 parser.
        previous=p89.revision_summary(revs,service)
        current=summarize_revisions(revs,service)
        if previous["revisionCount"]!=current["count"]:
            raise ValueError("P90_HISTORY_INCONSISTENT")
        after=reader(describe)
        rows.append({"function":name,"state":"STABLE_HISTORY_METADATA_ONLY" if before==after
                     else "FUNCTION_METADATA_CHANGED",
                     **current})
    return rows

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect",action="store_true")
    args=parser.parse_args()
    if not args.inspect:
        print("P90_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        rows=inspect()
        print("P90_PROJECT_GUARD=PASS_STAGING_ONLY")
        for r in rows:
            print("FUNCTION="+r["function"])
            print("  HISTORY_STATE="+r["state"])
            print("  VISIBLE_REVISION_COUNT="+str(r["count"]))
            print("  READY_METADATA_COUNT="+str(r["readyMetadataCount"]))
            print("  CREATION_TIME_PRESENT_COUNT="+str(r["creationTimePresentCount"]))
            print("  IMAGE_REF_PRESENT_COUNT="+str(r["imageReferencePresentCount"]))
            print("  KNOWN_GOOD=NOT_VERIFIED")
            print("  ROLLBACK_RESTORABLE=NOT_VERIFIED")
        print("P90_CANDIDATE_SELECTED=NO")
        print("P90_SOURCE_TO_REVISION_MAPPING=NOT_VERIFIED")
        print("P90_SAFE_DEPLOY_SELECTOR=NOT_VERIFIED")
        ok=all(x["state"]=="STABLE_HISTORY_METADATA_ONLY" for x in rows)
        return 0 if ok else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P90_HISTORY_QUALITY=NOT_VERIFIABLE")
        return 2
    finally:
        print("P90_CLOUD_WRITES=0")
        print("P90_DEPLOY=0")
        print("P90_TRAFFIC_CHANGES=0")
        print("P90_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
