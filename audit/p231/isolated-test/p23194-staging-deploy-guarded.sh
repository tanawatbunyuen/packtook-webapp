#!/usr/bin/env bash
# P231.94 — SPECIFIC NEW FUNCTION ONLY, STAGING ONLY.
# Requires explicit operator confirmation; NO default writes.
# Does NOT grant invoker roles or invoke endpoints.
set -u -o pipefail
set +x

PROJECT=packtook-staging
REGION=asia-southeast1
FUNCTION=p231AppCheckIsolatedProbe
SERVICE=p231appcheckisolatedprobe
CODEBASE=p231-isolated
RUNTIME_SA=p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com
EXPECTED_LOCK='630f6cb016ad21d99663055ba75c55f103b8a5eadf6ae5528bf658ffbc477c81'
EXPECTED_CLI='15.34.2'
APPROVAL='APPROVE_P23194_NEW_STAGING_PROBE_ONLY'
DIR="${1:-}"
MODE="${2:-inspect}"
echo 'P231_CHECK=GUARDED_STAGING_ISOLATED_DEPLOY'
echo "P231_MODE=$MODE"
echo "P231_PROJECT=$PROJECT"
echo "P231_FUNCTION=$FUNCTION"
echo "P231_CODEBASE=$CODEBASE"

if [ "$(TZ=Asia/Bangkok date +%F)" != '2026-11-26' ]; then
  echo 'P231_GATE=BLOCKED_OUTSIDE_APPROVED_TEST_DATE'; exit 2
fi
if [ "$MODE" != 'inspect' ] && [ "$MODE" != 'deploy' ]; then
  echo 'P231_GATE=BLOCKED_MODE'; exit 2
fi
if [ ! -d "$DIR" ] || [ ! -f "$DIR/firebase.json" ]; then
  echo 'P231_GATE=BLOCKED_PREVIEW_NOT_FOUND'; exit 2
fi
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ]; then
  echo 'P231_GATE=BLOCKED_ACTIVE_PROJECT'; exit 2
fi
CLI="$(firebase --version 2>/dev/null)" || exit 2
if [ "$CLI" != "$EXPECTED_CLI" ]; then
  echo "P231_GATE=BLOCKED_CLI_VERSION_$CLI"; exit 2
fi
if [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" != '22' ]; then
  echo 'P231_GATE=BLOCKED_NODE_NOT_22'; exit 2
fi
if ! (cd "$DIR/p231-function" && echo "$EXPECTED_LOCK  package-lock.json" | sha256sum -c - >/dev/null); then
  echo 'P231_GATE=BLOCKED_LOCK_SHA256'; exit 2
fi

if ! node - "$DIR" <<'NODE'
const fs=require('fs'),path=require('path');
const d=process.argv[2];
const cfg=JSON.parse(fs.readFileSync(path.join(d,'firebase.json'),'utf8'));
if(Object.keys(cfg).join(',')!=='functions'||!Array.isArray(cfg.functions)||cfg.functions.length!==1||
  cfg.functions[0].source!=='p231-function'||cfg.functions[0].codebase!=='p231-isolated')process.exit(2);
const sourceDir=path.join(d,'p231-function');
if(fs.readdirSync(sourceDir).sort().join(',')!=='index.js,package-lock.json,package.json')process.exit(2);
const src=fs.readFileSync(path.join(sourceDir,'index.js'),'utf8');
const exports=[...src.matchAll(/exports\.([a-zA-Z_$][\w$]*)\s*=/g)].map(m=>m[1]);
const p=JSON.parse(fs.readFileSync(path.join(sourceDir,'package.json'),'utf8'));
if(exports.length!==1||exports[0]!=='p231AppCheckIsolatedProbe'||
!src.includes("invoker:'private'")||!src.includes('enforceAppCheck:true')||
!src.includes("serviceAccount:'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com'")||
p.private!==true||p.engines?.node!=='22')process.exit(2);
console.log('P231_EXACT_SOURCE_SCOPE=PASS');
NODE
then
  echo 'P231_GATE=BLOCKED_SOURCE_SCOPE'; exit 2
fi

# Project function inventory: no invisible/ambiguous state may proceed.
INVENTORY="$(gcloud functions list --v2 --project="$PROJECT" --regions="$REGION" --format='value(name)' 2>/dev/null)"
if [ "$?" -ne 0 ]; then echo 'P231_GATE=BLOCKED_FUNCTION_INVENTORY'; exit 2; fi
if printf '%s\n' "$INVENTORY" | awk -F/ '{print tolower($NF)}' | grep -Fxq 'p231appcheckisolatedprobe'; then
 echo 'P231_GATE=BLOCKED_FUNCTION_ALREADY_EXISTS'; exit 2
fi
if gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(metadata.name)' >/dev/null 2>&1; then
 echo 'P231_GATE=BLOCKED_SERVICE_ALREADY_EXISTS'; exit 2
fi
echo 'P231_NEW_FUNCTION_COLLISION=NO'
echo 'P231_NEW_SERVICE_COLLISION=NO'

if ! gcloud iam service-accounts describe "$RUNTIME_SA" --project="$PROJECT" --format='value(email)' >/dev/null 2>&1; then
 echo 'P231_GATE=BLOCKED_RUNTIME_SA'; exit 2
fi

if [ "$MODE" = 'inspect' ]; then
 echo 'P231_GATE=INSPECTION_PASS_NOT_DEPLOYED'
 echo 'P231_DEPLOY=NOT_PERFORMED'
 echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
 echo 'P231_RELEASE=NO_GO'
 exit 0
fi

if [ "${P231_DEPLOY_CONFIRM:-}" != "$APPROVAL" ]; then
 echo 'P231_GATE=BLOCKED_EXPLICIT_CONFIRMATION'; exit 2
fi
echo 'P231_DEPLOY_START=AUTHORIZED_NEW_STAGING_FUNCTION'
# Noninteractive, strictly filtered deploy; no force and no root functions source.
(
 cd "$DIR" || exit 2
 firebase deploy --project "$PROJECT" \
   --only "functions:$CODEBASE:$FUNCTION" --non-interactive
)
RC=$?
if [ "$RC" -ne 0 ]; then
 echo 'P231_DEPLOY_COMMAND=FAILED_OR_PARTIAL'
 echo 'P231_POST_FAILURE=READ_ONLY_INVENTORY_REQUIRED'
 echo 'P231_RELEASE=NO_GO'
 exit "$RC"
fi
echo 'P231_DEPLOY_COMMAND=SUCCESS_NEEDS_PRIVATE_IAM_VERIFICATION'
echo 'P231_INVOKER_GRANT=NOT_PERFORMED'
echo 'P231_DO_NOT_INVOKE_UNTIL_PRIVATE_AUDIT=YES'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
