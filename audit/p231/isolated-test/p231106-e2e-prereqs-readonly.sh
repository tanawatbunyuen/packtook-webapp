#!/usr/bin/env bash
# P231.106 Read-only preflight; NO credentials generated, NO HTTP invocation.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
FN=p231AppCheckIsolatedProbe
SERVICE=p231appcheckisolatedprobe
EXPECTED_SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
echo 'P231_CHECK=E2E_CREDENTIAL_READINESS_READONLY'
if [ "$(TZ=Asia/Bangkok date +%F)" != '2026-11-26' ];then
 echo 'P231_APPROVED_TEST_DATE=EXPIRED';exit 2
fi
for t in gcloud jq;do
 if ! command -v "$t" >/dev/null 2>&1;then echo 'P231_GATE=BLOCKED_MISSING_TOOL';exit 2;fi
done
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ];then
 echo 'P231_GATE=BLOCKED_PROJECT';exit 2
fi
FUNC="$(gcloud functions describe "$FN" --gen2 --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_FUNCTION=NOT_READABLE';exit 2;fi
STATE="$(printf '%s' "$FUNC" | jq -r '.state//"UNKNOWN"')"
SA="$(printf '%s' "$FUNC" | jq -r '.serviceConfig.serviceAccountEmail//""')"
if [ "$STATE" != ACTIVE ] || [ "$SA" != "$EXPECTED_SA" ];then
 echo 'P231_FUNCTION_GATE=BLOCKED';exit 2
fi
echo 'P231_FUNCTION_ACTIVE_AND_SA=PASS'
RUN="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_SERVICE=NOT_READABLE';exit 2;fi
if [ "$(printf '%s' "$RUN" | jq -r '(.invokerIamDisabled//false)==true or (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"false")=="true"')" = true ];then
 echo 'P231_INVOKER_IAM=DISABLED_BLOCK';exit 2
fi
URL="$(printf '%s' "$RUN" | jq -r '.status.url//.uri//""')"
if [[ ! "$URL" =~ ^https://[A-Za-z0-9.-]+\.run\.app$ ]];then
 echo 'P231_CLOUD_RUN_AUDIENCE=UNEXPECTED';exit 2
fi
echo 'P231_CLOUD_RUN_AUDIENCE=PROVIDER_URL_AVAILABLE_NOT_PRINTED'
POL="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_POLICY=NOT_READABLE';exit 2;fi
PUBLIC="$(printf '%s' "$POL" | jq '[.bindings[]?|.members[]?|select(.=="allUsers" or .=="allAuthenticatedUsers")]|length')"
if [ "$PUBLIC" != 0 ];then echo 'P231_PUBLIC_IAM=BLOCKED';exit 2;fi
echo 'P231_DIRECT_PUBLIC_IAM=ZERO'
echo 'P231_GOOGLE_ID_TOKEN=NOT_MINTED'
echo 'P231_FIREBASE_AUTH_TEST_ID_TOKEN=NOT_VERIFIED'
echo 'P231_VALID_STAGING_APPCHECK_TOKEN=NOT_VERIFIED'
echo 'P231_APP_CHECK_E2E=NOT_PERFORMED'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_CLEANUP=NOT_PERFORMED'
echo 'P231_RELEASE=NO_GO'
