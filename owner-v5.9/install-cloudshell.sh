#!/usr/bin/env bash
# PACKTOOK Owner V5.9 installer. Run FROM the existing OWNER Firebase source directory.
set -Eeuo pipefail
PROJECT="packtook-staging"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "==============================================="
echo "  PACKTOOK V5.9 | Owner Staging ONLY"
echo "==============================================="
if [[ ! -f firebase.json ]]; then
  echo "ERROR: cd to the EXISTING Owner Firebase project root (containing firebase.json)"; exit 1
fi
command -v node >/dev/null || { echo "Missing Node.js"; exit 1; }
command -v firebase >/dev/null || { echo "Missing Firebase CLI. Run: npm install -g firebase-tools"; exit 1; }
python3 - <<'PY'
import json,sys
cfg=json.load(open('firebase.json'))
f=cfg.get('functions')
if not f: sys.exit("ERROR: firebase.json has no functions source. Do NOT initialize a replacement project.")
if isinstance(f,list):
    if len(f)!=1: sys.exit("ERROR: multiple functions codebases. Select a codebase manually before installation.")
    f=f[0]
source=f.get('source','functions') if isinstance(f,dict) else 'functions'
print('FUNCTIONS SOURCE:',source)
open('/tmp/packtook-v59-functions-source','w').write(source)
hosting=cfg.get('hosting')
if not hosting: sys.exit("ERROR: no Hosting configuration in firebase.json.")
hs=hosting if isinstance(hosting,list) else [hosting]
owner=[h for h in hs if h.get('target')=='owner' or h.get('site')=='packtook-owner-staging']
if len(owner)!=1:
    sys.exit("ERROR: Owner Hosting config ambiguous. Expected target=owner or site=packtook-owner-staging. No changes made.")
h=owner[0]
public=h.get('public')
if not public: sys.exit("ERROR: Hosting public dir not found (build output must be generated first).")
print('OWNER HOSTING PUBLIC:',public)
print('OWNER HOSTING TARGET:',h.get('target','(site direct)'))
open('/tmp/packtook-v59-hosting-public','w').write(public)
open('/tmp/packtook-v59-hosting-target','w').write(h.get('target',''))
PY
FN_SRC="$(cat /tmp/packtook-v59-functions-source)"
WEB_SRC="$(cat /tmp/packtook-v59-hosting-public)"
[[ -d "$FN_SRC" ]] || { echo "Missing $FN_SRC"; exit 1; }
[[ -f "$FN_SRC/package.json" ]] || { echo "Missing $FN_SRC/package.json"; exit 1; }
ENTRY="$(node -e "console.log(require('./$FN_SRC/package.json').main||'index.js')")"
if [[ "$(node -e "console.log(require('./$FN_SRC/package.json').type||'commonjs')")" == "module" ]]; then
  echo "ERROR: ESM functions project. This installer requires CommonJS and intentionally did not modify your files."; exit 1
