#!/usr/bin/env bash
# P231.100: narrowly scoped Cloud Run PUBLIC IAM remediation.
# Default inspect mode is READ ONLY. "apply" requires new explicit approval.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
FUNCTION=p231AppCheckIsolatedProbe
SERVICE=p231appcheckisolatedprobe
SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
CONFIRM='APPROVE_P231100_REMOVE_ALLUSERS_RUN_INVOKER_FROM_NEW_SERVICE_ONLY'
MODE="${1:-inspect}"
echo 'P231_CHECK=GUARDED_NEW_SERVICE_PUBLIC_INVOKER_REMEDIATION'
echo "P231_MODE=$MODE"
if [ "$MODE" != inspect ] && [ "$MODE" != apply ];then echo 'P231_GATE=BLOCKED_MODE';exit 2;fi
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ];then echo 'P231_GATE=BLOCKED_PROJECT';exit 2;fi
for cmd in jq gcloud;do
 if ! command -v "$cmd" >/dev/null 2>&1;then echo 'P231_GATE=BLOCKED_DEPENDENCY';exit 2;fi
done
FN="$(gcloud functions describe "$FUNCTION" --gen2 --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_FUNCTION_NOT_READABLE';exit 2;fi
if [ "$(printf '%s' "$FN" | jq -r '.serviceConfig.serviceAccountEmail//""')" != "$SA" ];then echo 'P231_GATE=BLOCKED_WRONG_RUNTIME_SA';exit 2;fi
echo 'P231_FUNCTION_RUNTIME_SA=MATCH'
SVC_JSON="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_SERVICE_NOT_READABLE';exit 2;fi
# A service URL/ref can be recorded without printing it; compare the Cloud Function's configured service.
LINKED="$(printf '%s' "$FN" | jq -r '.serviceConfig.service//""')"
if [ -n "$LINKED" ] && [ "${LINKED##*/}" != "$SERVICE" ];then
 echo 'P231_GATE=BLOCKED_FUNCTION_SERVICE_MISMATCH';exit 2
fi
POL="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_GATE=BLOCKED_POLICY_NOT_READABLE';exit 2;fi
COUNT="$(printf '%s' "$POL" | jq '[.bindings[]? | select(.role=="roles/run.invoker" and .condition==null) | .members[]? | select(.=="allUsers")] | length')"
OTHER_PUBLIC="$(printf '%s' "$POL" | jq '[.bindings[]? | . as $b | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers") | select( $b.role!="roles/run.invoker" or $b.condition!=null or .!="allUsers") ]|length')"
echo "P231_TARGET_BINDING_COUNT=$COUNT"
echo "P231_OTHER_PUBLIC_BINDINGS=$OTHER_PUBLIC"
if [ "$COUNT" != 1 ] || [ "$OTHER_PUBLIC" != 0 ];then echo 'P231_GATE=BLOCKED_UNEXPECTED_PUBLIC_POLICY';exit 2;fi
echo 'P231_TARGET_SCOPE=NEW_SERVICE_UNCONDITIONAL_ALLUSERS_RUN_INVOKER_ONLY'
if [ "$MODE" = inspect ];then
 echo 'P231_IAM_CHANGE=NOT_PERFORMED'
 echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
 echo 'P231_RELEASE=NO_GO'
 exit 0
fi
if [ "${P231100_IAM_REPAIR_CONFIRM:-}" != "$CONFIRM" ];then echo 'P231_GATE=BLOCKED_EXPLICIT_APPROVAL';exit 2;fi
echo 'P231_ACTION=REMOVE_ONE_UNCONDITIONAL_PUBLIC_INVOKER_BINDING'
if ! gcloud run services remove-iam-policy-binding "$SERVICE" \
 --project="$PROJECT" --region="$REGION" \
 --role=roles/run.invoker --member=allUsers --condition=None --quiet >/dev/null;then
 echo 'P231_IAM_REPAIR=FAILED_RECHECK_REQUIRED';exit 2
fi
NEW="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_POST_REPAIR_POLICY=NOT_READABLE';exit 2;fi
REMAIN="$(printf '%s' "$NEW" | jq '[.bindings[]? | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")]|length')"
echo "P231_POST_REPAIR_DIRECT_PUBLIC_MEMBERS=$REMAIN"
if [ "$REMAIN" != 0 ];then echo 'P231_IAM_REPAIR=INCOMPLETE';exit 2;fi
echo 'P231_IAM_REPAIR=DIRECT_SERVICE_PUBLIC_BINDING_REMOVED'
echo 'P231_INHERITED_IAM=NOT_VERIFIED'
echo 'P231_INVOKER_GRANT=NOT_PERFORMED'
echo 'P231_E2E=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
