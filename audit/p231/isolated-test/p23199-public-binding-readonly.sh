#!/usr/bin/env bash
# P231.99 — specific newly created Cloud Run service public binding audit, READ ONLY.
# Prints only public principals/role counts, not email identities or tokens.
set -u -o pipefail
set +x
PROJECT='packtook-staging'
REGION='asia-southeast1'
SERVICE='p231appcheckisolatedprobe'
FUNCTION='p231AppCheckIsolatedProbe'
echo 'P231_CHECK=NEW_SERVICE_PUBLIC_IAM_READONLY'
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ]; then
  echo 'P231_GATE=BLOCKED_PROJECT';exit 2
fi
FN="$(gcloud functions describe "$FUNCTION" --gen2 --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_FUNCTION=NOT_READABLE';exit 2;fi
SA="$(printf '%s' "$FN" | jq -r '.serviceConfig.serviceAccountEmail//""')"
if [ "$SA" != 'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com' ];then
 echo 'P231_GATE=BLOCKED_WRONG_SERVICE_ACCOUNT';exit 2
fi
echo 'P231_RUNTIME_SA=MATCH'
SVC="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_SERVICE=NOT_READABLE';exit 2;fi
echo 'P231_NEW_SERVICE=PRESENT'
printf '%s' "$SVC" | jq -r '
"P231_IAM_DISABLED="+(if (.invokerIamDisabled//false)==true or (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]//"false")=="true" then "YES" else "NO_OR_NOT_SET" end)
'
POL="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_SERVICE_POLICY=NOT_READABLE';exit 2;fi
printf '%s' "$POL" | jq -r '
[.bindings[]? | . as $b | .members[]? |
 select(.=="allUsers" or .=="allAuthenticatedUsers") |
 {role:$b.role,principal:.,conditional:($b.condition!=null)}] |
 ("P231_PUBLIC_BINDING_COUNT="+(length|tostring)),
 (.[] | "P231_PUBLIC_BINDING_ROLE="+.role+" PRINCIPAL="+.principal+" CONDITIONAL="+(.conditional|tostring))
'
echo 'P231_PROJECT_POLICY_INHERITANCE=NOT_CHECKED'
echo 'P231_E2E_INVOCATION=BLOCKED'
echo 'P231_IAM_CHANGES=0'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
