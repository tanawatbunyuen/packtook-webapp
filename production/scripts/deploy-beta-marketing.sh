#!/usr/bin/env bash
# Optional: publish the branded V6.1 marketing page only (not Customer, Owner or Functions).
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)";cd "$ROOT"
PROD="${1:-}"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Only packtook-prod-01 is permitted" >&2; exit 1; }
node scripts/verify.mjs "$PROD"
node - "$PROD" <<'JS'
const fs=require("fs"),id=process.argv[2],t=JSON.parse(fs.readFileSync(".firebaserc","utf8")).targets?.[id]?.hosting;
if(t?.marketing?.length!==1||t.marketing[0]!==id)throw Error("Marketing site target mismatch");
JS
echo "Publishing only Production Marketing branding (official logo + eagle)."
read -r -p "Type DEPLOY-PROD-MARKETING to continue: " YES
[[ "$YES" == "DEPLOY-PROD-MARKETING" ]] || { echo Cancelled;exit 1; }
firebase deploy --config firebase.json --project "$PROD" --only hosting:marketing
