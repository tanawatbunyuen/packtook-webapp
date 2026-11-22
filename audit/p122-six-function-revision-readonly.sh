#!/usr/bin/env bash
# P122 READ ONLY staging-only revision metadata.
set -euo pipefail
PROJECT="packtook-staging"
REGION="asia-southeast1"
command -v gcloud >/dev/null || { echo "P122_BLOCK_GCLOUD_MISSING"; exit 2; }
command -v python3 >/dev/null || { echo "P122_BLOCK_PYTHON_MISSING"; exit 2; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for n in recordingStatus usageStatus ownerGetCustomerAdjustmentHistory ownerGetCustomerManageState ownerGrantVideoCredits ownerUpdateCustomerExpiry; do
  if ! gcloud functions describe "$n" --v2 --project="$PROJECT" --region="$REGION" --format=json > "$tmp/$n.json"; then
    echo "P122_BLOCK_TARGET_NOT_DESCRIBABLE=$n"
    exit 3
  fi
done
python3 - "$tmp" "$PROJECT" "$REGION" <<'PY'
import pathlib,sys,json
d=pathlib.Path(sys.argv[1]);project=sys.argv[2];region=sys.argv[3]
names=["recordingStatus","usageStatus","ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry"]
print(f"P122_MODE=READ_ONLY PROJECT={project} REGION={region}")
for n in names:
    obj=json.loads((d/(n+".json")).read_text())
    expected=f"projects/{project}/locations/{region}/functions/{n}"
    if obj.get("name")!=expected:raise SystemExit("P122_BLOCK_RESOURCE_ID_MISMATCH="+n)
    build=obj.get("buildConfig") or {}
    svc=obj.get("serviceConfig") or {}
    labels=obj.get("labels") or {}
    rev=svc.get("revision") or svc.get("revisionName") or "UNSET"
    if not isinstance(rev,str) or len(rev)>300:raise SystemExit("P122_BLOCK_INVALID_REVISION")
    print("P122_FUNCTION="+n)
    print("P122_STATE="+str(obj.get("state","UNKNOWN")))
    print("P122_ENTRYPOINT="+str(build.get("entryPoint","UNKNOWN")))
    print("P122_CODEBASE_LABEL="+str(labels.get("firebase-functions-codebase","UNSET")))
    print("P122_SERVICE_REVISION="+rev)
    print("P122_UPDATE_TIME="+str(obj.get("updateTime","UNKNOWN")))
print("P122_STATUS=METADATA_COLLECTED_NOT_SOURCE_PARITY")
print("P122_CLOUD_WRITES=0 P122_SECRET_READS=0 P122_DEPLOYS=0")
PY
