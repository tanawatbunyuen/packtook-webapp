#!/usr/bin/env bash
# Deploy ONLY isolated Owner Functions (Analytics + gated Management), never Customer Beta or Staging.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Expected exact Production project ID" >&2;exit 1; }
node scripts/verify.mjs "$PROD"
node scripts/test-owner.mjs
node scripts/test-package-policy.mjs
node scripts/test-owner-charts.mjs
node scripts/test-owner-management.mjs
node scripts/test-owner-management-ui.mjs
node --check owner-functions/index.js
[[ -d owner-functions/node_modules ]] || { echo "ERROR: Run prepare-owner.sh first." >&2; exit 1; }
node - "$PROD" <<'JS'
const fs=require("fs"),project=process.argv[2];
const file="owner-functions/.env."+project;
if(!fs.existsSync(file))throw Error("Missing Owner Production .env. Run prepare-owner.sh");
const vars=Object.create(null);
for(const raw of fs.readFileSync(file,"utf8").split(/\r?\n/)){
 const line=raw.trim();if(!line||line.startsWith("#"))continue;
 const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
 if(!m||Object.hasOwn(vars,m[1]))throw Error("Invalid or duplicate Owner runtime env setting");
 vars[m[1]]=m[2];
}
if(vars.PACKTOOK_PRODUCTION_PROJECT_ID!==project)throw Error("Production project guard mismatch");
const management=vars.PACKTOOK_OWNER_MANAGEMENT_ENABLED;
if(management!==undefined&&management!=="true"&&management!=="false")throw Error("Owner Management flag must be true or false");
for(const key of Object.keys(vars))if(!["PACKTOOK_PRODUCTION_PROJECT_ID","PACKTOOK_OWNER_MANAGEMENT_ENABLED"].includes(key))
 throw Error("Unexpected Owner env key: "+key);
console.log("Owner Management runtime gate:",management==="true"?"ENABLED (privileged changes allowed)":"DISABLED (read-only)");
JS
echo "Firebase Project: $PROD"
echo "Deploying only Owner codebase: Analytics + separately gated Customer Management."
echo "No Customer Functions, Firestore rules, Omise payments or Staging will be deployed."
read -r -p "Type DEPLOY-PROD-OWNER-FUNCTIONS to continue: " YES
[[ "$YES" == "DEPLOY-PROD-OWNER-FUNCTIONS" ]] || { echo "Cancelled"; exit 1; }
firebase deploy --config firebase.json --project "$PROD" \
 --only functions:owner
echo "Owner Functions deployment complete. Check Firebase CLI success for all six Owner functions."
