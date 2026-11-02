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
  echo "Missing Firebase Admin SDK dependencies. Run 'npm ci --prefix functions' with its lockfile first." >&2
  exit 2
fi
node --check scripts/test-free-auth-firestore-emulator.mjs
node scripts/test-v67-emulator-safety.mjs

echo "Starting DEMO-ONLY Auth and Firestore emulators for $DEMO."
echo "No Customer Hosting, Functions Deployment, Auth/Firestore Production, Omise, or live signup is touched."
echo "Test callable transport is mocked; Admin Auth/Firestore operations are REAL on local emulators only."
firebase emulators:exec \
  --project "$DEMO" --config firebase.json --only auth,firestore \
  "PACKTOOK_QA_DEMO_PROJECT=$DEMO node scripts/test-free-auth-firestore-emulator.mjs"
