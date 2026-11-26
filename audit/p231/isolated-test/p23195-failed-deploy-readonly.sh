#!/usr/bin/env bash
# P231.95 — read-only recovery after failed deploy.
# Does not deploy, delete or change IAM.
set -u -o pipefail
set +x
PROJECT='packtook-staging'
REGION='asia-southeast1'
FUNC='p231AppCheckIsolatedProbe'
SVC='p231appcheckisolatedprobe'
PREVIEW="${1:-}"
echo "P231_CHECK=FAILED_DEPLOY_RECOVERY_READONLY"
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ]; then
  echo 'P231_ACTIVE_PROJECT=BLOCKED_NOT_STAGING'; exit 2
fi
echo 'P231_ACTIVE_PROJECT=PASS'
LIST="$(gcloud functions list --v2 --project="$PROJECT" --regions="$REGION" --format='value(name)' 2>/dev/null)"
if [ "$?" -ne 0 ]; then
 echo 'P231_FUNCTION_INVENTORY=NOT_READABLE'; exit 2
fi
echo 'P231_FUNCTION_INVENTORY=PASS'
if printf '%s\n' "$LIST" | awk -F/ '{print tolower($NF)}' | grep -Fxq 'p231appcheckisolatedprobe'; then
 echo 'P231_FUNCTION_INVENTORY_MATCH=FOUND'
else
 echo 'P231_FUNCTION_INVENTORY_MATCH=NOT_FOUND'
fi
if gcloud functions describe "$FUNC" --gen2 --project="$PROJECT" --region="$REGION" --format=json >/dev/null 2>&1; then
 echo 'P231_FUNCTION_DESCRIBE=FOUND'
else
 echo 'P231_FUNCTION_DESCRIBE=NOT_FOUND_OR_NOT_READABLE'
fi
if gcloud run services describe "$SVC" --project="$PROJECT" --region="$REGION" --format=json >/dev/null 2>&1; then
 echo 'P231_CLOUD_RUN_SERVICE=FOUND'
else
 echo 'P231_CLOUD_RUN_SERVICE=NOT_FOUND_OR_NOT_READABLE'
fi

if [ -n "$PREVIEW" ] && [ -d "$PREVIEW/p231-function" ]; then
 echo 'P231_PREVIEW_DIRECTORY=FOUND'
 if [ -d "$PREVIEW/p231-function/node_modules/firebase-functions" ]; then
  echo 'P231_PREVIEW_FUNCTIONS_MODULE=FOUND'
 else
  echo 'P231_PREVIEW_FUNCTIONS_MODULE=MISSING'
 fi
 if [ -f "$PREVIEW/p231-function/package-lock.json" ]; then
  echo 'P231_PREVIEW_LOCKFILE=FOUND'
 else
  echo 'P231_PREVIEW_LOCKFILE=MISSING'
 fi
else
 echo 'P231_PREVIEW_DIRECTORY=NOT_FOUND'
fi
echo 'P231_REDEPLOY=BLOCKED_UNTIL_REVIEW'
echo 'P231_GOOGLE_CLOUD_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED_BY_RECOVERY'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
