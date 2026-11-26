#!/usr/bin/env bash
# P231.130: read-only gate check. No tokens, no invocation, no changes.
set -euo pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
FUNCTION=p231AppCheckIsolatedProbe
SERVICE=p231appcheckisolatedprobe
EXPECTED_SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
echo "P231_CHECK=SYNTHETIC_ACCOUNT_RUNTIME_READINESS_READONLY"

for required in gcloud jq; do
 if ! command -v "$required" >/dev/null; then
   echo "P231_GATE=MISSING_TOOL"; exit 2
 fi
done
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ]; then
 echo "P231_GATE=BLOCKED_NOT_STAGING"; exit 2
fi
ACTIVE="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null)"
if [ "$(printf '%s\n' "$ACTIVE" | grep -cve '^$')" -ne 1 ]; then
 echo "P231_GATE=BLOCKED_ACTIVE_OPERATOR_NOT_UNIQUE"; exit 2
fi
FUNCTION_JSON="$(gcloud functions describe "$FUNCTION" --gen2 --region="$REGION" --project="$PROJECT" --format=json 2>/dev/null)" || { echo 'P231_FUNCTION=UNREADABLE'; exit 2; }
if [ "$(printf '%s' "$FUNCTION_JSON" | jq -r '.state//""')" != ACTIVE ] || [ "$(printf '%s' "$FUNCTION_JSON" | jq -r '.serviceConfig.serviceAccountEmail//""')" != "$EXPECTED_SA" ]; then
 echo "P231_FUNCTION_RUNTIME=BLOCKED"; exit 2
fi
echo 'P231_FUNCTION_RUNTIME=ACTIVE_EXPECTED_SA'
SERVICE_JSON="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json 2>/dev/null)" || { echo 'P231_SERVICE=UNREADABLE'; exit 2; }
DISABLED="$(printf '%s' "$SERVICE_JSON" | jq -r '(.invokerIamDisabled//false)==true or (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"false")=="true"')"
if [ "$DISABLED" = true ]; then
 echo 'P231_CLOUD_RUN_IAM=BLOCKED_DISABLED'; exit 2
fi
echo 'P231_CLOUD_RUN_IAM=ENABLED'
POLICY="$(gcloud run services get-iam-policy "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json 2>/dev/null)" || { echo 'P231_POLICY=UNREADABLE';exit 2; }
COUNTS="$(printf '%s' "$POLICY" | jq --arg operator "user:$ACTIVE" '{
 public: ([.bindings[]? | select(.role=="roles/run.invoker") | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")] | length),
 operator: ([.bindings[]? | select(.role=="roles/run.invoker") | .members[]? | select(.==$operator)] | length)
}')"
PUBLIC="$(printf '%s' "$COUNTS" | jq -r '.public')"
OPERATOR="$(printf '%s' "$COUNTS" | jq -r '.operator')"
echo "P231_DIRECT_PUBLIC_INVOKER_COUNT=$PUBLIC"
echo "P231_ACTIVE_OPERATOR_INVOKER_COUNT=$OPERATOR"
if [ "$PUBLIC" -ne 0 ] || [ "$OPERATOR" -lt 1 ]; then
 echo 'P231_PRIVATE_INVOKER_GATE=BLOCKED'; exit 2
fi
REV="$(printf '%s' "$SERVICE_JSON" | jq -r '.status.latestReadyRevisionName//.status.latestCreatedRevisionName//""')"
echo "P231_SERVICE_READY_REVISION_PRESENT=$([ -n "$REV" ] && echo YES || echo NO)"
if [ -z "$REV" ]; then
 echo 'P231_REVISION_GATE=BLOCKED'; exit 2
fi
echo 'P231_PRIVATE_INVOKER_GATE=PASS_DIRECT_POLICY'
echo 'P231_SYNTHETIC_STAGING_ACCOUNT=OWNER_CONFIRMED'
echo 'P231_FIREBASE_AUTH_EMAIL_VERIFIED=PASS_PREVIOUS_BROWSER_OBSERVATION'
echo 'P231_APPCHECK_BROWSER_TOKEN_ISSUANCE=PASS_PREVIOUS_BROWSER_OBSERVATION'
echo 'P231_E2E_CREDENTIALS=NOT_GENERATED'
echo 'P231_RUNTIME_APP_CHECK_E2E=NOT_PERFORMED'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_CLEANUP=NOT_PERFORMED'
echo 'P231_RELEASE=NO_GO'
