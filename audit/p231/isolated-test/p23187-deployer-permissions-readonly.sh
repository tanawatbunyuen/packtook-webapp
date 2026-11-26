#!/usr/bin/env bash
# Read-only operator capability preflight; no token minting, IAM edits, or deploy.
set -u -o pipefail
set +x
PROJECT=packtook-staging
RUNTIME_SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
echo 'P231_CHECK=DEPLOYER_PERMISSIONS_READONLY'
if ! command -v gcloud >/dev/null; then
  echo 'P231_GCLOUD=NOT_AVAILABLE';exit 2
fi

ACTIVE="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null)"
N="$(printf '%s\n' "$ACTIVE" | sed '/^$/d' | wc -l)"
if [ "$N" -eq 1 ]; then
 echo 'P231_ACTIVE_OPERATOR=ONE_ACCOUNT'
else
 echo 'P231_ACTIVE_OPERATOR=NOT_UNAMBIGUOUS'
 exit 2
fi

# Service account IAM policy is not operator's effective permissions. Test the
# supported SA testIamPermissions endpoint with caller's existing login.
# Do not output caller account or any unrelated IAM identities.
if ! gcloud iam service-accounts describe "$RUNTIME_SA" --project="$PROJECT" --format='value(disabled)' >/dev/null 2>&1; then
 echo 'P231_RUNTIME_SA=NOT_READABLE';exit 2
fi
echo 'P231_RUNTIME_SA=READABLE'

# Check API activation, not deploy permissions. Commands are read-only.
for API in cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com; do
 STATUS="$(gcloud services list --enabled --project="$PROJECT" --filter="config.name=$API" --format='value(config.name)' 2>/dev/null)"
 if [ "$STATUS" = "$API" ]; then
   echo "P231_API_${API%%.*}=ENABLED"
 else
   echo "P231_API_${API%%.*}=NOT_CONFIRMED"
 fi
done

echo 'P231_OPERATOR_EFFECTIVE_DEPLOY_PERMISSION=NOT_TESTED'
echo 'P231_OPERATOR_ACT_AS_PERMISSION=NOT_TESTED'
echo 'P231_INVOKER_IDENTITY=NOT_SELECTED'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
