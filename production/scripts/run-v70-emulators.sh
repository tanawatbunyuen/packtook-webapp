#!/usr/bin/env bash
# PACKTOOK V7.0 — DEMO Auth+Firestore QA only. No live Firebase access/deploy.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
DEMO="demo-packtook-v70"
[[ "$#" -eq 1 && "$1" == "--demo-only" ]] || {
 echo "SAFETY BLOCK: run V7 with --demo-only" >&2;exit 2; }
[[ -z "$(printenv FIREBASE_AUTH_EMULATOR_HOST || true)" &&
   -z "$(printenv FIRESTORE_EMULATOR_HOST || true)" ]] || {
 echo "SAFETY BLOCK: preexisting emulator endpoints may be unsafe" >&2;exit 2; }
command -v firebase >/dev/null 2>&1 || { echo "Firebase CLI required" >&2;exit 2; }
[[ -d functions/node_modules/firebase-admin && -d functions/node_modules/firebase-functions ]] || {
 echo "Install local SDK: npm install --prefix functions --no-audit --no-fund" >&2;exit 2; }
node --check functions/index.js
node --check scripts/test-v70-qa-auth-firestore-emulator.mjs
node scripts/test-v70-qa-source-safety.mjs
node scripts/test-v67-emulator-config.mjs
echo "Starting V7.0 DEMO Auth+Firestore on 127.0.0.1. Project=$DEMO"
LOG="$(mktemp /tmp/packtook-v70-emulator.XXXXXX.log)"
echo "Demo log: $LOG"
if firebase emulators:exec --project "$DEMO" \
  --config firebase.emulators-v67.json --only auth,firestore \
  "PACKTOOK_QA_DEMO_PROJECT=$DEMO node scripts/test-v70-qa-auth-firestore-emulator.mjs" \
   2>&1 | tee "$LOG"; then
 echo "PASS: V7.0 real DEMO Auth+Firestore QA integration finished"
else
 echo "FAIL: V7.0 demo integration; last 90 log lines follow:" >&2
 tail -n 90 "$LOG" >&2
 echo "Full demo log at: $LOG" >&2
 exit 1
fi
