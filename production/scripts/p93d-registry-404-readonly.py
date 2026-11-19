#!/usr/bin/env python3
"""P93D: clarify P93C Registry 404 with one additional read-only repo check.

One status function, current revision only. Reuses P93C's bounded five-read
pipeline; on image 404, makes only ONE extra repository metadata read to
distinguish nonexistent/inaccessible repository from digest-level lookup.
Does not print image URI, digest, repo name, raw errors or credentials.
Never authorizes rollback, IAM edits, registry writes or deployment.
"""
import argparse
from functools import lru_cache
import importlib.util
from pathlib import Path
import re
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
ROOT=Path(__file__).resolve().parent
REPO=re.compile(r"^[a-z][a-z0-9_-]{0,62}$")

@lru_cache(maxsize=1)
def load_p93c():
    spec=importlib.util.spec_from_file_location("p93d_p93c",ROOT/"p93c-registry-failure-readonly.py")
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def repo_name(image,p93b):
    if p93b.image_pin(image) is None:
        raise ValueError("P93D_IMAGE_OUTSIDE_STAGING_ALLOWLIST")
    prefix=f"{REGION}-docker.pkg.dev/{PROJECT}/"
    if not image.startswith(prefix):raise ValueError("P93D_REGISTRY_LOCATION_MISMATCH")
    path=image[len(prefix):]
    repository=path.split("/",1)[0]
    if not REPO.fullmatch(repository):raise ValueError("P93D_BAD_REPOSITORY")
    return repository

def repository_probe(image,reader,p93c,p93b):
    repository=repo_name(image,p93b)
    try:
        value=reader(["gcloud","artifacts","repositories","describe",repository,
                      "--location",REGION,"--project",PROJECT,"--format=value(name)"])
        expected=f"projects/{PROJECT}/locations/{REGION}/repositories/{repository}"
        if value.strip()==expected:return "REPOSITORY_METADATA_VISIBLE_DIGEST_LOOKUP_NOT_FOUND"
        return "REPOSITORY_METADATA_UNVERIFIABLE"
    except p93c.ReadFailure as err:
        if str(err)=="REGISTRY_ACCESS_DENIED":return "REPOSITORY_ACCESS_DENIED"
        if str(err)=="IMAGE_OR_REPOSITORY_NOT_FOUND":return "REPOSITORY_NOT_FOUND_OR_HIDDEN"
        if str(err)=="COMMAND_TIMEOUT":return "REPOSITORY_READ_TIMED_OUT"
        return "REPOSITORY_METADATA_UNVERIFIABLE"

def inspect(function,reader=None,progress=lambda _:None):
    p93c=load_p93c()
    p93b=p93c.load_p93b()
    read=reader or p93c.read
    captured=[]
    def monitored(args):
        if args[:5]==["gcloud","artifacts","docker","images","describe"]:
            captured.append(args[5])
        return read(args)
    result=p93c.inspect(function,reader=monitored,progress=progress)
    category=result["result"]
    repository="NOT_CHECKED"
    if category=="IMAGE_OR_REPOSITORY_NOT_FOUND":
        if len(captured)!=1:raise ValueError("P93D_CAPTURE_INCOMPLETE")
        progress("P93D_STEP=CHECK_REPOSITORY_METADATA")
        repository=repository_probe(captured[0],read,p93c,p93b)
    captured.clear()
    return {"function":function,"stable":result["stable"],"imageLookup":category,
            "repository":repository}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect-current",action="store_true")
    p.add_argument("--function",choices=("recordingStatus","usageStatus"))
    args=p.parse_args()
    if not args.inspect_current or not args.function:
        print("P93D_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        row=inspect(args.function,progress=lambda s:print(s,flush=True))
        print("P93D_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("FUNCTION="+row["function"])
        print("P93D_FUNCTION_METADATA_STABLE="+("YES" if row["stable"] else "NO"))
        print("P93D_IMAGE_LOOKUP="+row["imageLookup"])
        print("P93D_REPOSITORY_EVIDENCE="+row["repository"])
        print("P93D_IMAGE_DELETION=NOT_PROVEN")
        print("P93D_PRIOR_KNOWN_GOOD=NOT_SELECTED")
        print("P93D_ROLLBACK_RESTORABLE=NOT_VERIFIED")
        return 0 if row["stable"] and row["imageLookup"]=="DIGEST_METADATA_MATCHED_ONLY" else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired):
        print("P93D_RESULT=NOT_VERIFIABLE")
        return 2
    finally:
        print("P93D_CLOUD_WRITES=0")
        print("P93D_DEPLOY=0")
        print("P93D_TRAFFIC_CHANGES=0")
        print("P93D_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
