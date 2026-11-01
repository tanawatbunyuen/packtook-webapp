#!/usr/bin/env bash
# PACKTOOK V6.2 — prepare Owner UI + dedicated read-only Cloud Functions. No deployment.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Only packtook-prod-01 is allowed" >&2;exit 1; }
node scripts/verify.mjs "$PROD"
[[ -f app/firebase-v4-config.js ]] || { echo "ERROR: Prepare V6.1 Production Customer Web SDK config first" >&2;exit 1; }
node - "$PROD" <<'JS'
const fs=require("fs"),id=process.argv[2],s=fs.readFileSync("app/firebase-v4-config.js","utf8");
const m=s.match(/export const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
if(!m)throw Error("Missing Production client Web SDK config");
const x=JSON.parse(m[1]);
if(x.projectId!==id||x.authDomain!==id+".firebaseapp.com"||!x.apiKey||!x.appId)throw Error("Customer Web App config is not for Production");
if(/packtook-staging/i.test(s))throw Error("Staging SDK config detected");
fs.writeFileSync("owner/firebase-config.js","// PACKTOOK Production Owner Web SDK config; local generated file.\nexport const firebaseConfig = "+JSON.stringify(x,null,2)+";\n",{mode:0o600});
console.log("Owner Web App config linked ONLY to "+id);
JS
printf 'PACKTOOK_PRODUCTION_PROJECT_ID=%s\n' "$PROD" > "owner-functions/.env.$PROD"
node --input-type=module --check < owner/app.js
node --check owner-functions/index.js
node --check owner-functions/scripts/manage-platform-owner.js
node scripts/test-owner.mjs
node scripts/test-owner-charts.mjs
node scripts/test-owner-management.mjs
node scripts/test-owner-management-ui.mjs
npm --prefix owner-functions install --no-audit --no-fund
echo "PASS: V6.2.3 Owner prepared; no Production Hosting or Functions deployed."
echo "Next: bash scripts/deploy-owner-functions.sh $PROD"
