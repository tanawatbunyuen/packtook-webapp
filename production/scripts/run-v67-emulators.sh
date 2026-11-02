#!/usr/bin/env bash
# PACKTOOK V6.7 — safe Firebase DEMO project integration test.
# Runs real Auth + Firestore emulators ONLY. NEVER deploys any service.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DEMO="demo-packtook-v67"

if [[ "$#" -ne 1 ]] || [[ "$1" != "--demo-only" ]]; then
  echo "SAFETY BLOCK: run with --demo-only; production projects are not permitted." >&2
  exit 2
fi
if [[ -n "$(printenv FIREBASE_AUTH_EMULATOR_HOST || true)" || -n "$(printenv FIRESTORE_EMULATOR_HOST || true)" ]]; then
  echo "SAFETY BLOCK: an Emulator session is already active; use a clean Cloud Shell." >&2
  exit 2
fi
if ! command -v firebase >/dev/null 2>&1; then
  echo "Install Firebase CLI in Cloud Shell or follow the Firebase Emulator docs." >&2
  exit 2
fi
if [[ ! -d functions/node_modules/firebase-admin || ! -d functions/node_modules/firebase-functions ]]; then
  echo "Missing Firebase Admin SDK dependencies. Run 'npm install --prefix functions --no-audit --no-fund' first (the repository has no functions/package-lock.json)." >&2
  exit 2
fi
node --check scripts/test-free-auth-firestore-emulator.mjs
node scripts/test-v67-emulator-safety.mjs
node scripts/test-v67-emulator-config.mjs
node scripts/test-v67-native-realm.mjs

echo "Starting DEMO-ONLY Auth and Firestore emulators for $DEMO."
echo "Emulator config: firebase.emulators-v67.json (Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080)."
echo "No Customer Hosting, Functions Deployment, Auth/Firestore Production, Omise, or live signup is touched."
echo "Test callable transport is mocked; Admin Auth/Firestore operations are REAL on local emulators only."
# Save full Emulator output and repeat the final failure context for easier diagnosis.
# This is a DEMO project only; no secrets or production customers should be in the log.
LOG_FILE="$(mktemp /tmp/packtook-v67-emulator.XXXXXX.log)"
echo "Demo emulator log: $LOG_FILE"
if firebase emulators:exec \
  --project "$DEMO" --config firebase.emulators-v67.json --only auth,firestore \
  "PACKTOOK_QA_DEMO_PROJECT=$DEMO node scripts/test-free-auth-firestore-emulator.mjs" \
  2>&1 | tee "$LOG_FILE"; then
  echo "PASS: Firebase Auth + Firestore Demo Emulator integration command completed."
else
  echo "V6.7 Demo Emulator failed. Final 70 log lines follow:" >&2
  tail -n 70 "$LOG_FILE" >&2
  echo "Full demo log saved at: $LOG_FILE" >&2
  exit 1
fi
