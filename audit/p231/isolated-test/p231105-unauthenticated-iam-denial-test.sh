#!/usr/bin/env bash
# P231.105 — one controlled anonymous HTTP denial test, staging NEW service only.
# An HTTP request IS made; does not deploy/change IAM/cleanup. Do not log body or URL.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
SERVICE=p231appcheckisolatedprobe
FUNCTION=p231AppCheckIsolatedProbe
EXPECTED_SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
echo 'P231_CHECK=UNAUTHENTICATED_CLOUD_RUN_IAM_DENIAL'
if [ "$(TZ=Asia/Bangkok date +%F)" != '2026-11-26' ]; then
 echo 'P231_GATE=BLOCKED_OUTSIDE_APPROVED_TEST_DAY';exit 2
fi
for tool in gcloud jq curl;do if ! command -v "$tool" >/dev/null 2>&1;then
 echo 'P231_GATE=BLOCKED_MISSING_TOOL';exit 2;fi;done
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ];then
 echo 'P231_GATE=BLOCKED_PROJECT';exit 2;fi

FUNCTION_JSON="$(gcloud functions describe "$FUNCTION" --gen2 --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_FUNCTION_UNREADABLE';exit 2;fi
if [ "$(printf '%s' "$FUNCTION_JSON" | jq -r '.serviceConfig.serviceAccountEmail//""')" != "$EXPECTED_SA" ];then
 echo 'P231_GATE=BLOCKED_WRONG_SA';exit 2;fi
RUN_JSON="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_RUN_SERVICE_UNREADABLE';exit 2;fi
DISABLED="$(printf '%s' "$RUN_JSON" | jq -r '(.invokerIamDisabled//false)==true or (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"false")=="true"')"
if [ "$DISABLED" != false ];then echo 'P231_GATE=BLOCKED_INVOKER_IAM_DISABLED';exit 2;fi
POL="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_POLICY_UNREADABLE';exit 2;fi
PUBLIC="$(printf '%s' "$POL" | jq '[.bindings[]? | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")] | length')"
if [ "$PUBLIC" != 0 ];then echo 'P231_GATE=BLOCKED_PUBLIC_BINDING';exit 2;fi
echo 'P231_PRE_REQUEST_DIRECT_PRIVATE_POLICY=PASS'
# Trust provider-supplied Cloud Run URI, not user input; verify fixed Cloud Run URL shape.
URL="$(printf '%s' "$RUN_JSON" | jq -r '.status.url // .uri // ""')"
if [[ ! "$URL" =~ ^https://[A-Za-z0-9.-]+\.run\.app$ ]];then
 echo 'P231_GATE=BLOCKED_UNEXPECTED_SERVICE_URL';exit 2;fi
# One POST, deliberately WITHOUT Authorization, X-Serverless-Authorization
# or X-Firebase-AppCheck. Never output URL or HTTP response body.
STATUS="$(curl --silent --show-error --max-time 15 --connect-timeout 8 \
 --output /dev/null --write-out '%{http_code}' \
 --request POST --header 'Content-Type: application/json' \
 --data '{"data":{}}' "$URL")"
RC=$?
if [ "$RC" != 0 ];then
 echo 'P231_ANONYMOUS_HTTP=TRANSPORT_FAILURE';exit 2;fi
echo "P231_ANONYMOUS_HTTP_STATUS=$STATUS"
if [ "$STATUS" = 401 ] || [ "$STATUS" = 403 ];then
 echo 'P231_ANONYMOUS_IAM_DENIAL=HTTP_REJECTED'
else
 echo 'P231_ANONYMOUS_IAM_DENIAL=NOT_PROVEN'
 exit 2
fi
echo 'P231_BEARER_TOKENS=NONE_SENT'
echo 'P231_APP_CHECK_E2E=NOT_TESTED'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_CLEANUP=NOT_PERFORMED'
echo 'P231_RELEASE=NO_GO'
