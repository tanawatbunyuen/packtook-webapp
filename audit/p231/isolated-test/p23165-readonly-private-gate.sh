#!/usr/bin/env bash
# Read-only P231.65 private invoker gate. No IAM change or deployment.
set -euo pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
FN=p231AppCheckIsolatedProbe

echo 'P231_CHECK=PRIVATE_TEST_DEPLOYMENT_GATE'
gcloud projects describe "$PROJECT" --format='value(projectId)' |
  grep -Fxq "$PROJECT"
echo 'P231_PROJECT_ACCESS=PASS'

if gcloud iam service-accounts describe "$SA"     --project="$PROJECT" --format='value(email)' >/dev/null 2>&1; then
  echo 'P231_DEDICATED_SA=EXISTS_REVIEW_REQUIRED'
else
  echo 'P231_DEDICATED_SA=NOT_CONFIRMED'
fi

INV=$(gcloud functions list --v2 --project="$PROJECT"   --regions="$REGION" --format='value(name)')
if printf '%s\n' "$INV" | awk -F/ '{print $NF}' | grep -Fxq "$FN"; then
  echo 'P231_FUNCTION_NAME_COLLISION=YES'
  echo 'P231_DEPLOY_GATE=BLOCKED'
else
  echo 'P231_FUNCTION_NAME_COLLISION=NO'
  echo 'P231_DEPLOY_GATE=REQUIRES_IAM_AND_INVOKER_APPROVAL'
fi

echo 'P231_GOOGLE_CLOUD_WRITES=0'
echo 'P231_ISOLATED_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
