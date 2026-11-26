#!/usr/bin/env bash
# Read-only inventory for already-deployed staging callables. No secrets, no IAM writes.
set -uo pipefail
set +x
PROJECT='packtook-staging'
REGION='asia-southeast1'
echo 'P231_CHECK=EXISTING_STAGING_CALLABLE_INVOKER_AUDIT'
echo "P231_PROJECT=$PROJECT"

for SERVICE in usagestatus recordingstatus accountrole; do
  echo "P231_SERVICE=$SERVICE"
  DETAILS="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
  RC=$?
  if [ "$RC" -ne 0 ]; then
    echo 'P231_SERVICE_DESCRIPTION=NOT_READABLE'
    continue
  fi
  printf '%s' "$DETAILS" | jq -r '
    "P231_SERVICE_DESCRIPTION=PASS",
    "P231_INVOKER_IAM_DISABLED_ANNOTATION=" +
      (.metadata.annotations["run.googleapis.com/invoker-iam-disabled"] // "NOT_SET"),
    "P231_INVOKER_IAM_DISABLED_FIELD=" +
      ((.invokerIamDisabled // "NOT_SET") | tostring)
  '

  POLICY="$(gcloud run services get-iam-policy "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null)"
  RC=$?
  if [ "$RC" -ne 0 ]; then
    echo 'P231_SERVICE_IAM=NOT_READABLE'
    continue
  fi
  printf '%s' "$POLICY" | jq -r '
    [
      .bindings[]? | select(
        (.role=="roles/run.invoker" or .role=="roles/run.admin")
        and any(.members[]?; .=="allUsers" or .=="allAuthenticatedUsers")
      )
    ] as $x |
    "P231_SERVICE_PUBLIC_DIRECT_BINDINGS=" + ($x | length | tostring)
  '
done

echo 'P231_INHERITED_AND_EFFECTIVE_IAM=NOT_VERIFIED'
echo 'P231_NEW_FUNCTION_INVOKER=NOT_CONFIGURED'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
