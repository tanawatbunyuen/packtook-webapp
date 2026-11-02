#!/usr/bin/env bash
# Deploy ONLY Customer Hosting. Does NOT deploy V6.5 registration Backend or enable public signups.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Production only" >&2;exit 1; }
node scripts/verify.mjs "$PROD"
node scripts/test-auth-uid.mjs
node scripts/test-customer-ui.mjs
node scripts/test-navigation-troubleshooting.mjs
node scripts/test-promptpay.mjs
node scripts/test-package-policy.mjs
node scripts/test-renewal-notice.mjs
node scripts/test-qr-lifecycle.mjs
node scripts/test-public-registration.mjs
node scripts/test-onboarding-ui.mjs
node scripts/test-public-signup-navigation.mjs
node scripts/test-public-launch-preflight.mjs
node scripts/test-v67-emulator-safety.mjs
node scripts/test-free-deployment-probe.mjs
node --check app/app.js
[[ -s app/login-background.png && -s app/firebase-v4-config.js ]] || {
 echo "ERROR: Copy verified Production app/login-background.png and app/firebase-v4-config.js from V6.1." >&2;exit 1; }
node - "$PROD" <<'JS'
const fs=require("fs"),id=process.argv[2];
const r=JSON.parse(fs.readFileSync(".firebaserc","utf8")),t=r.targets?.[id]?.hosting;
if(t?.app?.length!==1||t.app[0]!==id+"-app"||t?.marketing?.[0]!==id||t?.owner?.[0]!==id+"-owner")
 throw Error("Production Hosting target mismatch");
const src=fs.readFileSync("app/firebase-v4-config.js","utf8");
const m=src.match(/export const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
if(!m)throw Error("Missing Customer Production SDK config");
const c=JSON.parse(m[1]);
if(c.projectId!==id||c.authDomain!==id+".firebaseapp.com"||!c.apiKey||!c.appId)
 throw Error("Firebase SDK config does not match Production");
JS
echo "Only Customer Production Hosting will be updated. V6.5 PUBLIC SIGNUP stays OFF until Backend/App Check/legal approval."
read -r -p "Type DEPLOY-PROD-QR-TEST-CUSTOMER to continue: " OK
[[ "$OK" == "DEPLOY-PROD-QR-TEST-CUSTOMER" ]] || { echo "Cancelled.";exit 1; }
firebase deploy --config firebase.json --project "$PROD" --only hosting:app
