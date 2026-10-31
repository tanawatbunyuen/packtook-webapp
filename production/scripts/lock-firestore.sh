#!/usr/bin/env bash
# Optional. Deploy deny-all Firestore Rules to a NEW Production Firestore database.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)";cd "$ROOT"
PROD="${1:-}"
[[ "$PROD" =~ ^[a-z][a-z0-9-]{5,29}$ && "$PROD" == *prod* && "$PROD" != "packtook-staging" ]] || { echo "Pass isolated production project ID" >&2;exit 1;}
node scripts/verify.mjs "$PROD"
echo "This will REPLACE Firestore Rules of the PRODUCTION project with DENY ALL."
echo "Do not use after a real Customer backend is launched without reviewing rules."
read -r -p "Type LOCK-PROD-DATABASE to continue: " OK
[[ "$OK" == "LOCK-PROD-DATABASE" ]] || { echo Cancelled;exit 1; }
firebase deploy --config firebase.json --project "$PROD" --only firestore:rules
echo "Production Firestore rules locked. No Staging changes."
