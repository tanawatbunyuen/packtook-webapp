#!/usr/bin/env python3
"""P94 read-only independent Artifact Registry package-version metadata probe.

Follows P93D's CURRENT Staging status revision metadata and compares
the image 404 against the independent Artifact Registry versions describe
interface for that specific package and sha256 digest. Never lists images,
downloads layers, reads credentials, changes IAM or deploys. All raw resource
names, digests, user data and CLI errors are suppressed.
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
HERE=Path(__file__).resolve().parent
PACKAGE=re.compile(r"^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$")

@lru_cache(maxsize=1)
def load_p93c():
    s=importlib.util.spec_from_file_location("p94_p93c",HERE/"p93c-registry-failure-readonly.py")
    m=importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m

def parse_image(image,p93b):
    digest=p93b.image_pin(image)
    if digest is None:raise ValueError("P94_IMAGE_NOT_ALLOWED")
    prefix=REGION+"-docker.pkg.dev/"+PROJECT+"/"
    if not image.startswith(prefix):raise ValueError("P94_WRONG_IMAGE_LOCATION")
    remainder=image[len(prefix):].split("@sha256:",1)[0]
    parts=remainder.split("/",1)
    if len(parts)!=2:raise ValueError("P94_MISSING_PACKAGE")
    repo,package=parts
    if not re.fullmatch(r"[a-z][a-z0-9_-]{0,62}",repo) or not PACKAGE.fullmatch(package):
        raise ValueError("P94_BAD_PACKAGE")
    if any(segment in (".","..") for segment in package.split("/")):
        raise ValueError("P94_PATH_TRAVERSAL")
    return repo,package,digest

def secondary_version_check(image,read,p93c,p93b):
    repo,package,digest=parse_image(image,p93b)
    try:
        result=read(["gcloud","artifacts","versions","describe","sha256:"+digest,
                     "--package",package,"--repository",repo,
                     "--location",REGION,"--project",PROJECT,"--format=value(name)"])
    except p93c.ReadFailure as err:
        reasons={
            "REGISTRY_ACCESS_DENIED":"VERSION_ACCESS_DENIED",
            "IMAGE_OR_REPOSITORY_NOT_FOUND":"PACKAGE_VERSION_NOT_FOUND_OR_HIDDEN",
            "COMMAND_TIMEOUT":"VERSION_LOOKUP_TIMEOUT",
            "CLI_ARGUMENT_UNSUPPORTED":"VERSION_CLI_ARGUMENT_UNSUPPORTED"}
        return reasons.get(str(err),"VERSION_LOOKUP_UNVERIFIABLE")
    # Metadata format may URL-escape : in resource id. Keep checks conservative.
    text=result.strip()
    prefix=f"projects/{PROJECT}/locations/{REGION}/repositories/{repo}/packages/"
    if not text.startswith(prefix):return "VERSION_RESOURCE_NOT_VERIFIABLE"
    if "/versions/" not in text:return "VERSION_RESOURCE_NOT_VERIFIABLE"
    if text.endswith("sha256:"+digest) or text.endswith("sha256%3A"+digest):
        return "PACKAGE_VERSION_METADATA_MATCHED_ONLY"
    return "VERSION_RESOURCE_NOT_VERIFIABLE"

def inspect(function,read=None,progress=lambda _:None):
    p93c=load_p93c()
    p93b=p93c.load_p93b()
    reader=read or p93c.read
    images=[]
    def tracked(args):
        if args[:5]==["gcloud","artifacts","docker","images","describe"]:
            images.append(args[5])
        return reader(args)
    report=p93c.inspect(function,reader=tracked,progress=progress)
    secondary="NOT_RUN"
    if report["result"]=="IMAGE_OR_REPOSITORY_NOT_FOUND":
        if len(images)!=1:raise ValueError("P94_IMAGE_CAPTURE_MISSING")
        progress("P94_STEP=INDEPENDENT_VERSION_METADATA")
        secondary=secondary_version_check(images[0],reader,p93c,p93b)
    images.clear()
    return {"function":function,"stable":report["stable"],
            "original":report["result"],"secondary":secondary}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-current",action="store_true")
    parser.add_argument("--function",choices=("recordingStatus","usageStatus"))
    args=parser.parse_args()
    if not args.inspect_current or not args.function:
        print("P94_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        r=inspect(args.function,progress=lambda s:print(s,flush=True))
        print("P94_PROJECT_GUARD=PASS_STAGING_ONLY")
        print("FUNCTION="+r["function"])
        print("P94_FUNCTION_METADATA_STABLE="+("YES" if r["stable"] else "NO"))
        print("P94_DOCKER_DESCRIBE="+r["original"])
        print("P94_VERSION_LOOKUP="+r["secondary"])
        print("P94_IMAGE_PULLABILITY=NOT_VERIFIED")
        print("P94_KNOWN_GOOD=NOT_SELECTED")
        print("P94_RESTORE_TEST=NOT_PERFORMED")
        return 0 if r["stable"] and (r["original"]=="DIGEST_METADATA_MATCHED_ONLY" or
               r["secondary"]=="PACKAGE_VERSION_METADATA_MATCHED_ONLY") else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired):
        print("P94_REGISTRY_PROVENANCE=NOT_VERIFIABLE")
        return 2
    finally:
        print("P94_CLOUD_WRITES=0")
        print("P94_IAM_CHANGES=0")
        print("P94_DEPLOY=0")
        print("P94_TRAFFIC_CHANGES=0")
        print("P94_RELEASE=NO_GO_RELEASE")
if __name__=="__main__":
    sys.exit(main())
