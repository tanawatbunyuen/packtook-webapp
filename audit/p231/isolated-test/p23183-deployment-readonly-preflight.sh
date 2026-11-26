#!/usr/bin/env bash
# P231.83 -- read-only staging deployment preparation. No deploy, no IAM mutations.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
FN=p231AppCheckIsolatedProbe
SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
echo 'P231_CHECK=STAGING_ISOLATED_DEPLOYMENT_READINESS'
echo "P231_PROJECT=$PROJECT"
echo "P231_TARGET_FUNCTION=$FN"

if ! gcloud projects describe "$PROJECT" --format='value(projectId)' 2>/dev/null | grep -Fxq "$PROJECT"; then
 echo 'P231_PROJECT=BLOCKED'; exit 2
fi
echo 'P231_PROJECT_ACCESS=PASS'

SA_JSON="$(gcloud iam service-accounts describe "$SA" --project="$PROJECT" --format=json 2>/dev/null)" || {
 echo 'P231_RUNTIME_IDENTITY=NOT_READABLE'; exit 2;
}
if printf '%s' "$SA_JSON" | jq -e '.disabled != true' >/dev/null; then
 echo 'P231_RUNTIME_IDENTITY=ENABLED'
else
 echo 'P231_RUNTIME_IDENTITY=DISABLED'; exit 2
fi

IAM_JSON="$(gcloud projects get-iam-policy "$PROJECT" --format=json 2>/dev/null)" || {
 echo 'P231_IAM=NOT_READABLE'; exit 2;
}
if printf '%s' "$IAM_JSON" | jq -e --arg m "serviceAccount:$SA" '
 any(.bindings[]?; .role=="roles/firebaseappcheck.tokenVerifier" and (.members // [] | index($m)) and (.condition==null))
' >/dev/null; then
 echo 'P231_TOKEN_VERIFIER_DIRECT_BINDING=PASS'
else
 echo 'P231_TOKEN_VERIFIER_DIRECT_BINDING=NOT_FOUND'; exit 2
fi

INVENTORY="$(gcloud functions list --v2 --project="$PROJECT" --regions="$REGION" --format='value(name)' 2>/dev/null)" || {
 echo 'P231_FUNCTION_INVENTORY=NOT_READABLE'; exit 2;
}
if printf '%s\n' "$INVENTORY" | awk -F/ '{print $NF}' | grep -Fxq "$FN"; then
 echo 'P231_FUNCTION_NAME_COLLISION=YES'; exit 2
else
 echo 'P231_FUNCTION_NAME_COLLISION=NO'
fi

# Do not print individual principals, tokens, or list of existing services.
for SVC in usagestatus recordingstatus accountrole; do
  if gcloud run services describe "$SVC" --project="$PROJECT" --region="$REGION" --format='value(metadata.name)' >/dev/null 2>&1; then
    echo "P231_EXISTING_SERVICE_${SVC}=PRESENT"
  else
    echo "P231_EXISTING_SERVICE_${SVC}=NOT_READABLE"
  fi
done

echo 'P231_OPERATOR_INVOKER_IDENTITY=NOT_SELECTED'
echo 'P231_OPERATOR_INVOKER_GRANT=NOT_APPROVED'
echo 'P231_DEPLOYMENT_METHOD=NOT_APPROVED'
echo 'P231_DELETION_CLEANUP_PLAN=REVIEW_REQUIRED'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
