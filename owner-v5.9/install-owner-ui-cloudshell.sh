#!/usr/bin/env bash
# PACKTOOK Owner V5.9 frontend installer, staging only. Run in existing repo root.
set -Eeuo pipefail
PROJECT="packtook-staging"
PATCH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$PWD"
fail(){ echo "ERROR: $*" >&2; exit 1; }

[[ -f firebase.json ]] || fail "Run from your existing ~/packtook-webapp directory, with firebase.json"
command -v git >/dev/null || fail "Git is required"
command -v node >/dev/null || fail "Node.js is required"
command -v python3 >/dev/null || fail "Python 3 is required"

echo "PACKTOOK V5.9 Owner UI installer | STAGING ONLY"
echo "No backend or customer Hosting changes will be made."

# Verify this owner frontend is from the known V5.8 source before overwriting.
echo "Fetching V5.8 reference for safe comparison..."
git -C "$PATCH_ROOT" fetch --quiet --depth=1 origin feature/firebase-auth-credits-v4
OLD_COUNT=0; MISSING_COUNT=0
for file in app.js index.html style.css; do
  original="owner-dashboard/$file"
  if [[ -f "$original" ]]; then
    OLD_COUNT=$((OLD_COUNT+1))
    if ! cmp -s "$original" <(git -C "$PATCH_ROOT" show FETCH_HEAD:"$original"); then
      echo "Local file differs from committed V5.8: $original" >&2
      echo "Installation stopped to prevent overwriting your Owner edits." >&2
      echo "Please preserve your changes and perform a three-way merge." >&2
      exit 1
    fi
  else
    MISSING_COUNT=$((MISSING_COUNT+1))
  fi
done
if [[ "$OLD_COUNT" -ne 0 && "$MISSING_COUNT" -ne 0 ]]; then
  fail "Partial Owner source detected. Restore the missing V5.8 files before patching."
fi

if [[ -f owner-dashboard/owner-management-v59.js ]] && ! cmp -s owner-dashboard/owner-management-v59.js "$PATCH_ROOT/owner-dashboard/owner-management-v59.js"; then
  fail "Existing V5.9 frontend module differs from this patch. Stopped to avoid overwrite."
fi

if [[ -f firebase.owner.json ]]; then
  python3 - <<'PY'
import json,sys
config=json.load(open("firebase.owner.json"))
hosting=config.get("hosting")
if not isinstance(hosting,dict) or hosting.get("target")!="owner" or hosting.get("public")!="owner-dashboard":
    sys.exit("ERROR: firebase.owner.json does not point exclusively to Owner Hosting.")
PY
else
  [[ -f "$PATCH_ROOT/firebase.owner.json" ]] || fail "Patch missing firebase.owner.json"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.packtook-owner-v59-backup-$STAMP"
mkdir -p "$BACKUP"
if [[ -d owner-dashboard ]]; then cp -a owner-dashboard "$BACKUP/"; fi
if [[ -f firebase.owner.json ]]; then cp firebase.owner.json "$BACKUP/"; fi
echo "Original Owner files backed up at: $BACKUP"

mkdir -p owner-dashboard
# When the owner folder does not exist locally, initialize it from the reviewed source.
for file in firebase-config.js logo.svg; do
  if [[ ! -f "owner-dashboard/$file" ]]; then
    cp "$PATCH_ROOT/owner-dashboard/$file" "owner-dashboard/$file"
  fi
done
for file in app.js index.html style.css owner-management-v59.js; do
  cp "$PATCH_ROOT/owner-dashboard/$file" "owner-dashboard/$file"
done
if [[ ! -f firebase.owner.json ]]; then cp "$PATCH_ROOT/firebase.owner.json" firebase.owner.json; fi

node --input-type=module --check < owner-dashboard/app.js
node --input-type=module --check < owner-dashboard/owner-management-v59.js
python3 - <<'PY'
from pathlib import Path
html=Path("owner-dashboard/index.html").read_text()
app=Path("owner-dashboard/app.js").read_text()
assert "จัดการ</th>" in html and 'colspan="9"' in html
assert "owner-management-v59.js" in app and 'customerUid:a.accountId' in app
print("Static checks passed: Manage column, customer UID and Owner integration")
PY

echo
echo "V5.9 Owner frontend source ready. Deployment has NOT been run."
echo "Review changes, then run ONLY:"
echo "firebase deploy --config firebase.owner.json --project packtook-staging --only hosting:owner"
echo
echo "This deploys Owner HOSTING only. It does not touch Customer Hosting or backend Functions."
