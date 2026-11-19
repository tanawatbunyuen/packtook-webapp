#!/usr/bin/env bash
# P119 — READ ONLY. Run in an authenticated Google Cloud Shell with access to staging.
# No deploy, no mutation, no secret fetch, no source code download.
set -euo pipefail
PROJECT="packtook-staging"
REGION="asia-southeast1"
for c in gcloud python3; do command -v "$c" >/dev/null || { echo "BLOCK_MISSING_BINARY=$c"; exit 2; }; done
echo "P119_PROJECT=$PROJECT"
echo "P119_REGION=$REGION"
echo "P119_MODE=GCLOUD_FUNCTIONS_READ_ONLY"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
gcloud functions list --v2 --regions="$REGION" --project="$PROJECT" --format=json > "$dir/list.json"
for name in recordingStatus usageStatus; do
  if ! gcloud functions describe "$name" --v2 --region="$REGION" --project="$PROJECT" --format=json > "$dir/$name.json"; then
    echo "P119_$name=NOT_VERIFIED"
    exit 3
  fi
done
python3 - "$dir" "$PROJECT" "$REGION" <<'PY'
import json,sys,pathlib
p=pathlib.Path(sys.argv[1]); project=sys.argv[2]; region=sys.argv[3]
items=json.loads((p/"list.json").read_text())
if not isinstance(items,list): raise SystemExit("BLOCK_UNEXPECTED_INVENTORY_FORMAT")
print("P119_FUNCTIONS_LISTED="+str(len(items)))
for short in ("recordingStatus","usageStatus"):
    fn=json.loads((p/(short+".json")).read_text())
    full=fn.get("name","")
    expected=f"projects/{project}/locations/{region}/functions/{short}"
    if full!=expected:
        print("BLOCK_UNEXPECTED_RESOURCE_ID="+short)
        raise SystemExit(4)
    labels=fn.get("labels") or {}
    build=fn.get("buildConfig") or {}
    state=fn.get("state","UNKNOWN")
    # Selected non-secret metadata only; do not print env, service config or secret refs.
    print(f"P119_FUNCTION={short}")
    print(f"P119_STATE={state}")
    print(f"P119_RUNTIME={build.get('runtime','UNKNOWN')}")
    print(f"P119_ENTRYPOINT={build.get('entryPoint','UNKNOWN')}")
    print(f"P119_FIREBASE_CODEBASE_LABEL={labels.get('firebase-functions-codebase','UNSET')}")
    print(f"P119_UPDATED={fn.get('updateTime','UNKNOWN')}")
    print(f"P119_BUILD_SOURCE_PROVENANCE={'PRESENT' if build.get('source') else 'UNVERIFIED'}")
print("P119_DECISION=EVIDENCE_COLLECTED_REQUIRES_INDEPENDENT_REVIEW")
print("P119_DEPLOYMENTS=0 P119_SECRET_READS=0")
PY
