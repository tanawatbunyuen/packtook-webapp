#!/usr/bin/env bash
# PACKTOOK V6.0 — prepare isolated Firebase Production hosting sites.
# Existing PACKTOOK Staging project is never modified.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ $# -ge 1 && $# -le 3 ]] || fail "Usage: bash scripts/bootstrap.sh <production-project-id> [app-site-id] [owner-site-id]"
PROD="$1"
[[ "$PROD" =~ ^[a-z][a-z0-9-]{5,29}$ ]] || fail "Invalid Firebase project ID"
[[ "$PROD" != "packtook-staging" && "$PROD" == *prod* ]] || fail "Project must be a NEW production ID containing 'prod', never packtook-staging."
APP_SITE="${2:-$PROD-app}"
OWNER_SITE="${3:-$PROD-owner}"
for id in "$PROD" "$APP_SITE" "$OWNER_SITE"; do
 [[ "$id" =~ ^[a-z][a-z0-9-]{3,29}$ ]] || fail "Hosting site ID invalid or longer than 30 chars: $id"
done
[[ "$PROD" != "$APP_SITE" && "$PROD" != "$OWNER_SITE" && "$APP_SITE" != "$OWNER_SITE" ]] || fail "The three Hosting site IDs must be distinct."

command -v firebase >/dev/null || fail "Install firebase-tools first"
command -v node >/dev/null || fail "Node.js is required"
node scripts/verify.mjs "$PROD"

# The new Firebase project must already exist. Creating it is a separate, deliberate action.
echo "Validating separate Firebase project: $PROD"
PROJECTS_JSON="$(mktemp)"
trap 'rm -f "$PROJECTS_JSON" "$SITES_JSON"' EXIT
firebase projects:list --json > "$PROJECTS_JSON" || fail "Firebase CLI cannot list projects. Check firebase login."
node - "$PROD" "$PROJECTS_JSON" <<'JS'
const fs=require('fs'),[id,path]=process.argv.slice(2);
const j=JSON.parse(fs.readFileSync(path,'utf8'));
const data=j.result??j.projects??[];
const projects=Array.isArray(data)?data:(Array.isArray(data.projects)?data.projects:[]);
if(!projects.some(p=>p.projectId===id)) {
 console.error("New Firebase project not found. Create it in Firebase Console, then rerun.");
 process.exit(1);
}
console.log("Verified Firebase project:",id);
JS

SITES_JSON="$(mktemp)"
firebase hosting:sites:list --project "$PROD" --json > "$SITES_JSON" || fail "Cannot list Hosting sites for production project."

site_exists(){
 node - "$1" "$SITES_JSON" <<'JS'
const fs=require('fs'),[id,path]=process.argv.slice(2);
const o=JSON.parse(fs.readFileSync(path,'utf8'));
const payload=o.result??o;
const a=Array.isArray(payload)?payload:(payload.sites??payload.items??[]);
process.exit(a.some(x=>x.name===id||x.name?.endsWith('/sites/'+id)||x.site===id||x.siteId===id)?0:1);
JS
}
ensure_site(){
 local sid="$1"
 if site_exists "$sid"; then
  echo "Hosting site already exists in Production: $sid"
 else
  echo "Creating missing Hosting site in Production: $sid"
  firebase hosting:sites:create "$sid" --project "$PROD" || fail "Failed to create site $sid. Inspect Hosting setup manually."
 fi
}

echo
echo "Hosting sites: marketing=$PROD; customer=$APP_SITE; owner=$OWNER_SITE"
echo "Production project cannot access staging accounts unless you deliberately copy configuration or data."
read -r -p "Type CREATE-PROD-SITES to provision Production Hosting sites only: " APPROVAL
[[ "$APPROVAL" == "CREATE-PROD-SITES" ]] || fail "Cancelled: no Production changes."

ensure_site "$PROD"
ensure_site "$APP_SITE"
ensure_site "$OWNER_SITE"

# .firebaserc here is only under production/; staging's repo-root .firebaserc is untouched.
firebase target:apply hosting marketing "$PROD" --project "$PROD"
firebase target:apply hosting app "$APP_SITE" --project "$PROD"
firebase target:apply hosting owner "$OWNER_SITE" --project "$PROD"

node scripts/verify.mjs "$PROD"
echo
echo "SETUP COMPLETE. Staging unchanged. No Hosting content deployed yet."
echo "Run: bash scripts/deploy-hosting.sh $PROD"
echo "Expected sites: https://$PROD.web.app , https://$APP_SITE.web.app , https://$OWNER_SITE.web.app"
echo "App and Owner are intentionally DISABLED holding pages for V6.0."
