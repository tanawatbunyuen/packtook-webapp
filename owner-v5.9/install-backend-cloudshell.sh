#!/usr/bin/env bash
# PACKTOOK Owner V5.9 — backend-only installer for the existing packtook-staging functions codebase.
# This script never calls firebase deploy.
set -Eeuo pipefail
PROJECT="packtook-staging"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$PWD"

fail(){ echo "ERROR: $*" >&2; exit 1; }
command -v node >/dev/null || fail "Node.js is not available"
command -v python3 >/dev/null || fail "Python 3 is not available"
[[ -f "$ROOT/firebase.json" ]] || fail "Run from the EXISTING firebase.json directory"
[[ -f "$HERE/functions/owner-management-v59.js" ]] || fail "V5.9 source missing in patch folder"

echo "PACKTOOK V5.9 | Install backend files ONLY | project: $PROJECT"

FN_DIR="$(python3 - <<'PY'
import json,sys
c=json.load(open('firebase.json'))
items=c.get('functions')
if isinstance(items,dict): items=[items]
if not isinstance(items,list) or len(items)!=1:
  sys.exit("ERROR: Expected exactly one Firebase Functions codebase; no changes made.")
f=items[0]
if f.get('codebase','default')!='default': sys.exit("ERROR: Expected codebase default; no changes made.")
src=f.get('source','functions')
if src.startswith('/') or '..' in src.split('/'): sys.exit("ERROR: Invalid Functions source.")
print(src)
PY
)"
[[ -f "$FN_DIR/package.json" ]] || fail "$FN_DIR/package.json missing"
MAIN="$(node - "$FN_DIR/package.json" <<'JS'
const p=require('fs').readFileSync(process.argv[2],'utf8');
const x=JSON.parse(p);
if(x.type==='module')throw Error('ESM project; manual integration required');
console.log(x.main||'index.js');
JS
)" || fail "Could not inspect functions package"
if [[ "$MAIN" == */lib/* || "$MAIN" == lib/* || "$MAIN" == dist/* || "$MAIN" == */dist/* ]]; then
  fail "Compiled functions entrypoint: $MAIN. Integrate in TypeScript SOURCE instead."
fi
[[ "$MAIN" != /* && "$MAIN" != *".."* ]] || fail "Unsafe functions entrypoint"
ENTRY="$FN_DIR/$MAIN"
[[ -f "$ENTRY" ]] || fail "Cannot find entrypoint: $ENTRY"
[[ -f "$FN_DIR/node_modules/firebase-functions/package.json" ]] || fail "firebase-functions missing. Run npm ci in the functions directory first."
[[ -f "$FN_DIR/node_modules/firebase-admin/package.json" ]] || fail "firebase-admin missing. Run npm ci in the functions directory first."
node --check "$HERE/functions/owner-management-v59.js"
node --check "$ENTRY"

echo
echo "Existing function entrypoint: $ENTRY"
echo "Do not guess your Firestore schema."
echo "Verify names by reading your existing credit reserve/finalize and subscription entitlement code."
echo
read -r -p "Credit document path with {uid} (e.g. accounts/{uid}): " CREDIT_DOC
read -r -p "Remaining credit field (integer): " REMAINING_FIELD
read -r -p "Expiry document path with {uid}: " EXPIRY_DOC
read -r -p "Expiry field (can be dotted): " EXPIRY_FIELD
read -r -p "Plan document path with {uid}: " PLAN_DOC
read -r -p "Plan field (can be dotted): " PLAN_FIELD
read -r -p "Expiry storage format [timestamp|iso|milliseconds]: " EXPIRY_STORAGE
export CREDIT_DOC REMAINING_FIELD EXPIRY_DOC EXPIRY_FIELD PLAN_DOC PLAN_FIELD EXPIRY_STORAGE

node <<'JS'
const e=process.env;
for(const key of ['CREDIT_DOC','EXPIRY_DOC','PLAN_DOC']){
  const v=e[key];
  if(!v||!v.includes('{uid}')||v.replace('{uid}','TEST').split('/').length%2)
    throw Error('Invalid Firestore document path '+key);
}
for(const key of ['REMAINING_FIELD','EXPIRY_FIELD','PLAN_FIELD']){
  if(!/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(e[key]||''))throw Error('Invalid Firestore field '+key);
}
if(!['timestamp','iso','milliseconds'].includes(e.EXPIRY_STORAGE))throw Error('Invalid expiry storage format');
JS

echo
printf 'Credit = %s  /  %s\n' "$CREDIT_DOC" "$REMAINING_FIELD"
printf 'Expiry = %s  /  %s  [%s]\n' "$EXPIRY_DOC" "$EXPIRY_FIELD" "$EXPIRY_STORAGE"
printf 'Plan   = %s  /  %s\n' "$PLAN_DOC" "$PLAN_FIELD"
echo "IMPORTANT: Verify all mappings against actual customer-side code."
read -r -p "Type YES if these fields match your actual existing schema: " CONFIRM
[[ "$CONFIRM" == "YES" ]] || fail "Cancelled, no files changed"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.packtook-v59-backup-$STAMP"
mkdir -p "$BACKUP"
cp "$ENTRY" "$BACKUP/functions-entry.js"
[[ ! -f "$FN_DIR/.env.$PROJECT" ]] || cp "$FN_DIR/.env.$PROJECT" "$BACKUP/functions-env"
[[ ! -f "$FN_DIR/owner-management-v59.js" ]] || cp "$FN_DIR/owner-management-v59.js" "$BACKUP/owner-management-v59.js"
cp "$HERE/functions/owner-management-v59.js" "$FN_DIR/owner-management-v59.js"

if ! grep -Fq "require('./owner-management-v59')" "$ENTRY"; then
  printf "\n// PACKTOOK Owner V5.9 backend — append without replacing prior exports\nObject.assign(module.exports, require('./owner-management-v59'));\n" >> "$ENTRY"
fi
python3 - "$FN_DIR/.env.$PROJECT" <<'PY'
import os,sys
path=sys.argv[1]
pairs={
  "PACKTOOK_CREDIT_DOC":os.environ["CREDIT_DOC"],
  "PACKTOOK_REMAINING_FIELD":os.environ["REMAINING_FIELD"],
  "PACKTOOK_EXPIRY_DOC":os.environ["EXPIRY_DOC"],
  "PACKTOOK_EXPIRY_FIELD":os.environ["EXPIRY_FIELD"],
  "PACKTOOK_PLAN_DOC":os.environ["PLAN_DOC"],
  "PACKTOOK_PLAN_FIELD":os.environ["PLAN_FIELD"],
  "PACKTOOK_EXPIRY_STORAGE":os.environ["EXPIRY_STORAGE"],
}
old=open(path).read().splitlines() if os.path.isfile(path) else []
old=[line for line in old if line.split("=",1)[0].strip() not in pairs]
with open(path,"w") as f:
  for line in old: f.write(line+"\n")
  for key,value in pairs.items(): f.write(f"{key}={value}\n")
PY

node --check "$ENTRY"
node --check "$FN_DIR/owner-management-v59.js"
echo
echo "SUCCESS: V5.9 backend source installed; no Cloud Functions deployed yet."
echo "Backup directory: $BACKUP"
echo "Next (optional) check: grep -n 'owner-management-v59' '$ENTRY'"
echo "DEPLOY only the four new staging functions after reviewing owner claims and schema:"
echo "firebase deploy --project $PROJECT --only functions:ownerGetCustomerManageState,functions:ownerGrantVideoCredits,functions:ownerUpdateCustomerExpiry,functions:ownerGetCustomerAdjustmentHistory"
echo
echo "NOTE: Owner Customers UI still needs manual integration in the separate Owner Hosting source."
