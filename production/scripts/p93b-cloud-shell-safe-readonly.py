#!/usr/bin/env python3
"""P93 HOTFIX: one Staging current-function Artifact Registry metadata check.

Explicit opt-in; at most five sequential read-only gcloud commands, <=12 s
each, no revision history list, no downloads or writes. Prints progress
markers and redacted evidence. A result only means registry digest
METADATA was readable; NOT image runnable/restorable/known good.
"""
import argparse
import json
import re
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
FUNCTIONS=("recordingStatus","usageStatus")
REVISION=re.compile(r"^[a-z][a-z0-9-]{0,119}$")
DIGEST=re.compile(r"^asia-southeast1-docker\.pkg\.dev/packtook-staging/[a-z0-9_-]+/[a-zA-Z0-9_.-]+(?:/[a-zA-Z0-9_.-]+)*@sha256:([0-9a-fA-F]{64})$")

def cli(args):
    p=subprocess.run(args,text=True,capture_output=True,timeout=12,check=False)
    if p.returncode or len(p.stdout)>100000:
        raise ValueError("P93B_READ_ONLY_QUERY_FAILED")
    return p.stdout.strip()

def image_pin(image):
    if not isinstance(image,str) or len(image)>2048:return None
    m=DIGEST.fullmatch(image)
    if m is None:return None
    segments=image.split("@sha256:",1)[0].split("/",3)[-1].split("/")
    if any(s in (".","..") for s in segments):return None
    return m.group(1).lower()

def function_revision(doc,expected):
    if not isinstance(doc,dict) or doc.get("state")!="ACTIVE" or doc.get("environment")!="GEN_2":
        raise ValueError("P93B_BAD_FUNCTION")
    config=doc.get("serviceConfig")
    if not isinstance(config,dict):raise ValueError("P93B_BAD_FUNCTION_CONFIG")
    service=config.get("service")
    prefix=f"projects/{PROJECT}/locations/{REGION}/services/"
    if not isinstance(service,str) or not service.startswith(prefix):
        raise ValueError("P93B_BAD_SERVICE_SCOPE")
    name=service[len(prefix):]
    if not REVISION.fullmatch(name) or not name.startswith(expected.lower()):
        raise ValueError("P93B_BAD_SERVICE_NAME")
    rev=config.get("revision") or config.get("revisionName")
    if not isinstance(rev,str):raise ValueError("P93B_REVISION_NOT_KNOWN")
    # Exact scoped paths, no traversal or arbitrary Cloud Run service.
    if "/" in rev:
        scoped=f"projects/{PROJECT}/locations/{REGION}/services/{name}/revisions/"
        other=f"projects/{PROJECT}/locations/{REGION}/revisions/"
        if rev.startswith(scoped):rev=rev[len(scoped):]
        elif rev.startswith(other):rev=rev[len(other):]
        else:raise ValueError("P93B_BAD_REVISION_SCOPE")
    if not REVISION.fullmatch(rev) or not rev.startswith(name+"-"):
        raise ValueError("P93B_BAD_REVISION_NAME")
    return name,rev

def revision_image(doc,expected_revision):
    if not isinstance(doc,dict):raise ValueError("P93B_BAD_REVISION")
    metadata=doc.get("metadata") or {}
    if not isinstance(metadata,dict):raise ValueError("P93B_BAD_REVISION_METADATA")
    actual=metadata.get("name") or doc.get("name")
    if not isinstance(actual,str) or actual.rsplit("/",1)[-1]!=expected_revision:
        raise ValueError("P93B_REVISION_MISMATCH")
    spec=doc.get("spec") or {}
    if not isinstance(spec,dict):raise ValueError("P93B_BAD_CONTAINER_SPEC")
    containers=spec.get("containers")
    if not isinstance(containers,list) or len(containers)!=1 or not isinstance(containers[0],dict):
        raise ValueError("P93B_CONTAINER_NOT_VERIFIABLE")
    image=containers[0].get("image")
    if image_pin(image) is None:raise ValueError("P93B_IMAGE_NOT_STAGING_DIGEST")
    return image

def registry_metadata(image,reader):
    digest=image_pin(image)
    if digest is None:raise ValueError("P93B_IMAGE_REF_NOT_PERMITTED")
    raw=reader(["gcloud","artifacts","docker","images","describe",image,
                "--project",PROJECT,"--format=json"])
    doc=json.loads(raw)
    if not isinstance(doc,dict):return False
    summary=doc.get("image_summary") or doc.get("imageSummary")
    if not isinstance(summary,dict):return False
    reported=summary.get("digest")
    return isinstance(reported,str) and reported.lower()=="sha256:"+digest

def inspect(function,reader=cli,progress=lambda msg:None):
    if function not in FUNCTIONS:raise ValueError("P93B_OUT_OF_SCOPE")
    progress("P93B_STEP=VERIFY_ACTIVE_PROJECT")
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P93B_WRONG_ACTIVE_PROJECT")
    progress("P93B_STEP=READ_CURRENT_FUNCTION")
    args=["gcloud","functions","describe",function,"--gen2",
          "--project",PROJECT,"--region",REGION,"--format=json"]
    before=reader(args)
    service,revision=function_revision(json.loads(before),function)
    progress("P93B_STEP=READ_CURRENT_REVISION")
    rev_doc=json.loads(reader(["gcloud","run","revisions","describe",revision,
                               "--project",PROJECT,"--region",REGION,"--format=json"]))
    image=revision_image(rev_doc,revision)
    progress("P93B_STEP=READ_REGISTRY_DIGEST_METADATA")
    valid=registry_metadata(image,reader)
    progress("P93B_STEP=RECHECK_FUNCTION")
    after=reader(args)
    stable=before==after
    return {"function":function,"metadataStable":stable,"digestMetadataMatched":valid}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-current",action="store_true")
    parser.add_argument("--function",choices=FUNCTIONS)
    args=parser.parse_args()
    if not args.inspect_current or not args.function:
        print("P93B_OPT_IN_REQUIRED")
        return 2
    try:
        result=inspect(args.function,progress=lambda s:print(s,flush=True))
        print("P93B_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("FUNCTION="+result["function"])
        print("P93B_FUNCTION_METADATA_STABLE="+("YES" if result["metadataStable"] else "NO"))
        print("P93B_CURRENT_REGISTRY_DIGEST_METADATA_MATCH="+("YES" if result["digestMetadataMatched"] else "NOT_VERIFIABLE"))
        print("P93B_HISTORICAL_IMAGES=NOT_CHECKED")
        print("P93B_KNOWN_GOOD_PRIOR=NOT_VERIFIED")
        print("P93B_ROLLBACK_RESTORABLE=NOT_VERIFIED")
        return 0 if result["metadataStable"] and result["digestMetadataMatched"] else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P93B_CHECK=NOT_VERIFIABLE")
        return 2
    finally:
        print("P93B_CLOUD_WRITES=0")
        print("P93B_TRAFFIC_CHANGES=0")
        print("P93B_DEPLOY=0")
        print("P93B_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
