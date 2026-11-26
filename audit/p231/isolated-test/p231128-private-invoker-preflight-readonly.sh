#!/usr/bin/env bash
# P231.128 - staging-only READ-ONLY private invoker and function evidence.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
FUNCTION=p231AppCheckIsolatedProbe
SERVICE=p231appcheckisolatedprobe
SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
echo "P231_CHECK=RUNTIME_E2E_PRIVATE_INVOKER_PREFLIGHT_READONLY"
for x in gcloud jq; do
  if ! command -v "$x" >/dev/null; then echo 'P231_GATE=MISSING_TOOL'; exit 2; fi
done
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ]; then
 echo 'P231_GATE=BLOCKED_NOT_STAGING';exit 2
fi
ACTIVE="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null)"
if [ "$(printf '%s\n' "$ACTIVE" | sed '/^$/d' | wc -l)" -ne 1 ]; then
 echo 'P231_GATE=ACTIVE_OPERATOR_NOT_UNIQUE';exit 2
fi
F="$(gcloud functions describe "$FUNCTION" --gen2 --region="$REGION" --project="$PROJECT" --format=json 2>/dev/null)" || { echo 'P231_FUNCTION=NOT_READABLE';exit 2; }
if [ "$(printf '%s' "$F" | jq -r '.state//""')" != ACTIVE ] || [ "$(printf '%s' "$F" | jq -r '.serviceConfig.serviceAccountEmail//""')" != "$SA" ]; then
 echo 'P231_FUNCTION_ACTIVE_RUNTIME_SA=BLOCKED';exit 2
fi
echo 'P231_FUNCTION_ACTIVE_RUNTIME_SA=PASS'
S="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json 2>/dev/null)" || { echo 'P231_SERVICE=NOT_READABLE';exit 2; }
DISABLED="$(printf '%s' "$S" | jq -r '(.invokerIamDisabled//false)==true or (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"false")=="true"')"
if [ "$DISABLED" = true ]; then echo 'P231_INVOKER_IAM=BLOCKED_DISABLED';exit 2;fi
echo 'P231_INVOKER_IAM=ENABLED'
POLICY="$(gcloud run services get-iam-policy "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json 2>/dev/null)" || { echo 'P231_IAM_POLICY=UNREADABLE';exit 2; }
# jq --arg operator prevents injecting identities into a query; never print identity.
CHECK="$(printf '%s' "$POLICY" | jq --arg operator "user:$ACTIVE" '{
 public: ([.bindings[]? | select(.role=="roles/run.invoker") | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")] | length),
 operator: ([.bindings[]? | select(.role=="roles/run.invoker") | .members[]? | select(.==$operator)] | length)
}')"
PUBLIC="$(printf '%s' "$CHECK" | jq -r '.public')"
OPERATOR="$(printf '%s' "$CHECK" | jq -r '.operator')"
echo "P231_DIRECT_PUBLIC_INVOKER_COUNT=$PUBLIC"
echo "P231_ACTIVE_OPERATOR_INVOKER_COUNT=$OPERATOR"
if [ "$PUBLIC" -ne 0 ] || [ "$OPERATOR" -lt 1 ];then
 echo 'P231_PRIVATE_INVOKER_GATE=BLOCKED';exit 2
fi
echo 'P231_PRIVATE_INVOKER_GATE=PASS_DIRECT_POLICY'
echo 'P231_EFFECTIVE_IAM_DENIAL=PREVIOUS_P231105_HTTP_403_ONLY'
echo 'P231_BROWSER_TOKEN_ISSUANCE=PASS_OPERATOR_REPORTED'
echo 'P231_FIREBASE_AUTH_TEST_USER=NOT_VERIFIED'
echo 'P231_E2E_CREDENTIALS=NOT_GENERATED'
echo 'P231_RUNTIME_E2E=NOT_PERFORMED'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_CLEANUP=NOT_PERFORMED'
echo 'P231_RELEASE=NO_GO'
