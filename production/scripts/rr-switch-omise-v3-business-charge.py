#!/usr/bin/env python3
"""Staging-only guarded Omise V3 switch: old 299 test charge -> 1290 test charge.
Read-only provider verification. Default dry-run. Explicit --apply updates exactly
four Cloud Run Job expectation environment variables; NEVER executes the Job.
"""
import argparse
import base64
import json
import os
import re
import subprocess
import urllib.error
import urllib.request

PROJECT="packtook-staging"
REGION="asia-southeast1"
JOB="packtook-omise-test-probe"
SA="packtook-omise-test@packtook-staging.iam.gserviceaccount.com"
SECRET="PACKTOOK_OMISE_TEST_SECRET_KEY"
SECRET_FILE="omise-test-secret"
DIGEST="sha256:1fbbf58ed4e89eea63694300a328bbde3b0187ac49042295b13239f9bf6b10b1"
IMAGE="asia-southeast1-docker.pkg.dev/packtook-staging/packtook-staging-probes/packtook-omise-test-probe@"+DIGEST
OLD_ID="chrg_test_69jkgjiaft9zvl2pzst"
NEW_ID="chrg_test_69iy4us7mfk2o5p2qfu"
OLD_AMOUNT="29900"
NEW_AMOUNT="129000"
TOKEN=re.compile(r"^[A-Za-z0-9_-]{6,128}$")

def command(args):
    return subprocess.check_output(args,stderr=subprocess.DEVNULL)

def parse_job(raw):
    job=json.loads(raw)
    assert job["metadata"]["name"]==JOB, "JOB_NAME_MISMATCH"
    task=job["spec"]["template"]["spec"]
    cfg=task["template"]["spec"]
    assert int(task.get("taskCount",0))==1, "TASK_COUNT_MISMATCH"
    assert int(task.get("parallelism",0))==1, "PARALLELISM_MISMATCH"
    assert cfg.get("maxRetries")==0, "RETRIES_MISMATCH"
    assert cfg.get("serviceAccountName")==SA, "SERVICE_ACCOUNT_MISMATCH"
    assert len(cfg["containers"])==1, "CONTAINER_COUNT_MISMATCH"
    c=cfg["containers"][0]
    assert c["image"]==IMAGE, "IMAGE_DIGEST_MISMATCH"
    env={x["name"]:x.get("value") for x in c.get("env",[])}
    expected={
        "RR_STAGING_PROJECT_ID":PROJECT,
        "RR_NO_PRODUCTION_WRITES":"true",
        "RR_PUBLIC_SIGNUP_CLOSED":"true",
        "RR_OMISE_TEST_SECRET_FILE":"/run/secrets/omise-test-secret",
        "RR_ENABLE_OMISE_TEST_READ":"I_AUTHORIZE_TEST_ONLY_READS",
        "RR_OMISE_TEST_CHARGE_ID":OLD_ID,
        "RR_EXPECTED_AMOUNT_SATANG":OLD_AMOUNT,
    }
    for k,v in expected.items():
        assert env.get(k)==v, "ENV_GUARD_MISMATCH_"+k
    for k in ("RR_EXPECTED_ACCOUNT_ID","RR_EXPECTED_REQUEST_ID"):
        assert env.get(k) and TOKEN.fullmatch(env[k]), "OLD_METADATA_MISSING_"+k
    volumes=cfg.get("volumes",[])
    mounts=c.get("volumeMounts",[])
    assert any(
        v.get("secret",{}).get("secretName")==SECRET and
        any(i.get("key")=="1" and i.get("path")==SECRET_FILE
            for i in v.get("secret",{}).get("items",[])) and
        any(m.get("name")==v.get("name") and m.get("mountPath")=="/run/secrets"
            for m in mounts)
        for v in volumes), "SECRET_MOUNT_MISMATCH"
    return env

