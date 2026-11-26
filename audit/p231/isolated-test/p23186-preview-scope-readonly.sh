#!/usr/bin/env bash
# P231.86 -- local-only proof of isolated deploy preview and cleanup scope.
set -u -o pipefail
set +x
DIR="${1:-}"
echo "P231_CHECK=PREVIEW_SCOPE_AND_CLEANUP_GATE"
if [[ -z "$DIR" || ! -d "$DIR" ]]; then
  echo 'P231_PREVIEW_DIRECTORY=NOT_FOUND'
  exit 2
fi
if [[ ! -f "$DIR/firebase.json" ]]; then
  echo 'P231_FIREBASE_CONFIG=NOT_FOUND'
  exit 2
fi
node - "$DIR" <<'NODE'
const fs=require('node:fs'),path=require('node:path');
const d=process.argv[2];
const cfg=JSON.parse(fs.readFileSync(path.join(d,'firebase.json'),'utf8'));
const codebases=cfg.functions;
const allow=['index.js','package-lock.json','package.json'];
const ok=Array.isArray(codebases)&&codebases.length===1&&
  codebases[0].source==='p231-function'&&codebases[0].codebase==='p231-isolated';
const dir=path.join(d,'p231-function');
const files=fs.readdirSync(dir).sort();
if(!ok||files.join(',')!==allow.sort().join(','))throw Error('Unauthorized codebase or file scope');
const src=fs.readFileSync(path.join(dir,'index.js'),'utf8');
const needed=[
  'exports.p231AppCheckIsolatedProbe=onCall',
  "invoker:'private'",
  "serviceAccount:'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com'",
  'enforceAppCheck:true'
];
if(!needed.every(k=>src.includes(k)))throw Error('Callable configuration drift');
console.log('P231_ISOLATED_SCOPE=PASS');
console.log('P231_FUNCTION_EXPORT=PASS');
console.log('P231_PRIVATE_INVOKER_SOURCE=PASS');
console.log('P231_RUNTIME_SERVICE_ACCOUNT_SOURCE=PASS');
NODE
RC=$?
if [[ "$RC" != 0 ]]; then
 echo 'P231_SCOPE_GATE=FAIL';exit "$RC"
fi
echo 'P231_CLEANUP_TARGET=p231AppCheckIsolatedProbe_ONLY'
echo 'P231_CLEANUP_ACTION=DOCUMENTED_NOT_EXECUTED'
echo 'P231_DEPLOYMENT_APPROVAL=NOT_GIVEN'
echo 'P231_IAM_WRITES=0'
echo 'P231_FIREBASE_WRITES=0'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
