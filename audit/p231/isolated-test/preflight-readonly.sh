#!/usr/bin/env bash
# P231 isolated App Check probe: READ ONLY, NEVER DEPLOYS OR EDITS IAM.
set -euo pipefail
set +x
PROJECT='packtook-staging'
REGION='asia-southeast1'
NAME='p231AppCheckIsolatedProbe'

echo 'P231_PREFLIGHT_MODE=READ_ONLY'
echo "P231_PROJECT=$PROJECT"
echo "P231_REGION=$REGION"
echo "P231_PROPOSED_FUNCTION=$NAME"

if ! command -v gcloud >/dev/null; then
  echo 'P231_GCLOUD=NOT_INSTALLED'
  exit 2
fi
if ! gcloud projects describe "$PROJECT" --format='value(projectId)' 2>/dev/null | grep -qx "$PROJECT"; then
  echo 'P231_PROJECT_ACCESS=BLOCKED'
  exit 2
fi
echo 'P231_PROJECT_ACCESS=PASS'

LIST="$(gcloud functions list --v2 --project="$PROJECT" --regions="$REGION" --format='value(name)' 2>/dev/null)" || {
  echo 'P231_FUNCTION_INVENTORY=BLOCKED'
  exit 2
}
echo 'P231_FUNCTION_INVENTORY=PASS'
if printf '%s\n' "$LIST" | awk -F/ '{print $NF}' | grep -Fxq "$NAME"; then
  echo 'P231_NAME_COLLISION=YES'
  echo 'P231_DEPLOY_GATE=BLOCKED'
  exit 2
fi
echo 'P231_NAME_COLLISION=NO'
echo 'P231_RUNTIME_IDENTITY=NOT_SELECTED'
echo 'P231_INVOKER_POLICY=NOT_APPROVED'
echo 'P231_ISOLATED_DEPLOY=NOT_PERFORMED'
echo 'P231_PRODUCTION_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
