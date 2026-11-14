#!/usr/bin/env python3
"""Build/publish handoff for authorized PACKTOOK staging ONLY.
Default: plan with zero GCP calls. --publish requires distinct explicit opt-in and gcloud.
Does not create Cloud Run Jobs, execute payments, or modify any production resource.
"""
import argparse, os, pathlib, re, subprocess, sys
PROJECT="packtook-staging"
REGION="asia-southeast1"
REPOSITORY="packtook-staging-probes"
IMAGE_NAME="packtook-omise-test-probe"
def command_output(args):
    return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL).strip()
def plan(sha):
    path=f"{REGION}-docker.pkg.dev/{PROJECT}/{REPOSITORY}/{IMAGE_NAME}:{sha}"
    return path
def main():
    parser=argparse.ArgumentParser(description="Strict staging-only image publishing handoff")
    parser.add_argument("--publish",action="store_true",help="Actually run gcloud builds submit to STAGING Artifact Registry")
    args=parser.parse_args()
    actual=command_output(["git","rev-parse","HEAD"])
    if not re.fullmatch(r"[a-f0-9]{40}",actual):
        raise SystemExit("REF_NOT_COMMIT_SHA")
    if os.environ.get("RR_REVIEWED_COMMIT_SHA")!=actual:
        raise SystemExit("REVIEWED_SHA_MUST_EQUAL_CHECKED_OUT_COMMIT")
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:
        raise SystemExit("WRONG_PROJECT")
    if os.environ.get("GCLOUD_PROJECT",PROJECT)!=PROJECT or os.environ.get("GOOGLE_CLOUD_PROJECT",PROJECT)!=PROJECT:
        raise SystemExit("CLOUD_PROJECT_MISMATCH")
    if any(os.environ.get(k) for k in ("OMISE_SECRET_KEY","FIREBASE_TOKEN","PACKTOOK_PRODUCTION_PROJECT_ID","GOOGLE_APPLICATION_CREDENTIALS")):
        raise SystemExit("UNSAFE_ENVIRONMENT")
    root=pathlib.Path(__file__).resolve().parents[2]
    source=root/"production"/"omise-test-job"
    if not (source/"Dockerfile").is_file() or not (source/"probe.cjs").is_file():
        raise SystemExit("MISSING_APPROVED_BUILD_CONTEXT")
    path=plan(actual)
    print("STAGING_PROJECT:",PROJECT)
    print("STAGING_REGION:",REGION)
    print("STAGING_REPOSITORY:",REPOSITORY)
    print("REVIEWED_SHA:",actual)
    print("IMAGE_REFERENCE:",path)
    if not args.publish:
        print("PUBLISH_DRY_RUN: PASS")
        print("GCP_WRITES: 0")
        return
    if os.environ.get("RR_CONFIRM_STAGING_PUBLISH")!="PUBLISH_TO_PACKTOOK_STAGING_ONLY":
        raise SystemExit("EXPLICIT_PUBLISH_CONFIRMATION_MISSING")
    if command_output(["git","status","--porcelain"]):
        raise SystemExit("DIRTY_WORKTREE_NOT_ALLOWED")
    if command_output(["gcloud","config","get-value","project"])!=PROJECT:
        raise SystemExit("ACTIVE_GCLOUD_PROJECT_MISMATCH")
    if command_output(["gcloud","artifacts","repositories","describe",REPOSITORY,
                       "--project",PROJECT,"--location",REGION,"--format=value(format)"])!="DOCKER":
        raise SystemExit("ARTIFACT_REPOSITORY_NOT_DOCKER")
    subprocess.run(["gcloud","builds","submit",str(source),
      "--project",PROJECT,"--region",REGION,"--tag",path,
      "--default-buckets-behavior=regional-user-owned-bucket","--quiet"],check=True)
    print("STAGING_IMAGE_PUBLISHED: VERIFY_DIGEST_IN_ARTIFACT_REGISTRY")
    print("CLOUD_RUN_JOB_CREATED: NO")
    print("OMISE_PROVIDER_REQUESTS: 0")
    print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":
    main()