def verify_provider(key, opener=urllib.request.urlopen):
    assert re.fullmatch(r"skey_test_[A-Za-z0-9_]+",key), "TEST_SECRET_REQUIRED"
    auth=base64.b64encode((key+":").encode()).decode()
    req=urllib.request.Request(
        "https://api.omise.co/charges/"+NEW_ID,
        headers={"Authorization":"Basic "+auth,"Accept":"application/json"},
        method="GET")
    with opener(req,timeout=15) as res:
        assert res.status==200, "PROVIDER_HTTP_NOT_200"
        raw=res.read(65537)
    assert len(raw)<=65536, "PROVIDER_RESPONSE_TOO_LARGE"
    data=json.loads(raw)
    assert data.get("id")==NEW_ID, "NEW_CHARGE_ID_MISMATCH"
    assert data.get("livemode") is False, "NOT_TEST_MODE"
    assert str(data.get("currency","")).lower()=="thb", "CURRENCY_MISMATCH"
    assert data.get("amount")==129000, "AMOUNT_MISMATCH"
    assert data.get("paid") is True and data.get("status")=="successful", "NOT_PAID"
    metadata=data.get("metadata") or {}
    uid,request=metadata.get("uid"),metadata.get("requestId")
    assert isinstance(uid,str) and TOKEN.fullmatch(uid), "UID_METADATA_INVALID"
    assert isinstance(request,str) and TOKEN.fullmatch(request), "REQUEST_METADATA_INVALID"
    return uid,request

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--apply",action="store_true",help="explicitly update four env variables; never execute")
    args=parser.parse_args()
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:
        raise ValueError("STAGING_PROJECT_REQUIRED")
    for k in ("GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GCP_PROJECT"):
        if os.environ.get(k) and os.environ[k]!=PROJECT:raise ValueError("PROJECT_MISMATCH")
    for k in ("OMISE_SECRET_KEY","FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID"):
        if os.environ.get(k):raise ValueError("UNSAFE_ENVIRONMENT")
    assert command(["gcloud","config","get-value","project"]).decode().strip()==PROJECT, "GCLOUD_PROJECT_MISMATCH"
    raw=command(["gcloud","run","jobs","describe",JOB,"--project="+PROJECT,"--region="+REGION,"--format=json"])
    parse_job(raw)
    key=command(["gcloud","secrets","versions","access","1","--secret="+SECRET,"--project="+PROJECT]).decode().strip()
    uid,request=verify_provider(key)
    print("STAGING_JOB_PRECHECK: PASS")
    print("REAL_OMISE_TEST_CHARGE_READ: PASS")
    print("NEW_CHARGE_ID_MATCH: PASS")
    print("NEW_AMOUNT_129000_SATANG: PASS")
    print("NEW_METADATA_PRESENT_VALID: PASS")
    print("IMAGE_V3_PINNED: PASS")
    if not args.apply:
        print("JOB_UPDATE: DRY_RUN_ONLY")
        print("JOB_EXECUTED: NO")
        print("PRODUCTION_WRITES: 0")
        return
    if os.environ.get("RR_CONFIRM_STAGING_CHARGE_SWITCH")!="SWITCH_PACKTOOK_STAGING_V3_TEST_CHARGE_ONLY":
        raise ValueError("EXPLICIT_UPDATE_CONFIRMATION_REQUIRED")
    # Fail closed if job mutated between precheck and guarded update.
    assert command(["gcloud","run","jobs","describe",JOB,"--project="+PROJECT,"--region="+REGION,"--format=json"])==raw, "JOB_CHANGED_DURING_PRECHECK"
    values={
        "RR_OMISE_TEST_CHARGE_ID":NEW_ID,
        "RR_EXPECTED_AMOUNT_SATANG":NEW_AMOUNT,
        "RR_EXPECTED_ACCOUNT_ID":uid,
        "RR_EXPECTED_REQUEST_ID":request,
    }
    overrides=",".join(k+"="+v for k,v in values.items())
    subprocess.run(["gcloud","run","jobs","update",JOB,"--project="+PROJECT,
      "--region="+REGION,"--update-env-vars="+overrides,"--quiet"],check=True)
    updated=command(["gcloud","run","jobs","describe",JOB,"--project="+PROJECT,"--region="+REGION,"--format=json"])
    job=json.loads(updated)
    c=job["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]
    env={e["name"]:e.get("value") for e in c.get("env",[])}
    for k,v in values.items():
        assert env.get(k)==v, "POST_UPDATE_ENV_MISMATCH_"+k
    assert c["image"]==IMAGE, "POST_UPDATE_IMAGE_CHANGED"
    print("STAGING_JOB_EXPECTATIONS_UPDATED: PASS")
    print("JOB_EXECUTED: NO")
    print("PRODUCTION_WRITES: 0")
    print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":
    try:main()
    except (AssertionError,ValueError,KeyError,subprocess.CalledProcessError,
            urllib.error.HTTPError,urllib.error.URLError,TimeoutError):
        raise SystemExit("STAGING_CHARGE_SWITCH: FAILED_OR_BLOCKED (no secrets printed)")
