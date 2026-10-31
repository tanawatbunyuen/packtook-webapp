#!/usr/bin/env bash
# Deploy only the PACKTOOK Production hosting holding pages; NEVER billing, functions or Firestore.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROD="${1:-}"
if [[ ! "$PROD" =~ ^[a-z][a-z0-9-]{5,29}$ || "$PROD" == "packtook-staging" || "$PROD" != *prod* ]]; then
 echo "ERROR: Pass the isolated Firebase Production project ID containing prod." >&2; exit 1
fi
node scripts/verify.mjs "$PROD"
[[ -f .firebaserc ]] || { echo "ERROR: Run bootstrap.sh first. Missing production/.firebaserc" >&2; exit 1; }
node - "$PROD" <<'JS'
const fs=require('fs'),id=process.argv[2],r=JSON.parse(fs.readFileSync('.firebaserc','utf8'));
const t=r.targets?.[id];if(!t||!(t.marketing?.length===1&&t.app?.length===1&&t.owner?.length===1)){
 console.error('ERROR: Production Hosting mappings are missing or ambiguous. Run bootstrap.sh.');process.exit(1);
}
for(const key of ['marketing','app','owner']){
 if(t[key].some(name=>name.includes('staging'))){console.error('ERROR: Target '+key+' points to Staging.');process.exit(1);}
}
console.log('Checked production targets for project '+id, t);
JS
echo "Deploying PRODUCTION holding pages only (Marketing, closed Customer, closed Owner)"
echo "This will NOT deploy Functions, Firestore, Auth or payments."
read -r -p "Type DEPLOY-PROD-HOSTING to continue: " CONFIRM
[[ "$CONFIRM" == "DEPLOY-PROD-HOSTING" ]] || { echo "Cancelled."; exit 1; }
firebase deploy --project "$PROD" --config firebase.json --only hosting:marketing,hosting:app,hosting:owner
echo "Production foundation Hosting deployed. Customer recording and payments remain DISABLED."
