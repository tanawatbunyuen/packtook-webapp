#!/usr/bin/env bash
# P231.96 installs only local isolated preview dependencies. NO cloud writes or deploy.
set -u -o pipefail
set +x
PREVIEW="${1:-}"
EXPECTED='630f6cb016ad21d99663055ba75c55f103b8a5eadf6ae5528bf658ffbc477c81'
echo 'P231_CHECK=PREVIEW_DEPENDENCIES_LOCAL_RECOVERY'
if [ -z "$PREVIEW" ] || [ ! -d "$PREVIEW/p231-function" ]; then
 echo 'P231_PREVIEW=NOT_FOUND';exit 2
fi
if [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" != 22 ];then
 echo 'P231_NODE22=REQUIRED';exit 2
fi
if [ "$(gcloud config get-value project 2>/dev/null)" != 'packtook-staging' ];then
 echo 'P231_ACTIVE_PROJECT=BLOCKED';exit 2
fi
if ! (cd "$PREVIEW/p231-function" && echo "$EXPECTED  package-lock.json" | sha256sum -c - >/dev/null);then
 echo 'P231_LOCK_SHA256=FAIL';exit 2
fi
if ! node - "$PREVIEW" <<'NODE'
const fs=require('fs'),path=require('path');
const d=process.argv[2];
const cfg=JSON.parse(fs.readFileSync(path.join(d,'firebase.json'),'utf8'));
if(!Array.isArray(cfg.functions)||cfg.functions.length!==1||
cfg.functions[0].codebase!=='p231-isolated'||cfg.functions[0].source!=='p231-function')process.exit(2);
const f=fs.readdirSync(path.join(d,'p231-function')).sort();
if(!['index.js,package-lock.json,package.json','index.js,node_modules,package-lock.json,package.json'].includes(f.join(',')))process.exit(2);
NODE
then
 echo 'P231_LOCAL_SOURCE_SCOPE=FAIL';exit 2
fi
(
 cd "$PREVIEW/p231-function" || exit 2
 npm ci --engine-strict --ignore-scripts --no-audit --no-fund || exit 2
 node -e "const m=require('firebase-functions/v2/https');if(typeof m.onCall!=='function')process.exit(2)"
 node --check index.js
)
RC=$?
if [ "$RC" != 0 ];then
 echo 'P231_LOCAL_NPM_CI=FAIL';exit "$RC"
fi
echo 'P231_PREVIEW_FIREBASE_FUNCTIONS=RESOLVES'
echo 'P231_LOCAL_NPM_CI=PASS'
echo 'P231_REDEPLOY=NOT_PERFORMED'
echo 'P231_IAM_WRITES=0'
echo 'P231_CLOUD_DEPLOY_WRITES=0'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
