#!/usr/bin/env bash
# Deploy only QR Test Functions. Customer/Owner/Staging unchanged.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Refusing non-Production deploy" >&2;exit 1; }
node scripts/verify.mjs "$PROD"
node scripts/test-promptpay.mjs
node scripts/test-package-policy.mjs
node scripts/test-renewal-notice.mjs
node --check payment-functions/index.js
[[ -d payment-functions/node_modules ]] || { echo "ERROR: Run prepare-promptpay.sh first." >&2;exit 1; }
node - "$PROD" <<'JS'
const fs=require("fs"),project=process.argv[2],p="payment-functions/.env."+project;
if(!fs.existsSync(p))throw Error("Missing PromptPay Production environment; run prepare-promptpay.sh");
const lines=fs.readFileSync(p,"utf8").trim().split(/\r?\n/),values={};
for(const line of lines){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
 if(!m||Object.hasOwn(values,m[1]))throw Error("Unexpected/duplicate Payment env key");
 values[m[1]]=m[2];}
if(values.PACKTOOK_PRODUCTION_PROJECT_ID!==project)throw Error("Project guard mismatch");
if(!["true","false"].includes(values.PACKTOOK_PROMPTPAY_TEST_ENABLED))throw Error("Test flag required true/false");
if(Object.keys(values).sort().join(",")!=="PACKTOOK_PRODUCTION_PROJECT_ID,PACKTOOK_PROMPTPAY_TEST_ENABLED")
 throw Error("Unexpected Payment env configuration");
console.log("PromptPay TEST:",values.PACKTOOK_PROMPTPAY_TEST_ENABLED,"(Card = DISABLED; Live = DISABLED)");
JS
echo "Functions codebase 'promptpay' only. Test secrets must have been set via Firebase CLI."
read -r -p "Type DEPLOY-PROD-QR-TEST-FUNCTIONS to continue: " OK
[[ "$OK" == "DEPLOY-PROD-QR-TEST-FUNCTIONS" ]] || { echo "Cancelled.";exit 1; }
firebase deploy --config firebase.json --project "$PROD" --only functions:promptpay
echo "PromptPay TEST Functions deployment completed. Verify Firebase CLI status; no live charges available."
