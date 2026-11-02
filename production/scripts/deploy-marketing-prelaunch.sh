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
node scripts/test-marketing-brand-parity.mjs
node scripts/test-marketing-workflow-comparison.mjs
node scripts/test-marketing-typography.mjs
node --check public/assets/site.js

# Guarantee this release remains a prelaunch website without live checkout.
grep -q 'name="robots" content="noindex, nofollow"' public/index.html
grep -q 'REGISTRATION &amp; PAYMENT NOT OPEN' public/index.html
grep -q 'No live payment' public/index.html
grep -q 'Disallow: /' public/robots.txt
grep -q 'customer-brand.css?v=6.5.2' public/index.html
test -s public/assets/customer-brand.css
test -s public/assets/logo.svg
test -s public/assets/mascot-eagle.svg
test -s public/assets/packing-workstation.svg
test -s public/assets/packing-comparison.css
grep -q 'packing-comparison.css?v=6.5.3' public/index.html
grep -q 'typography.css?v=6.5.4' public/index.html
test -s public/assets/typography.css
test -s public/assets/hero-photo.js
if [[ ! -s public/assets/packtook-hero-photo.webp ]]; then
  echo "ERROR: Committed AI Hero photo missing. Fetch latest feature/v6.5.4-hero-photo-type-scale branch before deploying." >&2
  exit 1
fi
node - <<'JS_PHOTO'
const fs=require("node:fs"),crypto=require("node:crypto");
const p="public/assets/packtook-hero-photo.webp";
const x=fs.readFileSync(p);
if(x.length<10000||x.toString("ascii",0,4)!=="RIFF"||x.toString("ascii",8,12)!=="WEBP")
 throw Error("Invalid or incomplete Hero WebP photo: "+p);
const actual=crypto.createHash("sha256").update(x).digest("hex");
if(actual!=="5e661c81450755aa3569808628bbd6f1226a6562626cb9a4d9066721f564537e")
 throw Error("Hero photo does not match the reviewed AI asset SHA-256");
const html=fs.readFileSync("public/index.html","utf8");
if(!html.includes('src="/assets/packtook-hero-photo.webp?v=6.5.4.1"'))
 throw Error("Website Hero does not directly reference the reviewed photo");
JS_PHOTO

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
