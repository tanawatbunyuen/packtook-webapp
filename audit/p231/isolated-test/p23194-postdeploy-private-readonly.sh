#!/usr/bin/env bash
# P231.94 — read-only check after new staging function deployment.
# No invoker permissions, requests, deploy, cleanup, or token values.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
SERVICE=p231appcheckisolatedprobe
FUNCTION=p231AppCheckIsolatedProbe
echo 'P231_CHECK=NEW_STAGING_PROBE_PRIVATE_IAM_POSTDEPLOY'
DETAILS="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_SERVICE=NOT_READABLE';exit 2;fi
echo 'P231_NEW_SERVICE=PRESENT'
printf '%s' "$DETAILS" | jq -r '
 "P231_IAM_DISABLED_ANNOTATION="+(.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"NOT_SET"),
 "P231_IAM_DISABLED_FIELD="+((.invokerIamDisabled//"NOT_SET")|tostring),
 "P231_RUNTIME_SERVICE_ACCOUNT="+(if (.spec.template.spec.serviceAccountName//.template.serviceAccount//"")=="p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com" then "MATCH" else "UNVERIFIED" end)
'
DISABLED="$(printf '%s' "$DETAILS" | jq -r '(.invokerIamDisabled//false)==true or (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"false")=="true"')"
if [ "$DISABLED" = 'true' ];then echo 'P231_PRIVATE_IAM=FAIL_DISABLED';exit 2;fi

POLICY="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_SERVICE_IAM=NOT_READABLE';exit 2;fi
PUBLIC="$(printf '%s' "$POLICY" | jq '[.bindings[]?| select((.role=="roles/run.invoker" or .role=="roles/run.admin") and any(.members[]?; .=="allUsers" or .=="allAuthenticatedUsers"))]|length')"
echo "P231_SERVICE_DIRECT_PUBLIC_IAM_BINDINGS=$PUBLIC"
if [ "$PUBLIC" != 0 ];then echo 'P231_PRIVATE_IAM=FAIL_PUBLIC_BINDING';exit 2;fi
META="$(gcloud functions describe "$FUNCTION" --gen2 --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_FUNCTION_METADATA=NOT_READABLE';exit 2;fi
printf '%s' "$META" | jq -r '"P231_FUNCTION_STATE="+(.state//"UNKNOWN"),"P231_FUNCTION_SERVICE_ACCOUNT="+(if (.serviceConfig.serviceAccountEmail//"")=="p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com" then "MATCH" else "MISMATCH" end),"P231_FUNCTION_REVISION_PRESENT="+(if (.serviceConfig.revision//"")!="" then "YES" else "NO" end)'
if [ "$(printf '%s' "$META" | jq -r '.serviceConfig.serviceAccountEmail//""')" != 'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com' ]; then
 echo 'P231_PRIVATE_IAM=BLOCKED_WRONG_RUNTIME_SA';exit 2
fi
echo 'P231_PRIVATE_IAM=DIRECT_POLICY_PASS_INHERITED_NOT_VERIFIED'
echo 'P231_INVOKER_BINDING=NOT_PERFORMED_BY_THIS_SCRIPT'
echo 'P231_E2E_INVOCATION=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
