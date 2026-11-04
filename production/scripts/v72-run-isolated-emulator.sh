#!/usr/bin/env bash
# PACKTOOK V7.2 local Firebase Emulator integration — DEMO PROJECT ONLY.
# Does not deploy, access GCP APIs, enable Production, or mutate remote Firestore.
set -Eeuo pipefail
set +x
PROJECT="demo-packtook-v72"
BRANCH="feature/v7.2-controlled-public-pilot-readiness"
cd "$(dirname "$0")/.."
[[ "$(git branch --show-current)" == "$BRANCH" ]] || { echo "BLOCK: unexpected branch"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo "BLOCK: dirty working tree"; exit 2; }
command -v firebase >/dev/null || { echo "BLOCK: Firebase CLI missing"; exit 2; }
command -v node >/dev/null || { echo "BLOCK: Node.js missing"; exit 2; }
command -v java >/dev/null || { echo "BLOCK: Java missing"; exit 2; }
[[ -f scripts/v72-isolated-emulators.firebase.json ]] || { echo "BLOCK: isolated emulator config missing"; exit 2; }
node --check scripts/test-v72-isolated-emulator-integration.mjs
node --check functions/index.js
node - <<'NODE'
const fs=require("fs"),c=JSON.parse(fs.readFileSync("scripts/v72-isolated-emulators.firebase.json"));
const e=c.emulators||{};
if(e.auth?.host!=="127.0.0.1"||e.auth?.port!==19099||
e.firestore?.host!=="127.0.0.1"||e.firestore?.port!==18080||
e.ui?.enabled!==false||
Object.keys(c).some(k=>k!=="emulators")||
e.functions||e.storage||e.database)process.exit(2);
console.log("PASS: isolated loopback Auth/Firestore config; no Hosting/Functions deploy");
NODE
node - <<'NODE'
try{
 const p=require.resolve("firebase-admin",{paths:["./functions"]});
 console.log("PASS: firebase-admin dependency available locally");
}catch{console.error("BLOCK: firebase-admin missing in production/functions/node_modules. Run npm --prefix functions install --no-audit --no-fund first.");process.exit(2);}
NODE
[[ "${1:-}" == "--run" && "$#" -eq 1 ]] || {
 echo "USAGE: bash scripts/v72-run-isolated-emulator.sh --run"
 exit 2
}
echo "=== DEMO-ONLY INTEGRATION RUN ==="
echo "Project $PROJECT, services: Auth 127.0.0.1:19099 + Firestore 127.0.0.1:18080"
echo "No Production writes. Emulators create temporary LOCAL test records only."
# Remove any accidental ADC reference. Demo project id + loopback emulator endpoints
# are checked again inside the JS runner before any test writes.
env -u GOOGLE_APPLICATION_CREDENTIALS firebase emulators:exec \
 --project "$PROJECT" \
 --config scripts/v72-isolated-emulators.firebase.json \
 --only auth,firestore \
 "node scripts/test-v72-isolated-emulator-integration.mjs"
