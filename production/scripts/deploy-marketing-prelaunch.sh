#!/usr/bin/env bash
# PACKTOOK V6.5.1 — Marketing Hosting ONLY. Pre-launch; never enable payments.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT="$1"
if [[ "$PROJECT" != "packtook-prod-01" ]]; then
  echo "ERROR: This guarded script is for packtook-prod-01 only." >&2
  exit 1
fi

node scripts/verify.mjs "$PROJECT"
node scripts/test-marketing-website.mjs
node --check public/assets/site.js

# Guarantee this release remains a prelaunch website without live checkout.
grep -q 'name="robots" content="noindex, nofollow"' public/index.html
grep -q 'REGISTRATION &amp; PAYMENT NOT OPEN' public/index.html
grep -q 'No live payment' public/index.html
grep -q 'Disallow: /' public/robots.txt

node - "$PROJECT" <<'JS'
const fs=require("node:fs"),project=process.argv[2];
const cfg=JSON.parse(fs.readFileSync("firebase.json","utf8"));
const targets=cfg.hosting.map(h=>h.target).sort().join(",");
if(targets!=="app,marketing,owner"||
 cfg.hosting.find(h=>h.target==="marketing")?.public!=="public"){
 throw Error("Marketing hosting target or public directory mismatch");
}
const rc=JSON.parse(fs.readFileSync(".firebaserc","utf8"));
const hosting=rc.targets?.[project]?.hosting;
if(hosting?.marketing?.length!==1||hosting.marketing[0]!==project||
 hosting?.app?.[0]!==project+"-app"||
 hosting?.owner?.[0]!==project+"-owner"){
 throw Error("Production hosting aliases do not match expected isolated sites");
}
JS

echo "About to deploy PRE-LAUNCH MARKETING only to $PROJECT."
echo "No Customer Hosting, Owner, Firebase Functions, Firestore, QR, Auth, or payments will be deployed."
echo "Public registration/payments remain OFF; the site remains noindex."
read -r -p "Type DEPLOY-PACKTOOK-MARKETING-PRELAUNCH to continue: " APPROVAL
if [[ "$APPROVAL" != "DEPLOY-PACKTOOK-MARKETING-PRELAUNCH" ]]; then
 echo "Cancelled; nothing deployed."
 exit 1
fi
firebase deploy --config firebase.json --project "$PROJECT" --only hosting:marketing
