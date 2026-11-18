#!/usr/bin/env python3
"""P89 Staging Gen2 Cloud Run revision HISTORY inventory, READ ONLY.

This is an unprivileged operator metadata inventory, not a rollback drill.
Reports only sanitized counts/booleans; never raw revision names, identities,
resource URLs, archive identifiers, dates, environment variables or secrets.
Only runs with explicit --inspect and active packtook-staging. No writes.
"""
import argparse
import json
import re
import subprocess
import sys

PROJECT="packtook-staging"
REGION="asia-southeast1"
TARGETS=("recordingStatus","usageStatus")
SERVICE=re.compile(r"^[a-z][a-z0-9-]{0,62}$")
MAX_BYTES=250000

def call(argv):
    p=subprocess.run(argv,capture_output=True,text=True,timeout=35,check=False)
    if p.returncode or len(p.stdout)>MAX_BYTES:
        raise ValueError("P89_READ_ONLY_METADATA_UNAVAILABLE")
    return p.stdout.strip()

def service_name(info):
    if not isinstance(info,dict) or info.get("state")!="ACTIVE" or info.get("environment")!="GEN_2":
        raise ValueError("P89_UNSUPPORTED_FUNCTION")
    conf=info.get("serviceConfig")
    if not isinstance(conf,dict):raise ValueError("P89_MISSING_SERVICE_CONFIG")
    raw=conf.get("service")
    if not isinstance(raw,str):raise ValueError("P89_SERVICE_NOT_VERIFIABLE")
    prefix=f"projects/{PROJECT}/locations/{REGION}/services/"
    if not raw.startswith(prefix):raise ValueError("P89_WRONG_SERVICE_SCOPE")
    name=raw[len(prefix):]
    if not SERVICE.fullmatch(name):raise ValueError("P89_BAD_SERVICE_NAME")
    return name

def revision_summary(raw,service):
    data=json.loads(raw)
    if not isinstance(data,list) or len(data)>1000:
        raise ValueError("P89_BAD_REVISION_RESPONSE")
    names=set()
    # Cloud Run revision list shape varies; do not assume histories are complete
    for item in data:
        if not isinstance(item,dict):raise ValueError("P89_BAD_REVISION")
        metadata=item.get("metadata") or {}
        if not isinstance(metadata,dict):raise ValueError("P89_BAD_REVISION_METADATA")
        raw_name=metadata.get("name") or item.get("name")
        if not isinstance(raw_name,str) or not raw_name:raise ValueError("P89_REVISION_NAME_UNKNOWN")
        if "/" in raw_name:
            prefixes=(
                f"projects/{PROJECT}/locations/{REGION}/revisions/",
                f"projects/{PROJECT}/locations/{REGION}/services/{service}/revisions/"
            )
            valid_prefix=next((p for p in prefixes if raw_name.startswith(p)),None)
            if valid_prefix is None:raise ValueError("P89_UNTRUSTED_REVISION_PATH")
            last=raw_name[len(valid_prefix):]
        else:
            last=raw_name
        if not re.fullmatch(r"[a-z0-9-]{1,120}",last):
            raise ValueError("P89_INVALID_REVISION_IDENTIFIER")
        if last in names:raise ValueError("P89_DUPLICATE_REVISION")
        names.add(last)
    # The revision list may exclude deleted or expired revisions.
    return {"revisionCount":len(names),
      "multipleVisibleRevisions":len(names)>=2,
      "previousRevisionGood":"NOT_VERIFIED",
      "previousRevisionRestorable":"NOT_VERIFIED",
      "sourceGenerationMapped":"NOT_VERIFIED"}

def inspect(reader=call):
    if reader(["gcloud","config","get-value","project"])!=PROJECT:
        raise ValueError("P89_WRONG_ACTIVE_PROJECT")
    results=[]
    for name in TARGETS:
        raw=reader(["gcloud","functions","describe",name,"--gen2",
                    "--project",PROJECT,"--region",REGION,"--format=json"])
        service=service_name(json.loads(raw))
        revs=reader(["gcloud","run","revisions","list",
                     "--service",service,"--project",PROJECT,
                     "--region",REGION,"--format=json"])
        result=revision_summary(revs,service)
        # Metadata stable across observation of revision list.
        latest=reader(["gcloud","functions","describe",name,"--gen2",
                       "--project",PROJECT,"--region",REGION,"--format=json"])
        if raw!=latest:
            result["state"]="METADATA_CHANGED_REVIEW_REQUIRED"
        else:
            result["state"]="HISTORY_METADATA_ONLY"
        result["name"]=name
        results.append(result)
    return results

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect",action="store_true")
    args=p.parse_args()
    if not args.inspect:
        print("P89_EXPLICIT_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        rows=inspect()
        print("P89_PROJECT_GUARD=PASS_STAGING_ONLY")
        for r in rows:
            print("FUNCTION="+r["name"])
            print("  REVISION_HISTORY="+r["state"])
            print("  VISIBLE_REVISION_COUNT="+str(r["revisionCount"]))
            print("  MULTIPLE_VISIBLE_REVISIONS="+("YES" if r["multipleVisibleRevisions"] else "NO"))
            print("  PRIOR_REVISION_KNOWN_GOOD=NOT_VERIFIED")
            print("  PRIOR_REVISION_RESTORABLE=NOT_VERIFIED")
            print("  PRIOR_SOURCE_GENERATION_MAPPING=NOT_VERIFIED")
        print("P89_ROLLBACK_RESTORABLE=NOT_VERIFIED")
        print("P89_SAFE_DEPLOY_SELECTOR=NOT_VERIFIED")
        print("P89_GUARD_DRIFT=P80_UNREMEDIATED")
        return 0 if all(r["state"]=="HISTORY_METADATA_ONLY" for r in rows) else 2
    except (OSError,ValueError,TypeError,KeyError,subprocess.TimeoutExpired,json.JSONDecodeError):
        print("P89_HISTORY_METADATA=NOT_VERIFIABLE")
        return 2
    finally:
        print("P89_CLOUD_WRITES=0")
        print("P89_DEPLOY=0")
        print("P89_RELEASE=NO_GO_RELEASE")

if __name__=="__main__":
    sys.exit(main())
