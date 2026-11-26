#!/usr/bin/env bash
# P231.94 grant roles/run.invoker to active Cloud Shell USER on the NEW service ONLY.
# No deployment and no project-level binding. Requires exact confirmation.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
SERVICE=p231appcheckisolatedprobe
APPROVAL='APPROVE_P23194_ACTIVE_OPERATOR_SERVICE_INVOKER_ONLY'
MODE="${1:-inspect}"
if [ "$MODE" != inspect ] && [ "$MODE" != apply ];then
 echo 'P231_GATE=BLOCKED_UNKNOWN_MODE';exit 2
fi
echo 'P231_CHECK=NEW_SERVICE_ACTIVE_OPERATOR_INVOKER'

if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ];then
 echo 'P231_GATE=BLOCKED_ACTIVE_PROJECT';exit 2
fi
ACTIVE="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null)"
if [ "$(printf '%s\n' "$ACTIVE" | sed '/^$/d' | wc -l)" -ne 1 ];then
 echo 'P231_GATE=BLOCKED_MULTIPLE_ACTIVE_IDENTITIES';exit 2
fi
# Only normal Google user emails; federated principal forms require separate review.
if [[ ! "$ACTIVE" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || [[ "$ACTIVE" == *.gserviceaccount.com ]];then
 echo 'P231_GATE=BLOCKED_NON_USER_PRINCIPAL';exit 2
fi
echo 'P231_OPERATOR_IDENTITY_TYPE=USER_EMAIL_CONFIRMED_NOT_PRINTED'

# Require the new service and verify its unique runtime identity first.
DETAILS="$(gcloud functions describe p231AppCheckIsolatedProbe --gen2 --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_TEST_FUNCTION_NOT_READABLE';exit 2;fi
if [ "$(printf '%s' "$DETAILS" | jq -r '.serviceConfig.serviceAccountEmail//""')" != 'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com' ];then
 echo 'P231_GATE=BLOCKED_WRONG_RUNTIME_SA';exit 2
fi
SVC_JSON="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_SERVICE_NOT_READABLE';exit 2;fi
if [ "$(printf '%s' "$SVC_JSON" | jq -r '(.invokerIamDisabled//false)==true or (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"false")=="true"')" = true ];then
 echo 'P231_GATE=BLOCKED_IAM_CHECK_DISABLED';exit 2
fi

POLICY="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_IAM_NOT_READABLE';exit 2;fi
PUBLIC="$(printf '%s' "$POLICY" | jq '[.bindings[]?|select(any(.members[]?; .=="allUsers" or .=="allAuthenticatedUsers"))]|length')"
if [ "$PUBLIC" != 0 ];then echo 'P231_GATE=BLOCKED_PUBLIC_IAM';exit 2;fi
echo 'P231_DIRECT_PRIVATE_IAM=PASS'
echo 'P231_INVOKER_TARGET=NEW_SERVICE_ONLY'
if [ "$MODE" = inspect ];then
 echo 'P231_INVOKER_GRANT=NOT_PERFORMED_INSPECT_MODE';exit 0
fi
if [ "${P231_INVOKER_CONFIRM:-}" != "$APPROVAL" ];then
 echo 'P231_GATE=BLOCKED_EXPLICIT_GRANT_CONFIRM';exit 2
fi
gcloud run services add-iam-policy-binding "$SERVICE" \
 --project="$PROJECT" --region="$REGION" \
 --role='roles/run.invoker' --member="user:$ACTIVE" \
 --condition=None --quiet >/dev/null
RC=$?
if [ "$RC" -ne 0 ];then echo 'P231_SERVICE_INVOKER_GRANT=ERROR';exit "$RC";fi
NEW="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GRANT_VERIFY=NOT_READABLE';exit 2;fi
if printf '%s' "$NEW" | jq -e --arg m "user:$ACTIVE" '[.bindings[]? | select(.role=="roles/run.invoker" and .condition==null) | .members[]? | select(.==$m)] | length == 1' >/dev/null;then
 echo 'P231_SERVICE_INVOKER_GRANT=PASS'
else
 echo 'P231_SERVICE_INVOKER_GRANT=UNVERIFIED';exit 2
fi
POST_PUBLIC="$(printf '%s' "$NEW" | jq '[.bindings[]?| .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")]|length')"
echo "P231_POST_GRANT_PUBLIC_MEMBERS=$POST_PUBLIC"
if [ "$POST_PUBLIC" != 0 ];then
 echo 'P231_GATE=FAIL_POST_GRANT_PUBLIC';exit 2
fi
echo 'P231_IAM_SCOPE=NEW_SERVICE_ONLY'
echo 'P231_INVOKE=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
