#!/usr/bin/env bash
# PACKTOOK V7.2 — Owner APPROVAL-REQUIRED dedicated SA_ONLY change.
# NOT a Pilot GO. No IAM role/key, Function deploy, billing or policy changes.
# Dry-run: bash scripts/v72-create-dedicated-sa-only.sh packtook-prod-01 --dry-run
# Execute ONLY after separate Owner SA_ONLY permission:
#   bash scripts/v72-create-dedicated-sa-only.sh packtook-prod-01 --execute
set +x
set -Eeuo pipefail
umask 077

PROJECT="packtook-prod-01"
ACCOUNT_ID="packtook-public-pilot-v72"
ACCOUNT="$ACCOUNT_ID@$PROJECT.iam.gserviceaccount.com"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$#" -ne 2 ]] || [[ "$1" != "$PROJECT" ]]; then
  echo "SAFETY BLOCK: exact Production project required" >&2;exit 2
fi
MODE="$2"
if [[ "$MODE" != "--dry-run" && "$MODE" != "--execute" ]]; then
  echo "SAFETY BLOCK: --dry-run or --execute required" >&2;exit 2
fi
for cmd in gcloud node git; do
  command -v "$cmd" >/dev/null 2>&1 ||
    { echo "SAFETY BLOCK: missing $cmd" >&2;exit 2; }
done
[[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" == "feature/v7.2-controlled-public-pilot-readiness" ]] ||
  { echo "SAFETY BLOCK: reviewed V7.2 branch required" >&2;exit 2; }
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] ||
  { echo "SAFETY BLOCK: active gcloud project must match $PROJECT" >&2;exit 2; }

check_account_absent(){
  local output="" result=0
  output="$(gcloud iam service-accounts describe "$ACCOUNT" \
    --project="$PROJECT" --format='value(name)' 2>&1)" || result=$?
  if [[ "$result" -eq 0 ]]; then
    echo "SAFETY BLOCK: proposed account already exists; do not recreate" >&2
    return 2
  fi
  # gcloud sometimes returns PERMISSION_DENIED for a missing SA. Never infer
  # nonexistence from 403; stop for private operator investigation instead.
  if [[ "$output" == *"PERMISSION_DENIED"* ||
        "$output" == *"permission denied"* ||
        "$output" == *"403"* ||
        "$output" == *"UNAUTHENTICATED"* ]]; then
    echo "SAFETY BLOCK: account existence cannot be verified (access denied)" >&2
    return 2
  fi
  if [[ "$output" != *"NOT_FOUND"* && "$output" != *"not found"* ]]; then
    echo "SAFETY BLOCK: SA absence not proved (not necessarily missing)" >&2
    return 2
  fi
  echo "PASS: exact proposed SA not found (read-only metadata)"
}

review_gate(){
  node scripts/v72-sa-only-gate.mjs "$PROJECT" ||
    { echo "SAFETY BLOCK: fresh Public/Secret/SA gate failed" >&2;return 2; }
  check_account_absent
}

echo "PACKTOOK V7.2 DEDICATED SA_ONLY — $MODE"
review_gate
if [[ "$MODE" == "--dry-run" ]]; then
  echo "PASS: SA_ONLY dry-run eligible; no Production changes performed"
  echo "A separate explicit Owner SA_ONLY approval is still required to execute."
  exit 0
fi

echo "Requested action: create only one new Service Account ID $ACCOUNT_ID"
echo "Project: $PROJECT. No IAM grants, no private keys, no Functions deploy."
read -r -p "Type CREATE-PACKTOOK-DEDICATED-SA-ONLY to proceed: " CONFIRM
if [[ "$CONFIRM" != "CREATE-PACKTOOK-DEDICATED-SA-ONLY" ]]; then
  echo "Cancelled: no Production write";exit 2
fi
unset CONFIRM
review_gate

# EXACTLY ONE Production mutation, and it is create-only; no IAM binding.
# The name is deterministic so a concurrent/repeated create fails.
gcloud iam service-accounts create "$ACCOUNT_ID" \
 --project="$PROJECT" --display-name="PACKTOOK Public Pilot V7.2 Runtime" \
 --description="Dedicated runtime for four Public/Pilot callables; no shared Beta functions" \
 --quiet --format='value(email)' >/dev/null

# Google IAM is eventually consistent: a new account may not immediately
# appear in describe. Never re-run --execute if metadata is temporarily stale.
if gcloud iam service-accounts describe "$ACCOUNT" \
 --project="$PROJECT" --format='value(name)' >/dev/null 2>&1; then
  echo "PASS: proposed dedicated Service Account exists (metadata only)"
else
  echo "CHECK REQUIRED: created SA may take time to become visible; do not re-run --execute" >&2
  exit 2
fi
echo "NO IAM ROLES OR KEYS CREATED. NO FUNCTION DEPLOY. Public/Pilot remains OFF."
echo "NEXT: node scripts/v72-dedicated-sa-preflight.mjs $PROJECT"
