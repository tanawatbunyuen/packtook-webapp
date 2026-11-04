#!/usr/bin/env bash
# PACKTOOK V7.2 — owner-approved Admission-only Production Deployment.
# Only: pilotInvitationStatus and completePilotFreeSignup.
# This file must be deliberately run by a human in Google Cloud Shell.
set -Eeuo pipefail
set +x
umask 077

PROJECT="packtook-prod-01"
REGION="asia-southeast1"
BRANCH="feature/v7.2-controlled-public-pilot-readiness"
SA="packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com"
TARGET="functions:beta:pilotInvitationStatus,functions:beta:completePilotFreeSignup"
MODE="${1:-}"
[[ "$MODE" == "--preflight" || "$MODE" == "--execute" ]] || {
  echo "USAGE: bash scripts/v72-deploy-admission-only.sh --preflight|--execute"
  exit 2
}
cd "$(dirname "$0")/.."
[[ "$(git branch --show-current)" == "$BRANCH" ]] || { echo "BLOCK: wrong branch"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo "BLOCK: dirty worktree"; exit 2; }
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] || { echo "BLOCK: wrong Google Cloud project"; exit 2; }
command -v firebase >/dev/null || { echo "BLOCK: Firebase CLI not installed"; exit 2; }
command -v node >/dev/null || { echo "BLOCK: Node.js not installed"; exit 2; }

echo "=== SOURCE TEST ==="
node --check functions/index.js
node scripts/test-v72-admission-deploy-preflight.mjs
node scripts/test-v72-pilot-deployment-dependencies.mjs

echo "=== FRESH PRODUCTION PREFLIGHT ==="
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
node scripts/v72-admission-deploy-preflight.mjs "$PROJECT" >"$TMP"
node - "$TMP" <<'NODE'
const fs=require("fs");
const raw=fs.readFileSync(process.argv[2],"utf8");
const start=raw.indexOf("{"),end=raw.lastIndexOf("}");
if(start<0||end<start)process.exit(3);
const a=JSON.parse(raw.slice(start,end+1));
const good=a.pass===true&&Array.isArray(a.errors)&&a.errors.length===0&&
 a.decision==="NO_GO_CONTROLLED_PILOT"&&a.publicOff===true&&
 a.identityAndIam?.saActive===true&&
 a.identityAndIam?.customRoleBound===true&&
 a.identityAndIam?.secretAccessorBound===true&&
 a.baseline?.publicSignupStatus?.deployed===true&&
 a.baseline?.publicSignupStatus?.state==="ACTIVE"&&
 a.baseline?.publicSignupStatus?.serviceAccountClass==="LEGACY_COMPUTE"&&
 a.baseline?.publicSignupStatus?.secretBound===false&&
 a.rollback?.admissionFunctionsPreviouslyAbsent===true&&
 a.proposedTargetSelector==="functions:beta:pilotInvitationStatus,functions:beta:completePilotFreeSignup";
console.log(good?"PASS: target, IAM, old status and closed Public verified":
 "BLOCK: admission preflight incomplete");
if(!good)process.exit(3);
NODE

# Inspect only named env flag keys. Never print env-file contents/secrets.
# No known config file may explicitly enable Pilot or Public.
for f in functions/.env functions/.env."$PROJECT" functions/.env.production; do
  if [[ -f "$f" ]]; then
    if grep -Eq '^[[:space:]]*(PACKTOOK_V72_PILOT_ENABLED|PACKTOOK_PUBLIC_SIGNUP_ENABLED|PACKTOOK_PUBLIC_ACCESS_ENABLED|PACKTOOK_PUBLIC_POLICIES_APPROVED|PACKTOOK_V7_QA_ENABLED)[[:space:]]*=[[:space:]]*["\x27]?true' "$f"; then
      echo "BLOCK: an enabled Pilot/Public/QA env flag exists in $f"
      exit 3
    fi
  fi
done
echo "PASS: no enabled Pilot/Public/QA flags in checked local env files"
echo "PLANNED DEPLOY TARGET: $TARGET"
if [[ "$MODE" == "--preflight" ]]; then
  echo "PREFLIGHT_PASS_NO_DEPLOY; DECISION: NO_GO_CONTROLLED_PILOT"
  exit 0
fi

echo "This changes PRODUCTION: deploys exactly two new callable functions in codebase beta."
echo "Existing publicSignupStatus / all Beta recording functions are excluded."
echo "This is NOT authorization to enable Pilot/Public, grant other IAM, or change customer data."
read -r -p 'Type DEPLOY-V72-ADMISSION-ONLY to continue: ' CONFIRM
[[ "$CONFIRM" == "DEPLOY-V72-ADMISSION-ONLY" ]] || { echo "CANCELLED"; exit 2; }

echo "=== DEPLOY EXACTLY TWO FUNCTIONS ==="
firebase deploy --project "$PROJECT" --only "$TARGET"

echo "=== READ-ONLY POST-DEPLOY DESCRIPTION ==="
for fn in pilotInvitationStatus completePilotFreeSignup; do
  gcloud functions describe "$fn" --gen2 --region="$REGION" --project="$PROJECT" --format=json |
    node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const d=JSON.parse(s),c=d.serviceConfig||{};const sa="packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com";const secret=(c.secretEnvironmentVariables||[]).some(v=>v.secret==="PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX");const ok=d.state==="ACTIVE"&&c.serviceAccountEmail===sa&&secret;console.log(JSON.stringify({name:d.name?.split("/").pop(),state:d.state||null,dedicatedRuntime:c.serviceAccountEmail===sa,secretBound:secret,postDeployPass:ok}));if(!ok)process.exitCode=3})'
done

echo "=== EXISTING STATUS CHECK ==="
gcloud functions describe publicSignupStatus --gen2 --region="$REGION" --project="$PROJECT" --format=json |
 node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const d=JSON.parse(s),c=d.serviceConfig||{},legacy="267344264661-compute@developer.gserviceaccount.com";const ok=d.state==="ACTIVE"&&c.serviceAccountEmail===legacy&&(c.secretEnvironmentVariables||[]).length===0;console.log(JSON.stringify({existingStatusActive:d.state==="ACTIVE",unchangedLegacyRuntime:c.serviceAccountEmail===legacy,noSecretBinding:(c.secretEnvironmentVariables||[]).length===0,pass:ok}));if(!ok)process.exitCode=3})'
echo "ADMISSION_ONLY_DEPLOY_COMPLETED; PILOT STILL OFF / NO_GO; runtime negative tests pending"
