#!/usr/bin/env bash
# P120 CLOUD SHELL STAGING INVENTORY - READ ONLY
# Only gcloud functions list/describe, no secret values, cloud writes, deploy, or service requests.
set -euo pipefail
PROJECT="packtook-staging"
REGION="asia-southeast1"
for c in gcloud python3; do command -v "$c" >/dev/null || { echo "BLOCK_MISSING_TOOL=$c"; exit 2; }; done
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
echo "P120_MODE=READ_ONLY_PROJECT_PINNED"
echo "P120_PROJECT=$PROJECT P120_REGION=$REGION"
gcloud functions list --v2 --regions="$REGION" --project="$PROJECT" --format=json > "$temp/functions.json"
for fn in recordingStatus usageStatus; do
  gcloud functions describe "$fn" --v2 --region="$REGION" --project="$PROJECT" --format=json > "$temp/$fn.json"
done
python3 - "$temp" "$ROOT/functions/index.js" "$PROJECT" "$REGION" <<'PY'
import json,sys,re,pathlib,hashlib
d=pathlib.Path(sys.argv[1]); source=pathlib.Path(sys.argv[2]).read_text()
project=sys.argv[3]; region=sys.argv[4]
items=json.loads((d/"functions.json").read_text())
if not isinstance(items,list): raise SystemExit("BLOCK_UNEXPECTED_LIST_FORMAT")
names=[]
for item in items:
    if not isinstance(item,dict):raise SystemExit("BLOCK_UNEXPECTED_ITEM_FORMAT")
    full=item.get("name","")
    pref=f"projects/{project}/locations/{region}/functions/"
    if not full.startswith(pref): raise SystemExit("BLOCK_OUT_OF_SCOPE_RESOURCE")
    names.append(full[len(pref):])
if len(names)!=len(set(names)):raise SystemExit("BLOCK_DUPLICATE_CLOUD_FUNCTION")
exports=set(re.findall(r'exports\.(\w+)\s*=\s*(?:onCall|onRequest)\(',source))
cloud=set(names)
print(f"P120_CLOUD_FUNCTION_COUNT={len(cloud)}")
print(f"P120_SOURCE_FUNCTION_COUNT={len(exports)}")
print("P120_CLOUD_ONLY_COUNT="+str(len(cloud-exports)))
print("P120_SOURCE_ONLY_COUNT="+str(len(exports-cloud)))
# Show only bounded function names, not customer data or secrets.
for n in sorted(cloud-exports):
    print("P120_CLOUD_ONLY_FUNCTION="+n)
for n in sorted(exports-cloud):
    print("P120_SOURCE_ONLY_FUNCTION="+n)
for n in ("recordingStatus","usageStatus"):
    fn=json.loads((d/(n+".json")).read_text())
    expected=f"projects/{project}/locations/{region}/functions/{n}"
    if fn.get("name")!=expected:raise SystemExit("BLOCK_FUNCTION_ID_MISMATCH")
    labels=fn.get("labels") or {}
    build=fn.get("buildConfig") or {}
    svc=fn.get("serviceConfig") or {}
    # Cloud functions may surface metadata in different shapes. Print presence flags, not source refs.
    ref=build.get("source")
    rev=svc.get("revision") or svc.get("revisionName")
    print("P120_TARGET="+n)
    print("P120_"+n+"_STATE="+str(fn.get("state","UNKNOWN")))
    print("P120_"+n+"_CODEBASE_LABEL="+str(labels.get("firebase-functions-codebase","UNSET")))
    print("P120_"+n+"_BUILD_SOURCE_PRESENT="+("YES" if ref else "NO"))
    print("P120_"+n+"_BUILD_SOURCE_DESCRIPTOR_SHA256="+(hashlib.sha256(json.dumps(ref,sort_keys=True).encode()).hexdigest() if ref else "UNAVAILABLE"))
    print("P120_"+n+"_SERVICE_REVISION_PRESENT="+("YES" if rev else "NO"))
    print("P120_"+n+"_UPDATED="+str(fn.get("updateTime","UNKNOWN")))
print("P120_DECISION=NO_GO_DEPLOY_SOURCE_PROVENANCE_UNVERIFIED")
print("P120_WRITES=0 P120_SECRETS_READ=0")
PY
