#!/usr/bin/env bash
# P231.84 — Read-only operator identity and scoped invoker gate.
# This script NEVER requests tokens or prints secrets.
set -u -o pipefail
set +x
PROJECT=packtook-staging
echo 'P231_CHECK=OPERATOR_INVOKER_IDENTITY_PREFLIGHT'
echo "P231_PROJECT=$PROJECT"
if ! command -v gcloud >/dev/null 2>&1; then
  echo 'P231_GCLOUD=NOT_AVAILABLE'
  exit 2
fi

# Displays only status flags, never the email/name of the principal.
ACTIVE="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null)"
if [ -n "$ACTIVE" ] && [ "$(printf '%s\n' "$ACTIVE" | sed '/^$/d' | wc -l)" -eq 1 ]; then
  echo 'P231_ACTIVE_OPERATOR_IDENTITY=ONE_ACCOUNT_FOUND'
else
  echo 'P231_ACTIVE_OPERATOR_IDENTITY=NOT_UNAMBIGUOUS'
fi

# Read-only access test, no IAM grant or token minting.
if gcloud projects describe "$PROJECT" --format='value(projectId)' 2>/dev/null | grep -Fxq "$PROJECT"; then
  echo 'P231_OPERATOR_PROJECT_READ=PASS'
else
  echo 'P231_OPERATOR_PROJECT_READ=BLOCKED'
fi

# Detect if service-level test function already exists (avoid surprising redeploy).
if gcloud functions list --v2 --project="$PROJECT" --regions=asia-southeast1 --format='value(name)' 2>/dev/null \
   | awk -F/ '{print $NF}' | grep -Fxq 'p231AppCheckIsolatedProbe'; then
  echo 'P231_TEST_FUNCTION_EXISTS=YES_REVIEW_REQUIRED'
else
  echo 'P231_TEST_FUNCTION_EXISTS=NO_OR_NOT_VISIBLE'
fi

echo 'P231_TEST_OPERATOR_AUDIENCE=NOT_SELECTED'
echo 'P231_CLOUD_RUN_IAM_GRANT=NOT_PERFORMED'
echo 'P231_STAGING_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
