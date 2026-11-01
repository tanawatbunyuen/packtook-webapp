#!/usr/bin/env bash
# Deploy only the PACKTOOK Production hosting holding pages; NEVER billing, functions or Firestore.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "V6.1 uses independent guarded deploy scripts: deploy-beta-functions.sh, deploy-beta-customer.sh, deploy-beta-marketing.sh." >&2
echo "The legacy V6.0 all-sites deployment is disabled on this V6.1 branch to avoid unintended Hosting changes." >&2
exit 2

PROD="${1:-}"
if [[ ! "$PROD" =~ ^[a-z][a-z0-9-]{5,29}$ || "$PROD" == "packtook-staging" || "$PROD" != *prod* ]]; then
 echo "ERROR: Pass the isolated Firebase Production project ID containing prod." >&2; exit 1
fi
node scripts/verify.mjs "$PROD"
[[ -f .firebaserc ]] || { echo "ERROR: Run bootstrap.sh first. Missing production/.firebaserc" >&2; exit 1; }
node - "$PROD" <<'JS'
const fs=require('fs'),id=process.argv[2],r=JSON.parse(fs.readFileSync('.firebaserc','utf8'));
// firebase target:apply stores targets[projectId].hosting[hostingTarget] = [siteId].
const t=r.targets?.[id]?.hosting;
if(!t||!['marketing','app','owner'].every(key=>Array.isArray(t[key])&&t[key].length===1)){
 console.error('ERROR: Production Hosting mappings are missing or ambiguous.');
 console.error('Expected .firebaserc targets['+id+'].hosting.marketing/app/owner.');
 console.error('If bootstrap.sh has not finished, finish it before running this deploy script.');
 process.exit(1);
}
const expectedMarketing=id;
const ids=['marketing','app','owner'].map(key=>t[key][0]);
if(t.marketing[0]!==expectedMarketing||ids.some(site=>typeof site!=='string'||site.includes('staging'))||new Set(ids).size!==3){
 console.error('ERROR: The production Hosting targets are not isolated or have unexpected site IDs.');
 process.exit(1);
}
console.log('Checked production hosting targets for '+id, t);
JS
echo "Deploying PRODUCTION holding pages only (Marketing, closed Customer, closed Owner)"
echo "This will NOT deploy Functions, Firestore, Auth or payments."
read -r -p "Type DEPLOY-PROD-HOSTING to continue: " CONFIRM
[[ "$CONFIRM" == "DEPLOY-PROD-HOSTING" ]] || { echo "Cancelled."; exit 1; }
firebase deploy --project "$PROD" --config firebase.json --only hosting:marketing,hosting:app,hosting:owner
echo "Production foundation Hosting deployed. Customer recording and payments remain DISABLED."
