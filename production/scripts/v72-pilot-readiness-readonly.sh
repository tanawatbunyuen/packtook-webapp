#!/usr/bin/env bash
# PACKTOOK V7.2 — consolidated no-write Pilot readiness evidence.
# NO IAM changes / NO deploy / NO flag changes / NO pilot activation.
set -Eeuo pipefail
set +x
PROJECT="packtook-prod-01"
BRANCH="feature/v7.2-controlled-public-pilot-readiness"
[[ "${1:-}" == "$PROJECT" ]] || { echo "USAGE: bash scripts/v72-pilot-readiness-readonly.sh packtook-prod-01"; exit 2; }
cd "$(dirname "$0")/.."
[[ "$(git branch --show-current)" == "$BRANCH" ]] || { echo "BLOCKED: unexpected Git branch"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo "BLOCKED: uncommitted changes"; exit 2; }
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] || { echo "BLOCKED: unexpected active Google Cloud project"; exit 2; }
echo "=== V7.2 OFFLINE TESTS ==="
node --check scripts/test-v72-iam-validation.mjs
node scripts/test-v72-iam-validation.mjs
node scripts/test-v72-dedicated-sa-preflight.mjs
node scripts/test-v72-sa-only-approval.mjs
echo "=== V7.2 FRESH READ-ONLY PROBES ==="
node scripts/v72-dedicated-sa-preflight.mjs "$PROJECT"
echo "=== DECISION ==="
echo "SOURCE_AND_CLOUD_METADATA_CHECKS_COMPLETED: true"
echo "CUSTOM_ROLE_SUPPORT_AND_EFFECTIVE_IAM: NOT_VERIFIED"
echo "STAGING_RUNTIME_END_TO_END: NOT_VERIFIED"
echo "PILOT_LEGAL_MONITORING_BILLING_OWNER_APPROVAL: NOT_VERIFIED"
echo "PRODUCTION_MUTATIONS: NONE"
echo "DECISION: NO_GO_CONTROLLED_PILOT"
echo "NEXT: separately approve scoped IAM, staged deployment and capped Pilot launch only after integration and owner gates pass."
