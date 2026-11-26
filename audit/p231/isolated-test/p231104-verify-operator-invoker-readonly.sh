#!/usr/bin/env bash
# P231.104: read-only verification after gcloud IAM update succeeded and jq failed.
# NO add-iam-policy-binding, no deployment, no invocation, no cleanup.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
SERVICE=p231appcheckisolatedprobe
FUNCTION=p231AppCheckIsolatedProbe
EXPECTED_SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
echo 'P231_CHECK=POST_GRANT_READONLY_VERIFICATION'
for cmd in jq gcloud; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo 'P231_GATE=BLOCKED_REQUIRED_TOOL'; exit 2
  fi
done
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ]; then
  echo 'P231_GATE=BLOCKED_WRONG_PROJECT'; exit 2
fi
ACTIVE="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null)"
if [ "$(printf '%s\n' "$ACTIVE" | sed '/^$/d' | wc -l)" -ne 1 ]; then
  echo 'P231_GATE=BLOCKED_OPERATOR_AMBIGUOUS'; exit 2
fi
if [[ ! "$ACTIVE" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || [[ "$ACTIVE" == *.gserviceaccount.com ]]; then
  echo 'P231_GATE=BLOCKED_OPERATOR_NOT_USER'; exit 2
fi
FN="$(gcloud functions describe "$FUNCTION" --gen2 --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ]; then echo 'P231_GATE=BLOCKED_FUNCTION_UNREADABLE'; exit 2; fi
if [ "$(printf '%s' "$FN" | jq -r '.serviceConfig.serviceAccountEmail//""')" != "$EXPECTED_SA" ]; then
  echo 'P231_GATE=BLOCKED_WRONG_RUNTIME_SA'; exit 2
fi
echo 'P231_FUNCTION_RUNTIME_SA=MATCH'
RUN="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ]; then echo 'P231_GATE=BLOCKED_SERVICE_UNREADABLE'; exit 2; fi
if [ "$(printf '%s' "$RUN" | jq -r '(.invokerIamDisabled//false)==true or (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"false")=="true"')" = true ]; then
 echo 'P231_GATE=BLOCKED_IAM_CHECK_DISABLED'; exit 2
fi
echo 'P231_IAM_CHECK=NOT_DISABLED_IN_SERVICE_METADATA'
POLICY="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ]; then echo 'P231_GATE=BLOCKED_POLICY_UNREADABLE'; exit 2; fi
if ! printf '%s' "$POLICY" | jq -e '(.bindings // []) | type == "array"' >/dev/null 2>&1; then
  echo 'P231_GATE=BLOCKED_INVALID_POLICY'; exit 2
fi
PUBLIC="$(printf '%s' "$POLICY" | jq '[.bindings[]? | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")] | length')"
COUNT="$(printf '%s' "$POLICY" | jq --arg principal "user:$ACTIVE" '[.bindings[]? | select(.role=="roles/run.invoker" and .condition==null) | .members[]? | select(.==$principal)] | length')"
echo "P231_SERVICE_DIRECT_PUBLIC_MEMBER_COUNT=$PUBLIC"
echo "P231_ACTIVE_OPERATOR_INVOKER_BINDING_COUNT=$COUNT"
echo 'P231_PRIVATE_INVOKER_SCOPE=NEW_SERVICE_ONLY'
echo 'P231_IAM_WRITES=0'
echo 'P231_E2E_INVOCATION=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
if [ "$PUBLIC" != 0 ] || [ "$COUNT" != 1 ]; then
 echo 'P231_POST_GRANT_VERIFICATION=FAIL'; exit 2
fi
echo 'P231_POST_GRANT_VERIFICATION=DIRECT_POLICY_PASS'
echo 'P231_EFFECTIVE_HTTP_DENIAL=NOT_TESTED'
