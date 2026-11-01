#!/usr/bin/env bash
# Deploy ONLY the PACKTOOK V6.2 Production Owner Hosting site.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Refusing non-Production deploy" >&2;exit 1; }
node scripts/verify.mjs "$PROD"
node scripts/test-owner.mjs
[[ -f .firebaserc ]] || { echo "ERROR: Missing .firebaserc from Production V6.0 bootstrap" >&2;exit 1; }
[[ -f owner/firebase-config.js ]] || { echo "ERROR: Owner Web config not ready; run prepare-owner.sh" >&2;exit 1; }
node - "$PROD" <<'JS'
const fs=require("fs"),id=process.argv[2],r=JSON.parse(fs.readFileSync(".firebaserc","utf8"));
const targets=r.targets?.[id]?.hosting;
if(targets?.owner?.length!==1||targets.owner[0]!==id+"-owner")throw Error("Owner Hosting target does not match Production");
if(targets?.marketing?.[0]!==id||targets?.app?.[0]!==id+"-app")throw Error("Other Hosting targets missing; refusing unsafe deploy");
const source=fs.readFileSync("owner/firebase-config.js","utf8");
const m=source.match(/export const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
if(!m)throw Error("Missing Production Owner Firebase SDK configuration");
const x=JSON.parse(m[1]);
if(x.projectId!==id||x.authDomain!==id+".firebaseapp.com"||!x.appId||!x.apiKey)throw Error("Owner SDK config is not for Production");
if(source.includes("packtook-staging"))throw Error("Staging SDK config detected");
console.log("Verified Production Owner Hosting site:",targets.owner[0]);
JS
echo "Deploying ONLY hosting:owner. Customer, Marketing, Firestore and Staging stay untouched."
read -r -p "Type DEPLOY-PROD-OWNER-HOSTING to continue: " YES
[[ "$YES" == "DEPLOY-PROD-OWNER-HOSTING" ]] || { echo "Cancelled";exit 1; }
firebase deploy --config firebase.json --project "$PROD" --only hosting:owner
echo "Owner UI hosting deployed. Login will remain private until an Owner claim is granted."
