#!/usr/bin/env bash
# PACKTOOK V7.1 — Auth+Firestore multi-user Free DEMO integration ONLY.
# Never deploys, enables Production Public flags or writes cloud data.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
DEMO="demo-packtook-v70"
[[ "$#" -eq 1 && "$1" == "--demo-only" ]] || {
 echo "SAFETY BLOCK: run V7.1 with --demo-only" >&2;exit 2; }
[[ -z "$(printenv FIREBASE_AUTH_EMULATOR_HOST || true)" &&
   -z "$(printenv FIRESTORE_EMULATOR_HOST || true)" ]] || {
 echo "SAFETY BLOCK: preexisting emulator endpoints may be unsafe" >&2;exit 2; }
command -v firebase >/dev/null 2>&1 || { echo "Firebase CLI required" >&2;exit 2; }
[[ -d functions/node_modules/firebase-admin &&
   -d functions/node_modules/firebase-functions ]] || {
 echo "Install local SDK first: npm install --prefix functions --no-audit --no-fund" >&2;exit 2; }
node --check functions/index.js
node --check scripts/test-v71-public-auth-firestore-emulator.mjs
node scripts/test-v70-emulator-guard.mjs
node scripts/test-v70-demo-env-isolation.mjs
node scripts/test-v71-readiness-safety.mjs
node scripts/test-public-registration.mjs
echo "Starting V7.1 DEMO-only Auth/Firestore public Free lifecycle integration"
LOG="$(mktemp /tmp/packtook-v71-emulator.XXXXXX.log)"
echo "Demo log: $LOG"
# Override inherited Cloud Shell project variables ONLY on this DEMO child.
# Actual SDK client in the test verifies the independent demo guard.
if env GCLOUD_PROJECT="$DEMO" GCP_PROJECT="$DEMO" \
  GOOGLE_CLOUD_PROJECT="$DEMO" FIREBASE_PROJECT_ID="$DEMO" \
  firebase emulators:exec --project "$DEMO" \
   --config firebase.emulators-v67.json --only auth,firestore \
   "PACKTOOK_QA_DEMO_PROJECT=$DEMO node scripts/test-v71-public-auth-firestore-emulator.mjs" \
   2>&1 | tee "$LOG";then
 echo "PASS: V7.1 REAL DEMO Auth/Firestore PUBLIC FREE integration finished"
else
 echo "FAIL: V7.1 DEMO integration; last 100 log lines:" >&2
 tail -n 100 "$LOG" >&2
 echo "Full log at $LOG" >&2
 exit 1
fi
