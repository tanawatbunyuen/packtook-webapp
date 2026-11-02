#!/usr/bin/env bash
# PACKTOOK V7.0 — exact-scope, HUMAN-APPROVED Production rollout.
# NEVER turns on Public Free, NEVER touches Omise/Owner/Marketing/Firestore rules.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROJECT="packtook-prod-01"
if [[ "$#" -ne 2 || "$1" != "$PROJECT" ||
 ("$2" != "--qa-off" && "$2" != "--approved-qa") ]]; then
 echo "Usage: bash scripts/deploy-v70-qa-controlled.sh packtook-prod-01 --qa-off|--approved-qa" >&2
 exit 2
fi
MODE="$2"
# Every QA-disabled Production deploy must first pass local checks, capture
# a read-only snapshot of deployed Beta Functions, and confirm public flags
# still OFF. Preparation never deploys; it fails closed on wrong Git branch.
if [[ "$MODE" == "--qa-off" ]]; then
 bash scripts/prepare-v70-qa-disabled.sh "$PROJECT" --qa-off
fi
node scripts/verify.mjs "$PROJECT"
node scripts/test-v70-qa-source-safety.mjs
node scripts/test-v70-deploy-scope.mjs
node scripts/test-v70-qa-preflight.mjs
node scripts/check-v70-qa-preflight.mjs "$PROJECT" "$MODE"
node scripts/test-public-registration.mjs
node scripts/test-onboarding-ui.mjs
node scripts/test-public-launch-preflight.mjs
node scripts/test-customer-cache-contract.mjs
node scripts/test-promptpay.mjs
node scripts/test-v67-native-realm.mjs
node --check functions/index.js
node --check --input-type=module < app/qa-free.js

[[ -d functions/node_modules/firebase-functions ]] || {
 echo "SAFETY BLOCK: Firebase dependencies are missing" >&2;exit 2; }
command -v firebase >/dev/null 2>&1 || {
 echo "SAFETY BLOCK: Firebase CLI not installed" >&2;exit 2; }
node - "$PROJECT" <<'JS'
const fs=require("fs"),project=process.argv[2];
const rc=JSON.parse(fs.readFileSync(".firebaserc","utf8"));
const t=rc.targets?.[project]?.hosting;
const fb=JSON.parse(fs.readFileSync("firebase.json","utf8"));
if(t?.app?.[0]!==project+"-app"||t?.marketing?.[0]!==project||
   !fb.functions?.some(x=>x.codebase==="beta"&&x.source==="functions"))
 throw Error("SAFETY BLOCK: expected exact Production Firebase targets");
const source=fs.readFileSync("app/firebase-v4-config.js","utf8");
const match=source.match(/export const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
if(!match)throw Error("SAFETY BLOCK: Customer Firebase config missing");
const config=JSON.parse(match[1]);
if(config.projectId!==project||!/^1:[0-9]+:web:[A-Za-z0-9]+$/.test(config.appId))
 throw Error("SAFETY BLOCK: Production Customer Web App mismatch");
JS

# Existing Beta callable handlers need a reviewed update to recognize an
# attested, narrowly scoped QA claim. Existing Beta claim still works.
# Deploy in batches of at most 8, following Firebase's recommended <=10
# functions per deployment to limit build quota and operational blast radius.
ONLY_CORE="functions:beta:qaFreeStatus,functions:beta:completeQaFreeSignup,functions:beta:usageStatus,functions:beta:reserveCredit,functions:beta:finalizeCredit,functions:beta:registerDevice,functions:beta:deviceStatus,functions:beta:recordingStatus"
ONLY_SUPPORT="functions:beta:removeDevice,functions:beta:pendingVideoReservations,functions:beta:recoverStaleVideoReservation,functions:beta:authorizeDuplicate,functions:beta:accountRole,functions:beta:subscriptionOverview"
echo "Scoped Production Cloud Functions rollout, mode=$MODE"
echo "This WILL update existing Beta Cloud Functions. It will NOT deploy all Functions."
echo "Review the target list above in the script before proceeding."
if [[ "$MODE" == "--qa-off" ]]; then
 EXPECT="DEPLOY-V70-QA-DISABLED"
else
 EXPECT="DEPLOY-V70-APPROVED-INVITE"
fi
read -r -p "Type $EXPECT to approve this exact Production rollout: " INPUT
[[ "$INPUT" == "$EXPECT" ]] || { echo "Cancelled before deploying";exit 1; }
# Check the exact environment immediately before the mutating Firebase CLI.
node scripts/check-v70-qa-preflight.mjs "$PROJECT" "$MODE"
# If either batch fails, stop immediately and investigate; QA remains scoped to
# the still-active lease/UID and ALL Public flags must remain OFF.
echo "Batch 1/2: QA activation + essential credit/device functions (8 callables)"
firebase deploy --config firebase.json --project "$PROJECT" \
 --only "$ONLY_CORE" --non-interactive
node scripts/check-v70-qa-preflight.mjs "$PROJECT" "$MODE"
echo "Batch 2/2: supporting account/recording functions (6 callables)"
firebase deploy --config firebase.json --project "$PROJECT" \
 --only "$ONLY_SUPPORT" --non-interactive
echo "Both scoped Function batches completed; confirm live Public flags OFF with read-only probe."
echo "Customer QA HTML/JS requires a SEPARATE hosting:app-only deploy after review."
