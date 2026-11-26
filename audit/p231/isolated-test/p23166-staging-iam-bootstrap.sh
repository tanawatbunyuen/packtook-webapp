#!/usr/bin/env bash
# PACKTOOK P231.66 — Staging-only, narrowly gated IAM bootstrap.
# Default is read-only. Apply requires an exact explicit confirmation.
set -euo pipefail
set +x

PROJECT='packtook-staging'
ID='p231-appcheck-probe'
SA="${ID}@${PROJECT}.iam.gserviceaccount.com"
ROLE='roles/firebaseappcheck.tokenVerifier'
MODE="${1:-plan}"
CONFIRM='APPROVE_P231_STAGING_SA_AND_VERIFIER_ONLY'

case "$MODE" in
  plan|apply) ;;
  *) echo 'P231_GATE=BLOCKED_INVALID_MODE'; exit 2;;
esac

echo "P231_MODE=$MODE"
echo "P231_PROJECT=$PROJECT"
echo "P231_SERVICE_ACCOUNT=$SA"
echo "P231_REQUESTED_ROLE=$ROLE"
echo 'P231_SCOPE=STAGING_ONLY_NO_DEPLOY'

command -v gcloud >/dev/null || { echo 'P231_GATE=BLOCKED_GCLOUD_MISSING'; exit 2; }

# Fail closed when the exact intended project is not accessible.
CHECK="$(gcloud projects describe "$PROJECT" --format='value(projectId)' 2>/dev/null)" || {
  echo 'P231_GATE=BLOCKED_PROJECT_ACCESS'; exit 2;
}
[[ "$CHECK" == "$PROJECT" ]] || { echo 'P231_GATE=BLOCKED_PROJECT_MISMATCH'; exit 2; }

# This script intentionally refuses to modify an existing identity.
if gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
  echo 'P231_SA_ALREADY_EXISTS=YES'
  echo 'P231_GATE=BLOCKED_EXISTING_IDENTITY_REQUIRES_REVIEW'
  exit 2
fi
echo 'P231_SA_ALREADY_EXISTS=NO'

if [[ "$MODE" == 'plan' ]]; then
  echo 'P231_CHANGE_1=CREATE_DEDICATED_SA'
  echo 'P231_CHANGE_2=GRANT_APPCHECK_TOKEN_VERIFIER_TO_NEW_SA'
  echo 'P231_PLAN_WRITES=0'
  echo 'P231_GATE=AWAITING_EXPLICIT_STAGING_IAM_APPROVAL'
  echo 'P231_ISOLATED_DEPLOY=NOT_PERFORMED'
  echo 'P231_RELEASE=NO_GO'
  exit 0
fi

if [[ "${P231_EXPLICIT_APPROVAL:-}" != "$CONFIRM" ]]; then
  echo 'P231_GATE=BLOCKED_EXPLICIT_APPROVAL_MISSING'
  exit 2
fi

# No deployment, no keys, no Firestore grants, no invoker changes.
gcloud iam service-accounts create "$ID" \
  --project="$PROJECT" \
  --display-name='P231 App Check isolated probe runtime' \
  --quiet >/dev/null
echo 'P231_SA_CREATED=YES'

# The principal is the newly created runtime identity only.
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$SA" \
  --role="$ROLE" \
  --condition=None \
  --quiet >/dev/null
echo 'P231_TOKEN_VERIFIER_BINDING_REQUESTED=YES'

# Verify the direct binding; do not infer effective permission from it.
POLICY="$(gcloud projects get-iam-policy "$PROJECT" --format=json)"
if printf '%s' "$POLICY" | jq -e --arg member "serviceAccount:$SA" \
  --arg role "$ROLE" \
  'any(.bindings[]?; .role==$role and (.members // [] | index($member)) and (.condition == null))' \
  >/dev/null; then
  echo 'P231_DIRECT_VERIFIER_BINDING=PASS'
else
  echo 'P231_DIRECT_VERIFIER_BINDING=NOT_CONFIRMED'
  exit 3
fi
echo 'P231_IAM_CHANGE=STAGING_DEDICATED_IDENTITY_ONLY'
echo 'P231_INVOKER_POLICY=NOT_CHANGED'
echo 'P231_ISOLATED_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