fi
if [[ "$ENTRY" == lib/* || "$ENTRY" == dist/* ]]; then
  echo "ERROR: Compiled functions entrypoint detected: $ENTRY. Integrate in source and rebuild; no files changed."; exit 1
fi
[[ -f "$FN_SRC/$ENTRY" ]] || { echo "ERROR: Cannot find functions entrypoint $FN_SRC/$ENTRY"; exit 1; }
[[ -d "$WEB_SRC" && -f "$WEB_SRC/index.html" ]] || { echo "ERROR: Owner HTML absent in $WEB_SRC. Run your existing frontend build first."; exit 1; }
echo
echo "Checking required dependencies..."
(cd "$FN_SRC" && node -e "require.resolve('firebase-admin');require.resolve('firebase-functions/v2/https')") || {
  echo "ERROR: Dependencies missing in $FN_SRC. Install compatible firebase-admin and firebase-functions first."; exit 1;
}
echo
echo "FIRESTORE MAPPING: use the fields that the CUSTOMER recorder and renewal webhook ACTUALLY READ."
echo "No example defaults are accepted. Enter carefully."
read -r -p "Customer credit DOCUMENT e.g. wallets/{uid}: " CREDIT_DOC
read -r -p "Remaining credits FIELD e.g. remaining: " REMAINING_FIELD
read -r -p "Customer expiry DOCUMENT: " EXPIRY_DOC
read -r -p "Package expiry FIELD: " EXPIRY_FIELD
read -r -p "Plan DOCUMENT: " PLAN_DOC
read -r -p "Plan FIELD: " PLAN_FIELD
read -r -p "Expiry storage [timestamp/iso/milliseconds]: " EXPIRY_STORAGE
export CREDIT_DOC REMAINING_FIELD EXPIRY_DOC EXPIRY_FIELD PLAN_DOC PLAN_FIELD EXPIRY_STORAGE
node - <<'JS'
const p=process.env;
const ds=['CREDIT_DOC','EXPIRY_DOC','PLAN_DOC'],fs=['REMAINING_FIELD','EXPIRY_FIELD','PLAN_FIELD'];
for(const k of ds){
  const v=p[k];
  if(!v||!v.includes('{uid}')||v.replace('{uid}','test').split('/').length%2)throw new Error('Invalid document path: '+k);
}
for(const k of fs)if(!/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(p[k]||''))throw new Error('Invalid field: '+k);
if(!['timestamp','iso','milliseconds'].includes(p.EXPIRY_STORAGE))throw new Error('Invalid expiry storage');
JS
echo
echo "Review mapping BEFORE writing:"
printf "  Credit : %s   -> %s\n" "$CREDIT_DOC" "$REMAINING_FIELD"
printf "  Expiry : %s   -> %s (%s)\n" "$EXPIRY_DOC" "$EXPIRY_FIELD" "$EXPIRY_STORAGE"
printf "  Plan   : %s   -> %s\n" "$PLAN_DOC" "$PLAN_FIELD"
read -r -p "Mapping verified against actual customer code? Type YES: " APPROVE
[[ "$APPROVE" == "YES" ]] || { echo "Cancelled. No changes made."; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PWD/.packtook-v59-backup-$STAMP"
mkdir -p "$BACKUP"
cp "$FN_SRC/$ENTRY" "$BACKUP/functions-entry.js"
[[ ! -f "$FN_SRC/.env.$PROJECT" ]] || cp "$FN_SRC/.env.$PROJECT" "$BACKUP/functions-env"
cp "$WEB_SRC/index.html" "$BACKUP/owner-index.html"
echo "Backups: $BACKUP"
cp "$HERE/functions/owner-management-v59.js" "$FN_SRC/owner-management-v59.js"
node --check "$FN_SRC/owner-management-v59.js"
if ! grep -Fq "require('./owner-management-v59')" "$FN_SRC/$ENTRY"; then
  printf "\n// PACKTOOK Owner V5.9: preserve existing functions\nObject.assign(module.exports, require('./owner-management-v59'));\n" >> "$FN_SRC/$ENTRY"
fi
node --check "$FN_SRC/$ENTRY"
python3 - "$FN_SRC/.env.$PROJECT" <<'PY'
import os,sys
path=sys.argv[1]
p={
'PACKTOOK_CREDIT_DOC':os.environ['CREDIT_DOC'],
'PACKTOOK_REMAINING_FIELD':os.environ['REMAINING_FIELD'],
'PACKTOOK_EXPIRY_DOC':os.environ['EXPIRY_DOC'],
'PACKTOOK_EXPIRY_FIELD':os.environ['EXPIRY_FIELD'],
'PACKTOOK_PLAN_DOC':os.environ['PLAN_DOC'],
'PACKTOOK_PLAN_FIELD':os.environ['PLAN_FIELD'],
'PACKTOOK_EXPIRY_STORAGE':os.environ['EXPIRY_STORAGE']
}
lines=open(path).read().splitlines() if os.path.exists(path) else []
lines=[x for x in lines if x.split('=',1)[0] not in p]
lines.extend(k+'='+v for k,v in p.items())
open(path,'w').write('\n'.join(lines)+'\n')
PY
cp "$HERE/owner-management-v59.js" "$WEB_SRC/owner-management-v59.js"
node --input-type=module --check < "$WEB_SRC/owner-management-v59.js"
python3 - "$WEB_SRC/index.html" <<'PY'
import sys
p=sys.argv[1]
s=open(p).read()
tag='<script type="module" src="/owner-management-v59.js"></script>'
if tag not in s:
    if '</body>' not in s: sys.exit('ERROR: cannot locate </body> in Owner HTML; attach script manually.')
    s=s.replace('</body>',tag+'\n</body>')
    open(p,'w').write(s)
PY
echo
echo "==============================================="
echo " V5.9 files copied. No deploy performed yet."
echo " Functions: $FN_SRC"
echo " Owner HTML: $WEB_SRC/index.html"
echo "==============================================="
echo
echo "IMPORTANT: Add a Manage button INSIDE your existing V5.8 customers table renderer."
echo "Use instructions: $HERE/README.md"
echo "The script only loads the UI module; the existing table still needs a customer UID + Firebase call adapter."
echo
echo "Step 1: Deploy the 4 new functions (STAGING ONLY):"
echo "firebase deploy --project $PROJECT --only functions:ownerGetCustomerManageState,functions:ownerGrantVideoCredits,functions:ownerUpdateCustomerExpiry,functions:ownerGetCustomerAdjustmentHistory"
echo
echo "Step 2: Once customer Manage buttons are wired and your FRONTEND BUILD is current:"
TARGET="$(cat /tmp/packtook-v59-hosting-target)"
if [[ "$TARGET" == "owner" ]]; then
  echo "firebase deploy --project $PROJECT --only hosting:owner"
else
  echo "firebase deploy --project $PROJECT --only hosting"
  echo "WARNING: inspect firebase.json first; this may deploy other Hosting sites."
fi
echo
echo "Do NOT run plain 'firebase deploy'. Do NOT deploy Production."
