#!/usr/bin/env bash
# P220: Cloud Shell operator ONLY — never run from CI. Creates new isolated Function.
# Requires pre-existing reviewed least-privilege staging service account.
set -euo pipefail
[[ "${1:-}" == "--deploy" ]] || { echo "P220_NO_DEPLOY: pass --deploy explicitly"; exit 2; }
[[ "${G02_STAGING_DEPLOY_EXPLICIT:-}" == "YES" ]] || { echo "P220_BLOCK: explicit operator execution flag missing"; exit 2; }
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || { echo "P220_BLOCK: cloud deployment forbidden in CI"; exit 2; }
[[ "$(gcloud config get-value project 2>/dev/null)" == "packtook-staging" ]] || { echo "P220_BLOCK: wrong active project"; exit 2; }
SA="${G02_PROBE_SERVICE_ACCOUNT:-}"
[[ "$SA" == "g02-probe-runtime@packtook-staging.iam.gserviceaccount.com" ]] || { echo "P220_BLOCK: dedicated staging runtime SA required"; exit 2; }
gcloud iam service-accounts describe "$SA" --project=packtook-staging --format="value(email)" >/dev/null
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"
node "$ROOT/audit/p188/build-rc.js"
node "$ROOT/audit/p189/verify.js"
node "$ROOT/audit/p220/predeploy.js"
echo "P220_DEPLOYING_NEW_SYNTHETIC_ONLY_G02_PROBE"
gcloud functions deploy g02AuthzProbe \
 --gen2 --runtime=nodejs22 --trigger-http \
 --region=asia-southeast1 --project=packtook-staging \
 --source="$HERE/probe" --entry-point=g02AuthzProbe \
 --service-account="$SA" --no-allow-unauthenticated \
 --max-instances=1 --timeout=15s
echo "P220_ISOLATED_STAGING_PROBE_DEPLOY_COMMAND_COMPLETED"
echo "P220_G02_RELEASE_GATE=NO_GO"
