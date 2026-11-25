#!/usr/bin/env bash
set -euo pipefail
MODE="${1:---preflight}"
[[ "$MODE" == "--preflight" || "$MODE" == "--deploy" ]] || exit 2
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || exit 2
[[ "$(gcloud config get-value project 2>/dev/null)" == packtook-staging ]] || exit 2
SA=g02-probe-runtime@packtook-staging.iam.gserviceaccount.com
FN=g02RequestShapeProbe
REV="$(gcloud functions describe "$FN" --gen2 --project=packtook-staging --region=asia-southeast1 --format='value(serviceConfig.revision)')"
ACTUAL_SA="$(gcloud functions describe "$FN" --gen2 --project=packtook-staging --region=asia-southeast1 --format='value(serviceConfig.serviceAccountEmail)')"
[[ "$ACTUAL_SA" == "$SA" && -n "$REV" ]] || { echo P227_WRONG_RUNTIME_SA; exit 2; }
gcloud run services get-iam-policy g02requestshapeprobe --project=packtook-staging --region=asia-southeast1 --format=json | python3 -c '
import json,sys
p=json.load(sys.stdin)
assert not any(b["role"]=="roles/run.invoker" and set(b.get("members",[]))&{"allUsers","allAuthenticatedUsers"} for b in p.get("bindings",[]))
print("P227_PUBLIC_INVOKER_ABSENT=PASS")
'
gcloud run services describe g02requestshapeprobe --project=packtook-staging --region=asia-southeast1 --format=json | python3 -c '
import json,sys
s=json.load(sys.stdin)
assert s.get("metadata",{}).get("annotations",{}).get("run.googleapis.com/invoker-iam-disabled","false")=="false"
print("P227_INVOKER_ENFORCEMENT=PASS")
'
[[ "${GCLOUD_PROJECT:-}" == demo-packtook-p184 && "${GOOGLE_CLOUD_PROJECT:-}" == demo-packtook-p184 ]] || exit 2
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../.."
node audit/p188/build-rc.js
node audit/p189/verify.js
node audit/p227/build-patch.js
node audit/p227/fixtures.js
echo "P227_CURRENT_REVISION=$REV"
echo P227_PREFLIGHT=PASS
if [[ "$MODE" == "--preflight" ]]; then echo P227_NO_DEPLOY; exit 0; fi
[[ "${G02_P227_DEPLOY_EXPLICIT:-}" == YES && "${P227_EXPECTED_REVISION:-}" == "$REV" ]] || { echo P227_REVISION_OR_FLAG_MISSING; exit 2; }
gcloud functions deploy "$FN" --gen2 --runtime=nodejs22 --trigger-http \
 --project=packtook-staging --region=asia-southeast1 \
 --source="$HERE/probe" --entry-point="$FN" \
 --service-account="$SA" --no-allow-unauthenticated --max-instances=1 --timeout=30s
echo P227_DEPLOY_SUCCEEDED=TRUE
echo P227_RUNTIME_NOT_VERIFIED_G02_NO_GO
