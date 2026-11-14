#!/usr/bin/env python3
"""PACKTOOK Staging-only dry-run by default Cloud Run Job image update guard.
Does not execute jobs, publish images, or access Secret Manager values.
"""
import argparse
import json
import os
import re
import subprocess

PROJECT="packtook-staging"
REGION="asia-southeast1"
JOB="packtook-omise-test-probe"
SA="packtook-omise-test@packtook-staging.iam.gserviceaccount.com"
SECRET="PACKTOOK_OMISE_TEST_SECRET_KEY"
SECRET_FILE="omise-test-secret"
REPO="asia-southeast1-docker.pkg.dev/packtook-staging/packtook-staging-probes/packtook-omise-test-probe"
ORIGINAL="sha256:405fa15b5216bf1c43bc475f7edf9078d97bb61ff71bde0d6e9cf81685e8a606"
def command(argv):
    return subprocess.check_output(argv,text=True,stderr=subprocess.DEVNULL).strip()
def guard_env(env):
    if env.get("RR_STAGING_PROJECT_ID")!=PROJECT: raise ValueError("STAGING_PROJECT_REQUIRED")
    for key in ("GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GCP_PROJECT"):
        if env.get(key) and env[key]!=PROJECT: raise ValueError("PROJECT_MISMATCH")
    if any(env.get(k) for k in ("OMISE_SECRET_KEY","FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID")):
        raise ValueError("UNSAFE_CREDENTIAL_ENVIRONMENT")
def validate_job(job):
    tpl=job["spec"]["template"]["spec"]
    config=tpl["template"]["spec"]
    c=config["containers"]
    if len(c)!=1: raise ValueError("EXPECTED_SINGLE_CONTAINER")
    container=c[0]
    checks=[
      (job.get("metadata",{}).get("name")==JOB,"JOB_ID_MISMATCH"),
      (config.get("serviceAccountName")==SA,"RUNTIME_SA_MISMATCH"),
      (config.get("maxRetries")==0,"JOB_RETRIES_NOT_ZERO"),
      (int(tpl.get("taskCount",-1))==1,"TASK_COUNT_NOT_ONE"),
      (int(tpl.get("parallelism",-1))==1,"PARALLELISM_NOT_ONE"),
      (container.get("image")==REPO+"@"+ORIGINAL,"EXISTING_IMAGE_UNEXPECTED"),
    ]
    for ok,name in checks:
        if not ok: raise ValueError(name)
    env={v.get("name"):v.get("value") for v in container.get("env",[])}
    expected={"RR_STAGING_PROJECT_ID":"packtook-staging","RR_NO_PRODUCTION_WRITES":"true",
        "RR_PUBLIC_SIGNUP_CLOSED":"true","RR_OMISE_TEST_SECRET_FILE":"/run/secrets/omise-test-secret",
        "RR_ENABLE_OMISE_TEST_READ":"I_AUTHORIZE_TEST_ONLY_READS"}
    for k,v in expected.items():
        if env.get(k)!=v: raise ValueError("JOB_ENV_MISMATCH_"+k)
    for k in ("RR_OMISE_TEST_CHARGE_ID","RR_EXPECTED_ACCOUNT_ID","RR_EXPECTED_REQUEST_ID","RR_EXPECTED_AMOUNT_SATANG"):
        if not env.get(k): raise ValueError("MISSING_CHARGE_EXPECTATION_"+k)
    volumes=config.get("volumes",[])
    mounts=container.get("volumeMounts",[])
    if not any(v.get("secret",{}).get("secretName")==SECRET
        and any(i.get("key")=="1" and i.get("path")==SECRET_FILE
          for i in v.get("secret",{}).get("items",[]))
        and any(m.get("name")==v.get("name") and m.get("mountPath")=="/run/secrets"
          for m in mounts)
        for v in volumes):raise ValueError("SECRET_MOUNT_MISMATCH")
    return True

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--new-digest",required=True)
    parser.add_argument("--apply",action="store_true",help="Update staging job image only, never execute")
    args=parser.parse_args()
    guard_env(os.environ)
    if not re.fullmatch(r"sha256:[a-f0-9]{64}",args.new_digest):
        raise SystemExit("INVALID_NEW_DIGEST")
    if args.new_digest==ORIGINAL:raise SystemExit("NEW_DIGEST_EQUALS_OLD")
    if command(["gcloud","config","get-value","project"])!=PROJECT:
        raise SystemExit("ACTIVE_GCLOUD_PROJECT_MISMATCH")
    raw=command(["gcloud","run","jobs","describe",JOB,"--project="+PROJECT,
                 "--region="+REGION,"--format=json"])
    validate_job(json.loads(raw))
    new_image=REPO+"@"+args.new_digest
    # Ensure exact digest is registered as a Staging Artifact Registry image.
    command(["gcloud","artifacts","docker","images","describe",new_image,
             "--project="+PROJECT,"--format=json"])
    print("STAGING_JOB_PRECHECK: PASS")
    print("EXPECTED_OLD_IMAGE_DIGEST:",ORIGINAL)
    print("NEW_IMAGE_DIGEST:",args.new_digest)
    if not args.apply:
        print("STAGING_JOB_UPDATE: DRY_RUN_ONLY")
        print("GCP_WRITES: 0")
        return
    if os.environ.get("RR_CONFIRM_JOB_IMAGE_UPDATE")!="UPDATE_PACKTOOK_STAGING_JOB_IMAGE_ONLY":
        raise SystemExit("EXPLICIT_UPDATE_CONFIRMATION_MISSING")
    subprocess.run(["gcloud","run","jobs","update",JOB,
      "--project="+PROJECT,"--region="+REGION,"--image="+new_image,"--quiet"],check=True)
    print("STAGING_JOB_IMAGE_UPDATED: VERIFY_DESCRIBE")
    print("JOB_EXECUTED: NO")
    print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":
    try:main()
    except (ValueError,KeyError,subprocess.CalledProcessError) as e:
        # Restrict output to type-only to avoid leaking response content.
        raise SystemExit("STAGING_IMAGE_UPDATE_PRECHECK_FAILED: "+type(e).__name__)
