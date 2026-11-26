#!/usr/bin/env bash
# P231.90 — Read-only CLI and deployment-input sanity check.
# No firebase deploy, cloud IAM modification, credential output, or invocation.
set -u -o pipefail
set +x
PROJECT='packtook-staging'
DIR="${1:-}"
echo 'P231_CHECK=CLI_AND_DEPLOYMENT_ARTIFACT_READONLY'

if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
 echo 'P231_PREVIEW_DIRECTORY=NOT_FOUND'; exit 2
fi
if ! command -v firebase >/dev/null 2>&1; then
 echo 'P231_FIREBASE_CLI=NOT_INSTALLED'; exit 2
fi
CLI="$(firebase --version 2>/dev/null)"
if [ -z "$CLI" ]; then
 echo 'P231_FIREBASE_CLI=NOT_READABLE'; exit 2
fi
echo "P231_FIREBASE_CLI_VERSION=$CLI"

# Check CLI syntax without running a deployment.
HELP="$(firebase deploy --help 2>/dev/null)"
if ! printf '%s' "$HELP" | grep -q -- '--only'; then
 echo 'P231_FIREBASE_ONLY_FILTER=NOT_CONFIRMED'; exit 2
fi
echo 'P231_FIREBASE_ONLY_FILTER=SUPPORTED'

if ! node - "$DIR" <<'NODE'
const fs=require('fs'),path=require('path');
const dir=process.argv[2];
const cfg=JSON.parse(fs.readFileSync(path.join(dir,'firebase.json'),'utf8'));
const obj=cfg.functions;
if(!Array.isArray(obj)||obj.length!==1||
   obj[0].source!=='p231-function'||obj[0].codebase!=='p231-isolated')process.exit(2);
const source=fs.readFileSync(path.join(dir,'p231-function','index.js'),'utf8');
const matches=[...source.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g)].map(m=>m[1]);
if(matches.length!==1||matches[0]!=='p231AppCheckIsolatedProbe')process.exit(2);
const files=fs.readdirSync(path.join(dir,'p231-function')).sort();
if(files.join(',')!==['index.js','package-lock.json','package.json'].join(','))process.exit(2);
console.log('P231_FUNCTION_EXPORT_COUNT=1');
console.log('P231_ISOLATED_CODEBASE=PASS');
console.log('P231_SOURCE_WHITELIST=PASS');
NODE
then
 echo 'P231_CONFIG_SCOPE=FAIL'; exit 2
fi

echo "P231_TARGET_PROJECT=$PROJECT"
echo 'P231_EXACT_SELECTOR=functions:p231-isolated:p231AppCheckIsolatedProbe'
echo 'P231_SELECTOR_SEMANTICS=NEEDS_CLI_VERSION_SPECIFIC_REVIEW'
echo 'P231_PRIVATE_INVOKER_PRINCIPAL=NOT_SELECTED'
echo 'P231_CLEANUP_TIMEBOX=NOT_APPROVED'
echo 'P231_GOOGLE_CLOUD_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
