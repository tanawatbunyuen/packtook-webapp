#!/usr/bin/env bash
# P231: staging only, metadata only; does not call the protected function or obtain tokens.
set -euo pipefail
PROJECT=packtook-staging
REGION=asia-southeast1
FN=g02RequestShapeProbe
EXPECTED_REV=g02requestshapeprobe-00002-wap
EXPECTED_SA=g02-probe-runtime@packtook-staging.iam.gserviceaccount.com
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || { echo P231_OPERATOR_ONLY_REQUIRED; exit 2; }
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] || { echo P231_WRONG_GCLOUD_PROJECT; exit 2; }
command -v jq >/dev/null || { echo P231_JQ_MISSING; exit 2; }
META="$(gcloud functions describe "$FN" --gen2 --project="$PROJECT" --region="$REGION" --format=json)"
printf '%s' "$META" | jq -e --arg p "$PROJECT" --arg r "$EXPECTED_REV" --arg s "$EXPECTED_SA" '
  .name == ("projects/"+$p+"/locations/asia-southeast1/functions/g02RequestShapeProbe")
  and .state == "ACTIVE"
  and .serviceConfig.revision == $r
  and .serviceConfig.serviceAccountEmail == $s
  and .serviceConfig.allTrafficOnLatestRevision == true
' >/dev/null || { echo P231_STAGING_REVISION_OR_SA_DRIFT; exit 2; }
echo P231_STAGING_RUNTIME_METADATA=PASS
gcloud run services get-iam-policy g02requestshapeprobe --project="$PROJECT" --region="$REGION" --format=json |
jq -e '[.bindings[]? | select(.role=="roles/run.invoker") | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")] | length == 0' >/dev/null ||
{ echo P231_PUBLIC_INVOKER_DETECTED; exit 2; }
echo P231_PUBLIC_INVOKER_ABSENT=PASS
gcloud run services describe g02requestshapeprobe --project="$PROJECT" --region="$REGION" --format=json |
jq -e '.metadata.annotations["run.googleapis.com/invoker-iam-disabled"] // "false" | . == "false"' >/dev/null ||
{ echo P231_INVOKER_ENFORCEMENT_DRIFT; exit 2; }
echo P231_INVOKER_ENFORCEMENT=PASS
echo P231_APPCHECK_VALID_CLIENT=NOT_TESTED
echo P231_APPCHECK_INVALID_CLIENT=NOT_TESTED
echo P231_MAIN_BACKEND_SOURCE_PARITY=NOT_VERIFIED
echo P231_RELEASE=NO_GO
