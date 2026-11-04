#!/usr/bin/env bash
# PACKTOOK V7.2 — invite-only PILOT Firebase DEMO Auth/Firestore integration.
# NEVER deploys or mutates Production, Secret Manager or live Public flags.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
DEMO="demo-packtook-v70"
[[ "$#" -eq 1 && "$1" == "--demo-only" ]] || {
 echo "SAFETY BLOCK: --demo-only is required" >&2;exit 2; }
[[ -z "$(printenv FIREBASE_AUTH_EMULATOR_HOST || true)" &&
   -z "$(printenv FIRESTORE_EMULATOR_HOST || true)" ]] || {
 echo "SAFETY BLOCK: inherited emulator endpoints prohibited" >&2;exit 2; }
command -v firebase >/dev/null 2>&1 || { echo "Firebase CLI required" >&2;exit 2; }
[[ -d functions/node_modules/firebase-admin &&
   -d functions/node_modules/firebase-functions ]] || {
 echo "Install local SDK: npm install --prefix functions --no-audit --no-fund" >&2;exit 2; }
node --check functions/index.js
node --check scripts/test-v72-pilot-auth-firestore-emulator.mjs
node --check app/pilot-free.js
node --check app/firebase-packing-bridge.js
node scripts/v72-pilot-browser-source-check.mjs
node scripts/test-v72-pilot-browser-source-safety.mjs
node scripts/test-v72-pilot-browser-flow.mjs
node --check scripts/v72-live-surfaces-preflight.mjs
node scripts/test-v72-live-surfaces-preflight.mjs
node --check scripts/v72-secret-iam-audit.mjs
node scripts/test-v72-secret-iam-audit.mjs
node --check scripts/v72-iam-least-privilege-review.mjs
node scripts/test-v72-iam-least-privilege-review.mjs
node --check scripts/v72-secret-changeplan.mjs
node scripts/test-v72-secret-changeplan.mjs
node --check scripts/v72-secret-only-gate.mjs
node scripts/test-v72-secret-only-provision.mjs
bash -n scripts/v72-provision-secret-only.sh
node scripts/test-v70-emulator-guard.mjs
node scripts/test-v70-demo-env-isolation.mjs
node scripts/test-v72-pilot-source-safety.mjs
node scripts/test-v72-pilot-readiness.mjs
node scripts/test-public-registration.mjs
node scripts/test-v70-qa-source-safety.mjs
node scripts/test-v71-readiness-safety.mjs
echo "Starting V7.2 CLOSED PILOT Auth/Firestore DEMO-only integration"
LOG="$(mktemp /tmp/packtook-v72-pilot-demo.XXXXXX.log)"
echo "Demo log: $LOG"
# Child process overrides Google Cloud Shell project ONLY for DEMO emulators.
# Actual Admin SDK project and endpoints verified inside the integration test.
if env GCLOUD_PROJECT="$DEMO" GCP_PROJECT="$DEMO" \
 GOOGLE_CLOUD_PROJECT="$DEMO" FIREBASE_PROJECT_ID="$DEMO" \
 firebase emulators:exec --project "$DEMO" \
  --config firebase.emulators-v67.json --only auth,firestore \
  "PACKTOOK_QA_DEMO_PROJECT=$DEMO node scripts/test-v72-pilot-auth-firestore-emulator.mjs" \
  2>&1 | tee "$LOG"; then
 echo "PASS: V7.2 REAL DEMO Auth/Firestore CLOSED PILOT integration finished"
else
 echo "FAIL: V7.2 DEMO PILOT integration; last 100 log lines:" >&2
 tail -n 100 "$LOG" >&2
 exit 1
fi
