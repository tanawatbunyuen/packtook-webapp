#!/usr/bin/env bash
# P223: Cloud Shell operator ONLY. Verifies isolation before a new private function deploy.
# Refuses any production/wrong-project invocation. Never creates IAM bindings.
set -euo pipefail
MODE="${1:---preflight}"
[[ "$MODE" == "--preflight" || "$MODE" == "--deploy" ]] || { echo "P223_INVALID_MODE"; exit 2; }
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || { echo "P223_CI_CLOUD_CALLS_FORBIDDEN"; exit 2; }
PROJECT="packtook-staging"
REGION="asia-southeast1"
SA="g02-probe-runtime@packtook-staging.iam.gserviceaccount.com"
DB="g02-security-test"
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] || { echo "P223_BLOCK_WRONG_PROJECT"; exit 2; }
[[ "$(gcloud firestore databases describe --database="$DB" --project="$PROJECT" --format='value(name)' 2>/dev/null)" == "projects/$PROJECT/databases/$DB" ]] || { echo "P223_BLOCK_TEST_DATABASE_MISSING"; exit 2; }
[[ "$(gcloud iam service-accounts describe "$SA" --project="$PROJECT" --format='value(email)' 2>/dev/null)" == "$SA" ]] || { echo "P223_BLOCK_RUNTIME_SA_MISSING"; exit 2; }
gcloud projects get-iam-policy "$PROJECT" --format=json |
G02_SA="$SA" python3 -c '
import json,os,sys
p=json.load(sys.stdin)
member="serviceAccount:"+os.environ["G02_SA"]
want="resource.name==\"projects/packtook-staging/databases/g02-security-test\""
b=[x for x in p.get("bindings",[]) if member in x.get("members",[])]
ok=len(b)==1 and b[0].get("role")=="roles/datastore.viewer" and b[0].get("condition",{}).get("expression")==want
if not ok: print("P223_BLOCK_UNEXPECTED_PROJECT_IAM_BINDING");sys.exit(2)
print("P223_CONDITIONAL_NAMED_DB_VIEWER=PASS")
'
# Detect temporary direct Token Creator rights if any. Do not grant/impersonate.
gcloud iam service-accounts get-iam-policy "$SA" --project="$PROJECT" --format=json |
python3 -c '
import json,sys
p=json.load(sys.stdin)
if any(x.get("role")=="roles/iam.serviceAccountTokenCreator" and
 "user:tanawat.bunyuen@gmail.com" in x.get("members",[])
 for x in p.get("bindings",[])):
 print("P223_BLOCK_TEMPORARY_TOKEN_CREATOR_REMAINING");sys.exit(2)
print("P223_DIRECT_TEMPORARY_TOKEN_CREATOR=CLEARED")
'
# Fail closed if function already exists: this package does not perform revision upgrades.
if gcloud functions describe g02IamBoundaryProbe --gen2 --region="$REGION" --project="$PROJECT" --format='value(name)' >/dev/null 2>&1; then
 echo "P223_BLOCK_EXISTING_FUNCTION_NEVER_OVERWRITE"; exit 2
fi
cd "$ROOT"
[[ "${GCLOUD_PROJECT:-}" == "demo-packtook-p184" && "${GOOGLE_CLOUD_PROJECT:-}" == "demo-packtook-p184" ]] || { echo "P223_BLOCK_LOCAL_PIN_ENV"; exit 2; }
node audit/p188/build-rc.js
node audit/p189/verify.js
node audit/p223/predeploy.js
node audit/p223/fixtures.js
echo "P223_STAGING_PREFLIGHT=PASS"
if [[ "$MODE" == "--preflight" ]]; then echo "P223_NO_DEPLOY_PREFLIGHT_ONLY"; exit 0; fi
[[ "${G02_P223_DEPLOY_EXPLICIT:-}" == "YES" ]] || { echo "P223_BLOCK_NO_EXPLICIT_DEPLOY_FLAG"; exit 2; }
echo "P223_DEPLOYING_NEW_PRIVATE_READ_ONLY_RUNTIME_BOUNDARY"
gcloud functions deploy g02IamBoundaryProbe \
 --gen2 --runtime=nodejs22 --trigger-http \
 --region="$REGION" --project="$PROJECT" \
 --source="$HERE/probe" --entry-point=g02IamBoundaryProbe \
 --service-account="$SA" --no-allow-unauthenticated \
 --max-instances=1 --timeout=15s
echo "P223_DEPLOY_COMMAND_SUCCEEDED=TRUE"
echo "P223_IAM_RUNTIME_RESULT=NOT_TESTED"
echo "P223_G02_RELEASE=NO_GO"
