#!/usr/bin/env bash
# Explicitly deploy only the V6.1 beta recording/credit Functions to Production.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROD="${1:-}"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Refusing non-production project" >&2;exit 1;}
node scripts/verify.mjs "$PROD"
[[ "$(cat "functions/.env.$PROD" 2>/dev/null)" == "PACKTOOK_PRODUCTION_PROJECT_ID=$PROD" ]] || { echo "ERROR: Missing exact Production runtime environment. Run prepare-beta.sh" >&2;exit 1;}
[[ -d functions/node_modules ]] || { echo "ERROR: npm install required. Run prepare-beta.sh" >&2;exit 1;}
node --check functions/index.js
echo "Target Firebase Project: $PROD"
echo "Only Production Beta (codebase 'beta') recording, device and read-only membership Functions will be deployed."
echo "No Omise charge, webhook or public subscription purchase Functions exist in this source."
read -r -p "Type DEPLOY-PROD-BETA-FUNCTIONS to approve: " YES
[[ "$YES" == "DEPLOY-PROD-BETA-FUNCTIONS" ]] || { echo "Cancelled."; exit 1; }

firebase deploy --project "$PROD" --config firebase.json \
 --only functions:beta:usageStatus,functions:beta:reserveCredit,functions:beta:finalizeCredit,functions:beta:recordingStatus,functions:beta:pendingVideoReservations,functions:beta:recoverStaleVideoReservation

firebase deploy --project "$PROD" --config firebase.json \
 --only functions:beta:registerDevice,functions:beta:deviceStatus,functions:beta:removeDevice,functions:beta:authorizeDuplicate,functions:beta:accountRole,functions:beta:subscriptionOverview

echo "Deployed 12 production beta functions. Existing Staging Functions were not changed."
