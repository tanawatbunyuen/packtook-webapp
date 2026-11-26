#!/usr/bin/env bash
# P231.85 — build an isolated deploy artifact in a temporary directory.
# NO firebase deploy, NO IAM writes, NO service calls, NO Git writes.
set -u -o pipefail
set +x
REPO="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 2
SOURCE="$REPO/audit/p231/isolated-test"
EXPECTED='630f6cb016ad21d99663055ba75c55f103b8a5eadf6ae5528bf658ffbc477c81'
echo 'P231_CHECK=ISOLATED_DEPLOY_ARTIFACT_PREVIEW'
if [ "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]; then
  echo 'P231_NODE22=FAIL'; exit 2
fi
echo 'P231_NODE22=PASS'
if ! (cd "$SOURCE" && echo "$EXPECTED  package-lock.json" | sha256sum -c - >/dev/null); then
  echo 'P231_SOURCE_LOCKFILE_SHA256=FAIL'; exit 2
fi
echo 'P231_SOURCE_LOCKFILE_SHA256=PASS'
if ! (cd "$SOURCE" && node --check index.js && node --test test.cjs >/dev/null && node p23172-package-preflight.cjs >/dev/null && node p23179-verify-nested-lockfile.cjs >/dev/null); then
  echo 'P231_SOURCE_PRECHECK=FAIL'; exit 2
fi
echo 'P231_SOURCE_PRECHECK=PASS'

STAGING_DIR="$(mktemp -d)"
# Only whitelist deploy files; no root project functions or app code.
mkdir -p "$STAGING_DIR/p231-function"
cp "$SOURCE/index.js" "$SOURCE/package.json" "$SOURCE/package-lock.json" "$STAGING_DIR/p231-function/"
cat > "$STAGING_DIR/firebase.json" <<'JSON'
{
  "functions": [
    {
      "source": "p231-function",
      "codebase": "p231-isolated",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"]
    }
  ]
}
JSON
node - "$STAGING_DIR" <<'NODE'
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2];
const cfg=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'),'utf8'));
const opts=cfg.functions;
if(!Array.isArray(opts)||opts.length!==1||opts[0].codebase!=='p231-isolated'||opts[0].source!=='p231-function')process.exit(2);
const payload=fs.readdirSync(path.join(root,'p231-function')).sort();
if(payload.join(',')!=='index.js,package-lock.json,package.json')process.exit(2);
console.log('P231_ISOLATED_CODEBASE=PASS');
console.log('P231_DEPLOY_FILE_WHITELIST=PASS');
const src=fs.readFileSync(path.join(root,'p231-function','index.js'),'utf8');
if(!src.includes("invoker:'private'")||!src.includes('enforceAppCheck:true')||!src.includes("serviceAccount:'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com'"))process.exit(2);
console.log('P231_PRIVATE_OPTIONS=PASS');
NODE
RC=$?
if [ "$RC" -ne 0 ]; then
  echo 'P231_DEPLOY_PREVIEW=FAIL'
  rm -rf "$STAGING_DIR"
  exit 2
fi

# Preview only: leave files for manual security inspection and future approved execution.
echo "P231_PREVIEW_DIRECTORY=$STAGING_DIR"
echo 'P231_FIREBASE_CONFIG=ISOLATED_SINGLE_CODEBASE'
echo 'P231_DEPLOY_COMMAND=NOT_EXECUTED'
echo 'P231_OPERATOR_INVOKER_GRANT=NOT_PERFORMED'
echo 'P231_IAM_WRITES=0'
echo 'P231_FIREBASE_WRITES=0'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
