#!/usr/bin/env bash
# PACKTOOK V7.2 — explicitly gated IAM_RUNTIME_ONLY provisioning.
# --dry-run: read-only. --execute: creates ONE custom role and TWO scoped bindings.
# DOES NOT grant deployer impersonation; no Functions deployment or Public/Pilot changes.
set -Eeuo pipefail
set +x
umask 077
PROJECT="packtook-prod-01"
BRANCH="feature/v7.2-controlled-public-pilot-readiness"
SA="packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com"
MEMBER="serviceAccount:$SA"
ROLE_ID="packtookV72Runtime"
ROLE="projects/$PROJECT/roles/$ROLE_ID"
SECRET="PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX"
PERMISSIONS="datastore.databases.get,datastore.entities.get,datastore.entities.create,datastore.entities.update,firebaseauth.users.get,firebaseauth.users.update"
MODE="${1:-}"
[[ "$MODE" == "--dry-run" || "$MODE" == "--execute" ]] || { echo "USAGE: bash scripts/v72-provision-runtime-iam.sh --dry-run|--execute"; exit 2; }
cd "$(dirname "$0")/.."
[[ "$(git branch --show-current)" == "$BRANCH" ]] || { echo "BLOCKED: wrong branch"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo "BLOCKED: dirty working tree"; exit 2; }
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] || { echo "BLOCKED: wrong active GCP project"; exit 2; }
node --check scripts/test-v72-iam-validation.mjs
node scripts/test-v72-iam-validation.mjs >/dev/null
echo "=== FRESH NO-WRITE PREFLIGHT (must pass, remain NO_GO) ==="
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
node scripts/v72-dedicated-sa-preflight.mjs "$PROJECT" > "$TMP/preflight.txt"
node - "$TMP/preflight.txt" <<'NODE'
const fs=require("fs");
const raw=fs.readFileSync(process.argv[2],"utf8");
const o=JSON.parse(raw.slice(raw.indexOf("{"),raw.lastIndexOf("}")+1));
const ok=o.project==="packtook-prod-01" &&
o.phase==="DEDICATED_SA_EXISTS_PERMISSIONS_AND_DEPLOY_REVIEW_REQUIRED" &&
o.source?.fourFunctionBindingVerified===true && o.source?.betaSharedOptionsUnchanged===true &&
o.secret?.hasEnabledVersion===true &&
o.account?.resourcePresent===true && o.account?.active===true &&
o.publicProbe?.closed===true && o.publicProbe?.explicitEnabledSeen===false &&
o.publicProbe?.marketingHttp===200 && o.publicProbe?.customerHttp===200 &&
o.publicProbe?.statusHttp===200 && o.publicProbe?.publicSignupEnabled===false &&
o.publicProbe?.publicAccessEnabled===false && o.decision==="NO_GO_CONTROLLED_PILOT" &&
Array.isArray(o.errors)&&o.errors.length===0;
if(!ok){console.error("BLOCKED: preflight did not prove SAFE OFF + ACTIVE SA");process.exit(3)}
console.log("PASS: source/secret/account/Public OFF verified; NO_GO retained");
NODE
echo "=== CHECK EXACT ROLE ABSENCE ==="
if gcloud iam roles describe "$ROLE_ID" --project="$PROJECT" --format=json >"$TMP/role.json" 2>"$TMP/role.err"; then
 echo "BLOCKED: custom role already exists; manual reconciliation needed"; exit 2
fi
if ! grep -Eqi '(NOT_FOUND|not found|404)' "$TMP/role.err"; then
 echo "BLOCKED: role absence not proven (e.g. permission/API error)"; exit 2
fi
gcloud projects get-iam-policy "$PROJECT" --format=json > "$TMP/project-policy.json"
gcloud secrets get-iam-policy "$SECRET" --project="$PROJECT" --format=json > "$TMP/secret-policy.json"
node - "$TMP/project-policy.json" "$TMP/secret-policy.json" "$MEMBER" <<'NODE'
const fs=require("fs");
const [proj,secret,member]=process.argv.slice(2);
for(const [label,path] of [["PROJECT",proj],["SECRET",secret]]){
const policy=JSON.parse(fs.readFileSync(path,"utf8"));
if((policy.bindings||[]).some(b=>(b.members||[]).includes(member))){
 console.error("BLOCKED: existing "+label+" grant needs manual review");process.exit(3);
}
}
console.log("PASS: no direct PROJECT or SECRET bindings found for dedicated SA");
NODE
if [[ "$MODE" == "--dry-run" ]]; then
 echo "DRY_RUN_PASS: proposed create $ROLE (six scoped permissions), project binding to dedicated runtime, single-Secret accessor binding."
 echo "NO CHANGES, NO DEPLOY, NO PILOT; deployer binding excluded."
 exit 0
fi
echo "This changes PRODUCTION IAM: create custom role + project binding + one Secret binding."
echo "No IAM change implies Pilot approval; Public and Pilot must remain OFF."
read -r -p 'Type APPROVE-PACKTOOK-V72-RUNTIME-IAM to execute: ' APPROVE
[[ "$APPROVE" == "APPROVE-PACKTOOK-V72-RUNTIME-IAM" ]] || { echo "CANCELLED"; exit 2; }
echo "=== CREATE CUSTOM ROLE ==="
gcloud iam roles create "$ROLE_ID" --project="$PROJECT" \
 --title="PACKTOOK V7.2 Restricted Runtime" \
 --description="Dedicated V7.2 Public Pilot Auth and Firestore runtime" \
 --permissions="$PERMISSIONS" --stage=ALPHA >/dev/null
echo "ROLE_CREATED"
echo "=== PROJECT CUSTOM ROLE BINDING ==="
gcloud projects add-iam-policy-binding "$PROJECT" \
 --member="$MEMBER" --role="$ROLE" --quiet >/dev/null
echo "PROJECT_RUNTIME_ROLE_BOUND"
echo "=== SINGLE SECRET ACCESSOR BINDING ==="
gcloud secrets add-iam-policy-binding "$SECRET" --project="$PROJECT" \
 --member="$MEMBER" --role="roles/secretmanager.secretAccessor" --quiet >/dev/null
echo "SECRET_RUNTIME_ROLE_BOUND"
echo "=== POST-WRITE READBACK ==="
gcloud iam roles describe "$ROLE_ID" --project="$PROJECT" --format="value(name)"
gcloud projects get-iam-policy "$PROJECT" --flatten="bindings[].members" \
 --filter="bindings.members=$MEMBER" --format="table(bindings.role)"
gcloud secrets get-iam-policy "$SECRET" --project="$PROJECT" \
 --flatten="bindings[].members" --filter="bindings.members=$MEMBER" --format="table(bindings.role)"
echo "DONE: IAM_RUNTIME_ONLY changed; no deployer binding, no deploy, no Pilot activation."
echo "DECISION: NO_GO_CONTROLLED_PILOT"
