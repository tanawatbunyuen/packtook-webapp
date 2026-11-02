#!/usr/bin/env bash
# PACKTOOK V6.8.1 — deploy ONLY the read-only publicSignupStatus callable.
# Never deploy completeFreeSignup, existing Beta, Owner, Omise, or Hosting.
# Requires owner confirmation; all 3 Public flags must be explicitly FALSE.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT="packtook-prod-01"

if [[ "$#" -ne 1 || "$1" != "$PROJECT" ]]; then
 echo "SAFETY BLOCK: expected project $PROJECT" >&2
 exit 2
fi

node --check functions/index.js
node scripts/check-public-status-rollout.mjs "$PROJECT"
node scripts/test-public-registration.mjs
node scripts/test-public-signup-navigation.mjs
node scripts/test-v67-native-realm.mjs

if [[ ! -d functions/node_modules/firebase-functions ]]; then
 echo "SAFETY BLOCK: Firebase Functions dependencies missing; install locally before rollout." >&2
 exit 2
fi

if ! command -v firebase >/dev/null 2>&1; then
 echo "SAFETY BLOCK: Firebase CLI not found" >&2
 exit 2
fi

echo "READY: Deploy ONLY functions:beta:publicSignupStatus to $PROJECT."
echo "Public signup/access/policy flags are all FALSE. No Auth account or credits will be created by this callable."
echo "No changes to Customer Hosting, Marketing, Owner, Beta credit handlers or Omise."
echo "After deploy, verify with: node scripts/probe-free-deployment.mjs $PROJECT --expect-v66"
read -r -p "Type DEPLOY-READONLY-SIGNUP-STATUS to proceed: " CONFIRM
if [[ "$CONFIRM" != "DEPLOY-READONLY-SIGNUP-STATUS" ]]; then
 echo "Cancelled before any deployment."
 exit 1
fi

# Recheck flags immediately before any mutation. Explicit project and codebase/function scoping.
node scripts/check-public-status-rollout.mjs "$PROJECT"
firebase deploy --config firebase.json --project "$PROJECT" \
 --only functions:beta:publicSignupStatus --non-interactive
echo "Status callable deployed; Public remains disabled. Verify from independent read-only probe."
