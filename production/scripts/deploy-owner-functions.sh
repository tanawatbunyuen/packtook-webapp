#!/usr/bin/env bash
# Deploy ONLY the new read-only Owner functions, never Customer Beta or Staging.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Expected exact Production project ID" >&2;exit 1; }
node scripts/verify.mjs "$PROD"
node scripts/test-owner.mjs
node scripts/test-owner-charts.mjs
node scripts/test-owner-management.mjs
node --check owner-functions/index.js
[[ -d owner-functions/node_modules ]] || { echo "ERROR: Run prepare-owner.sh first." >&2; exit 1; }
[[ "$(cat "owner-functions/.env.$PROD" 2>/dev/null)" == "PACKTOOK_PRODUCTION_PROJECT_ID=$PROD" ]] || { echo "ERROR: Missing Production Owner environment guard. Run prepare-owner.sh" >&2; exit 1; }
echo "Firebase Project: $PROD"
echo "Deploying only Owner codebase: Analytics + separately gated Customer Management."
echo "No Customer Functions, Firestore rules, Omise payments or Staging will be deployed."
read -r -p "Type DEPLOY-PROD-OWNER-FUNCTIONS to continue: " YES
[[ "$YES" == "DEPLOY-PROD-OWNER-FUNCTIONS" ]] || { echo "Cancelled"; exit 1; }
firebase deploy --config firebase.json --project "$PROD" \
 --only functions:owner
echo "Owner read-only Functions deployment submitted. Check Firebase CLI success for all three Owner functions."
