#!/usr/bin/env bash
# P225: operator-only staging, new function only. No IAM modifications or production.
set -euo pipefail
MODE="${1:---preflight}"
[[ "$MODE" == "--preflight" || "$MODE" == "--deploy" ]] || { echo "P225_INVALID_MODE"; exit 2; }
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || { echo "P225_CI_DENIED"; exit 2; }
PROJECT=packtook-staging
REGION=asia-southeast1
FUNCTION=g02SdkRestDiagnosticProbe
SA=g02-probe-runtime@packtook-staging.iam.gserviceaccount.com
DB=g02-security-test
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] || { echo "P225_WRONG_PROJECT"; exit 2; }
[[ "$(gcloud firestore databases describe --database="$DB" --project="$PROJECT" --format='value(name)' 2>/dev/null)" == "projects/$PROJECT/databases/$DB" ]] || { echo "P225_NAMED_DB_NOT_FOUND"; exit 2; }
[[ "$(gcloud iam service-accounts describe "$SA" --project="$PROJECT" --format='value(email)' 2>/dev/null)" == "$SA" ]] || { echo "P225_RUNTIME_SA_NOT_FOUND"; exit 2; }
gcloud projects get-iam-policy "$PROJECT" --format=json |
G02_SA="$SA" python3 -c '
import json,os,sys
p=json.load(sys.stdin); member="serviceAccount:"+os.environ["G02_SA"]
expected="resource.name==\"projects/packtook-staging/databases/g02-security-test\""
b=[x for x in p.get("bindings",[]) if member in x.get("members",[])]
ok=len(b)==1 and b[0].get("role")=="roles/datastore.viewer" and b[0].get("condition",{}).get("expression")==expected
if not ok:
 print("P225_UNEXPECTED_RUNTIME_IAM_BINDINGS");sys.exit(2)
print("P225_CONDITIONAL_VIEWER=PASS")
'
gcloud iam service-accounts get-iam-policy "$SA" --project="$PROJECT" --format=json |
python3 -c '
import json,sys
p=json.load(sys.stdin)
if any(x.get("role")=="roles/iam.serviceAccountTokenCreator" and
 "user:tanawat.bunyuen@gmail.com" in x.get("members",[]) for x in p.get("bindings",[])):
 print("P225_TOKEN_CREATOR_TEMPORARY_BINDING_BLOCK");sys.exit(2)
print("P225_TEMPORARY_TOKEN_CREATOR_ABSENT=PASS")
'
# Never overwrite an existing service. Repeated --deploy requires explicit source review.
if gcloud functions describe "$FUNCTION" --gen2 --region="$REGION" --project="$PROJECT" --format='value(name)' >/dev/null 2>&1; then
 echo "P225_FUNCTION_ALREADY_EXISTS_NO_OVERWRITE"; exit 2
fi
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"
[[ "${GCLOUD_PROJECT:-}" == "demo-packtook-p184" && "${GOOGLE_CLOUD_PROJECT:-}" == "demo-packtook-p184" ]] || {
 echo "P225_LOCAL_SOURCE_PIN_ENV_MISSING"; exit 2;
}
node audit/p188/build-rc.js
node audit/p189/verify.js
node audit/p225/predeploy.js
node audit/p225/fixtures.js
echo "P225_PREFLIGHT=PASS"
if [[ "$MODE" == "--preflight" ]]; then echo "P225_PREFLIGHT_ONLY_NO_DEPLOY"; exit 0; fi
[[ "${G02_P225_DEPLOY_EXPLICIT:-}" == "YES" ]] || { echo "P225_EXPLICIT_DEPLOY_FLAG_MISSING"; exit 2; }
echo "P225_DEPLOYING_NEW_PRIVATE_SDK_REST_PROBE"
gcloud functions deploy "$FUNCTION" \
 --gen2 --runtime=nodejs22 --trigger-http \
 --region="$REGION" --project="$PROJECT" \
 --source="$HERE/probe" --entry-point="$FUNCTION" \
 --service-account="$SA" --no-allow-unauthenticated \
 --max-instances=1 --timeout=30s
echo "P225_DEPLOY_COMMAND_SUCCEEDED=TRUE"
echo "P225_RUNTIME_DIFFERENTIAL=NOT_TESTED"
echo "P225_G02_RELEASE=NO_GO"
