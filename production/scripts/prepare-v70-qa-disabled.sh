#!/usr/bin/env bash
# PACKTOOK V7.0 — READ-ONLY Production QA-disabled readiness and audit record.
# No Firebase deploy, no env modification, no Auth/Firestore writes.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"
PROJECT="packtook-prod-01"
BRANCH="feature/v7.0-controlled-free-signup-qa"
if [[ "$#" -ne 2 || "$1" != "$PROJECT" || "$2" != "--qa-off" ]]; then
 echo "Usage: bash scripts/prepare-v70-qa-disabled.sh packtook-prod-01 --qa-off" >&2
 exit 2
fi
command -v git >/dev/null || { echo "SAFETY BLOCK: git missing" >&2;exit 2; }
command -v firebase >/dev/null || { echo "SAFETY BLOCK: firebase CLI missing" >&2;exit 2; }
[[ "$(git -C "$REPO" branch --show-current)" == "$BRANCH" ]] || {
 echo "SAFETY BLOCK: must be on the V7 controlled QA feature branch" >&2;exit 2; }
if ! git -C "$REPO" diff --quiet || ! git -C "$REPO" diff --cached --quiet; then
 echo "SAFETY BLOCK: tracked local changes; review before preparing Production deploy" >&2;exit 2
fi
# All gates run before capturing any remote Production metadata.
node scripts/verify.mjs "$PROJECT"
node scripts/test-v70-qa-source-safety.mjs
node scripts/test-v70-qa-preflight.mjs
node scripts/test-v70-deploy-scope.mjs
node scripts/check-v70-qa-preflight.mjs "$PROJECT" --qa-off
node scripts/test-public-registration.mjs
node scripts/test-public-launch-preflight.mjs
node scripts/test-appcheck-readiness.mjs
echo "PASS: local V7 QA-disabled safety checks (no deploy)"
# Save only non-secret metadata. Do not read or print Firebase .env, tokens,
# emails, UIDs, application configuration or service account files.
umask 077
RECORD_DIR="$HOME/packtook-rollout-records"
mkdir -p -m 700 "$RECORD_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RECORD="$RECORD_DIR/v70-qa-off-$STAMP"
{
 echo "PACKTOOK V7 QA-disabled pre-deploy read-only evidence"
 echo "UTC: $STAMP"
 echo "Project: $PROJECT"
 echo "Branch: $BRANCH"
 echo "Local source commit (NOT proof of prior deployed SHA): $(git -C "$REPO" rev-parse HEAD)"
 echo "Firebase CLI: $(firebase --version)"
 echo "Existing deployed Firebase Functions (read-only):"
 firebase functions:list --project "$PROJECT"
} > "$RECORD.functions.txt" 2>&1 || {
 echo "BLOCK: could not capture read-only deployed functions list. See $RECORD.functions.txt" >&2
 exit 2
}
if ! node scripts/probe-free-deployment.mjs "$PROJECT" --expect-v66 --json > "$RECORD.http.json"; then
 echo "BLOCK: HTTP status probe failed. See $RECORD.http.json" >&2
 exit 2
fi
echo "PASS: read-only QA-disabled readiness and Production HTTP probe"
echo "Audit records (mode 600): $RECORD.functions.txt and $RECORD.http.json"
echo "STOP: no Production functions changed. Verify a known-good deployed Beta source/revision for rollback."
echo "Next command is a SEPARATE human-approved mutating deployment only after rollback review:"
echo "  bash scripts/deploy-v70-qa-controlled.sh packtook-prod-01 --qa-off"
