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
# Named Firestore isolation is mandatory before creating any Cloud Run function.
DB="g02-security-test"
DB_NAME="$(gcloud firestore databases describe --database="$DB" --project=packtook-staging --format="value(name)")"
[[ "$DB_NAME" == "projects/packtook-staging/databases/$DB" ]] || { echo "P221_BLOCK: named Firestore database absent"; exit 2; }
# Requires conditional viewer grant limited to the named database, and rejects
# any project-level unconditional grant to this service account.
# This check does NOT establish that higher-level inherited/resource IAM is absent.
gcloud projects get-iam-policy packtook-staging --format=json | \
G02_RUNTIME_SA="$SA" python3 -c '
import json,os,sys
p=json.load(sys.stdin)
member="serviceAccount:"+os.environ["G02_RUNTIME_SA"]
want="resource.name==\"projects/packtook-staging/databases/g02-security-test\""
bindings=[b for b in p.get("bindings",[]) if member in b.get("members",[])]
matches=[b for b in bindings if b.get("role")=="roles/datastore.viewer" and
 b.get("condition",{}).get("expression")==want]
if len(bindings)!=1 or len(matches)!=1:
 print("P221_BLOCK: expected exactly one conditional datastore.viewer role")
 sys.exit(2)
print("P221_DATABASE_CONDITIONAL_VIEWER=PASS")
'
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
