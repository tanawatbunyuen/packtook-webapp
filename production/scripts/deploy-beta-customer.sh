#!/usr/bin/env bash
# Deploy ONLY Production Customer Beta Hosting; Marketing/Owner/Staging unchanged.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROD="${1:-}"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Refusing non-production project" >&2; exit 1; }
node scripts/verify.mjs "$PROD"
node scripts/test-auth-uid.mjs
node scripts/test-customer-ui.mjs
node --check app/app.js
[[ -f .firebaserc ]] || { echo "ERROR: Missing Production Hosting targets (.firebaserc). Run V6.0 bootstrap first." >&2;exit 1; }
node - "$PROD" <<'JS'
const fs=require("fs"),id=process.argv[2],r=JSON.parse(fs.readFileSync(".firebaserc","utf8"));
const ids=r.targets?.[id]?.hosting;
if(ids?.app?.length!==1||ids.app[0]!==id+"-app")throw Error("Production app Hosting target invalid");
if(ids?.marketing?.[0]!==id||ids?.owner?.[0]!==id+"-owner")throw Error("Production other Hosting targets invalid");
const source=fs.readFileSync("app/firebase-v4-config.js","utf8");
const m=source.match(/export const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
if(!m)throw Error("Missing valid Production SDK config: run configure-web.mjs");
const c=JSON.parse(m[1]);
if(c.projectId!==id||c.authDomain!==id+".firebaseapp.com")throw Error("SDK config mismatches Production");
if(/packtook-staging|AIzaSyCps_3b60lXjdIbPJ5Fb5sucl1oCY3D89o/.test(source))throw Error("Staging SDK config detected");
console.log("Owner & Marketing targets preserved; Customer target:",ids.app[0]);
JS
[[ -s app/login-background.png ]] || { echo "ERROR: Missing Staging-equivalent login background. Run prepare-beta.sh" >&2;exit 1; }
[[ -f functions/.env."$PROD" ]] || { echo "ERROR: Prepare the beta backend before deploying the frontend." >&2;exit 1; }
echo "Production Customer Site: https://$PROD-app.web.app"
echo "Only hosting:app will be updated. Public signup / Omise Live remain closed."
read -r -p "Type DEPLOY-PROD-CUSTOMER-BETA to continue: " YES
[[ "$YES" == "DEPLOY-PROD-CUSTOMER-BETA" ]] || { echo "Cancelled";exit 1; }
firebase deploy --config firebase.json --project "$PROD" --only hosting:app
echo "Production Customer Beta Hosting updated. Review camera, login and credits with an authorized Beta test account."
