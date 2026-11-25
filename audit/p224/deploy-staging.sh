#!/usr/bin/env bash
# P224 dedicated, private staging diagnostic. No CI deployments or IAM writes.
set -euo pipefail
MODE="${1:---preflight}"
[[ "$MODE" == "--preflight" || "$MODE" == "--deploy" ]] || { echo "P224_INVALID_MODE"; exit 2; }
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || { echo "P224_BLOCK_CI_CLOUD_ACCESS"; exit 2; }
[[ "$(gcloud config get-value project 2>/dev/null)" == "packtook-staging" ]] || { echo "P224_BLOCK_WRONG_PROJECT"; exit 2; }
SA="g02-probe-runtime@packtook-staging.iam.gserviceaccount.com"
DB="g02-security-test"
[[ "$(gcloud firestore databases describe --database="$DB" --project=packtook-staging --format='value(name)' 2>/dev/null)" == "projects/packtook-staging/databases/$DB" ]] || { echo "P224_BLOCK_NAMED_DB_MISSING"; exit 2; }
[[ "$(gcloud iam service-accounts describe "$SA" --project=packtook-staging --format='value(email)' 2>/dev/null)" == "$SA" ]] || { echo "P224_BLOCK_RUNTIME_SA_MISSING"; exit 2; }
gcloud projects get-iam-policy packtook-staging --format=json |
G02_SA="$SA" python3 -c '
import json,os,sys
p=json.load(sys.stdin)
member="serviceAccount:"+os.environ["G02_SA"]
wanted="resource.name==\"projects/packtook-staging/databases/g02-security-test\""
bindings=[b for b in p.get("bindings",[]) if member in b.get("members",[])]
if len(bindings)!=1 or bindings[0].get("role")!="roles/datastore.viewer" or bindings[0].get("condition",{}).get("expression")!=wanted:
 print("P224_BLOCK_IAM_CONDITION_MISMATCH")
 sys.exit(2)
print("P224_NAMED_DATABASE_IAM_CONFIG=PASS")
'
if gcloud functions describe g02IamDiagnosticProbe --gen2 --region=asia-southeast1 --project=packtook-staging --format='value(name)' >/dev/null 2>&1; then
 echo "P224_BLOCK_FUNCTION_EXISTS_NO_OVERWRITE"; exit 2
fi
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"
[[ "${GCLOUD_PROJECT:-}" == "demo-packtook-p184" && "${GOOGLE_CLOUD_PROJECT:-}" == "demo-packtook-p184" ]] || { echo "P224_BLOCK_DEMO_LOCAL_BUILD_ENV"; exit 2; }
node audit/p188/build-rc.js
node audit/p189/verify.js
node audit/p224/predeploy.js
node audit/p224/fixtures.js
echo "P224_PREFLIGHT=PASS"
if [[ "$MODE" == "--preflight" ]]; then echo "P224_NO_DEPLOY"; exit 0; fi
[[ "${G02_P224_DEPLOY_EXPLICIT:-}" == "YES" ]] || { echo "P224_BLOCK_DEPLOY_FLAG_MISSING"; exit 2; }
gcloud functions deploy g02IamDiagnosticProbe \
  --gen2 --runtime=nodejs22 --trigger-http \
  --region=asia-southeast1 --project=packtook-staging \
  --source="$HERE/probe" --entry-point=g02IamDiagnosticProbe \
  --service-account="$SA" --no-allow-unauthenticated \
  --max-instances=1 --timeout=15s
echo "P224_DEPLOY_COMMAND_SUCCEEDED=TRUE"
echo "P224_RUNTIME_RESULT=NOT_TESTED G02=NO_GO"
