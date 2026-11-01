#!/usr/bin/env bash
# Prepare Production Beta, no Firebase deployment.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROD="${1:-}"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Expected exact production project packtook-prod-01" >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: Node.js missing" >&2; exit 1; }
node scripts/verify.mjs "$PROD"
[[ -f app/firebase-v4-config.js ]] || { echo "ERROR: Generate Production Web App config with scripts/configure-web.mjs first." >&2; exit 1; }
node --input-type=module --check < app/firebase-v4-config.js
node - "$PROD" <<'JS'
const fs=require("fs"),id=process.argv[2],txt=fs.readFileSync("app/firebase-v4-config.js","utf8");
const match=txt.match(/export const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
if(!match)throw Error("Production Firebase Web config parse failed");
const cfg=JSON.parse(match[1]);
if(cfg.projectId!==id||cfg.authDomain!==id+".firebaseapp.com"||!cfg.apiKey||!cfg.appId)throw Error("Production Web config does not match the target project");
if(/packtook-staging|AIzaSyCps_3b60lXjdIbPJ5Fb5sucl1oCY3D89o/.test(txt))throw Error("Staging Web config found in Production");
console.log("Production Firebase web configuration checked:",cfg.projectId);
JS
[[ -f "../login-background.png" ]] || { echo "ERROR: Original Staging login background missing in repository root." >&2; exit 1; }
cp "../login-background.png" "app/login-background.png"
printf "PACKTOOK_PRODUCTION_PROJECT_ID=%s\n" "$PROD" > "functions/.env.$PROD"
node --check functions/index.js
node --input-type=module --check < app/firebase-packing-bridge.js
node --check app/app.js
node --check app/video-history-db.js
node --check app/video-stream-writer.js
node --check app/performance-monitor.js
npm --prefix functions install --no-audit --no-fund
echo "PASS: V6.1 production beta prepared (no deployment)."
echo "Next: bash scripts/deploy-beta-functions.sh $PROD"
