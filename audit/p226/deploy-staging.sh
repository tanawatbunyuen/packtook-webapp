#!/usr/bin/env bash
# P226 operator-only staging: create NEW private diagnostic, no IAM changes.
set -euo pipefail
MODE="${1:---preflight}"
[[ "$MODE" == "--preflight" || "$MODE" == "--deploy" ]] || { echo "P226_INVALID_MODE"; exit 2; }
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || { echo "P226_CI_DENIED"; exit 2; }
PROJECT=packtook-staging
REGION=asia-southeast1
SA=g02-probe-runtime@packtook-staging.iam.gserviceaccount.com
FN=g02RequestShapeProbe
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] || { echo "P226_BLOCK_WRONG_PROJECT"; exit 2; }
[[ "$(gcloud firestore databases describe --database=g02-security-test --project="$PROJECT" --format='value(name)' 2>/dev/null)" == "projects/$PROJECT/databases/g02-security-test" ]] || { echo "P226_BLOCK_MISSING_NAMED_DB"; exit 2; }
[[ "$(gcloud iam service-accounts describe "$SA" --project="$PROJECT" --format='value(email)' 2>/dev/null)" == "$SA" ]] || { echo "P226_BLOCK_MISSING_RUNTIME_IDENTITY"; exit 2; }
gcloud projects get-iam-policy "$PROJECT" --format=json |
G02_RUNTIME_SA="$SA" python3 -c '
import json,os,sys
p=json.load(sys.stdin)
m="serviceAccount:"+os.environ["G02_RUNTIME_SA"]
expected="resource.name==\"projects/packtook-staging/databases/g02-security-test\""
b=[x for x in p.get("bindings",[]) if m in x.get("members",[])]
if len(b)!=1 or b[0].get("role")!="roles/datastore.viewer" or b[0].get("condition",{}).get("expression")!=expected:
 print("P226_BLOCK_UNEXPECTED_PROJECT_IAM");sys.exit(2)
print("P226_CONDITIONAL_VIEWER=PASS")
'
# No overwrite or hidden retries.
if gcloud functions describe "$FN" --gen2 --region="$REGION" --project="$PROJECT" --format='value(name)' >/dev/null 2>&1; then
 echo "P226_BLOCK_EXISTING_FUNCTION"; exit 2
fi
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"
[[ "${GCLOUD_PROJECT:-}" == "demo-packtook-p184" && "${GOOGLE_CLOUD_PROJECT:-}" == "demo-packtook-p184" ]] || { echo "P226_BLOCK_LOCAL_PIN_ENV"; exit 2; }
node audit/p188/build-rc.js
node audit/p189/verify.js
node audit/p226/predeploy.js
node audit/p226/fixtures.js
echo "P226_PREFLIGHT=PASS"
if [[ "$MODE" == "--preflight" ]]; then echo "P226_PREFLIGHT_ONLY_NO_DEPLOY"; exit 0; fi
[[ "${G02_P226_DEPLOY_EXPLICIT:-}" == "YES" ]] || { echo "P226_BLOCK_DEPLOY_FLAG"; exit 2; }
gcloud functions deploy "$FN" \
 --gen2 --runtime=nodejs22 --trigger-http \
 --region="$REGION" --project="$PROJECT" \
 --source="$HERE/probe" --entry-point="$FN" \
 --service-account="$SA" --no-allow-unauthenticated \
 --max-instances=1 --timeout=30s
echo "P226_DEPLOY_SUCCEEDED=TRUE"
echo "P226_RUNTIME_DIAGNOSTIC=NOT_TESTED G02=NO_GO"
