#!/usr/bin/env bash
# PACKTOOK V7.2 — Owner-authorized SECRET_ONLY creation on exact Production.
# This is the ONLY Production mutation in this script. Does not grant IAM,
# deploy, alter flags, access existing payloads, or touch Owner/Beta/Omise.
# Default mode --dry-run is READ ONLY. --execute REQUIRES typed confirmation.
# Use: bash scripts/v72-provision-secret-only.sh packtook-prod-01 --dry-run
#      bash scripts/v72-provision-secret-only.sh packtook-prod-01 --execute
set +x
set -Eeuo pipefail
umask 077
PROD="packtook-prod-01"
SECRET="PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$#" -ne 2 || "$1" != "$PROD" ||
    ( "$2" != "--dry-run" && "$2" != "--execute" ) ]]; then
  echo "SAFETY BLOCK: exact project and --dry-run/--execute required" >&2
  exit 2
fi
MODE="$2"
for cmd in gcloud node python3 git grep; do
  command -v "$cmd" >/dev/null 2>&1 ||
    { echo "SAFETY BLOCK: required command unavailable: $cmd" >&2; exit 2; }
done
[[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" == "feature/v7.2-controlled-public-pilot-readiness" ]] ||
  { echo "SAFETY BLOCK: expected reviewed V7.2 feature branch" >&2; exit 2; }
[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROD" ]] ||
  { echo "SAFETY BLOCK: Cloud Shell active project must be $PROD" >&2; exit 2; }

check_secret_absent(){
  local output="" result=0
  # Never print full gcloud output, which might contain account metadata.
  output="$(gcloud secrets describe "$SECRET" --project="$PROD" \
    --format='value(name)' 2>&1)" || result=$?
  if [[ "$result" -eq 0 ]]; then
    echo "SAFETY BLOCK: named Secret already exists; NEVER overwrite or rotate" >&2
    return 2
  fi
  if [[ "$output" == *"PERMISSION_DENIED"* ||
        "$output" == *"permission denied"* ||
        "$output" == *"403"* ||
        "$output" == *"UNAUTHENTICATED"* ]]; then
    echo "SAFETY BLOCK: Secret metadata access forbidden; do not assume absent" >&2
    return 2
  fi
  if [[ "$output" != *"NOT_FOUND"* ]]; then
    echo "SAFETY BLOCK: Secret absence is not proven" >&2
    return 2
  fi
  echo "PASS: exact HMAC Secret is NOT_FOUND (metadata only)"
}

review_gate(){
  echo "Checking fresh Public OFF, Hosting HTTP, functions and Secret metadata..."
  node scripts/v72-secret-only-gate.mjs "$PROD" ||
    { echo "SAFETY BLOCK: Production read-only gate failed" >&2; return 2; }
  check_secret_absent
}

echo "PACKTOOK V7.2 SECRET_ONLY — $MODE"
review_gate
if [[ "$MODE" == "--dry-run" ]]; then
  echo "PASS: SECRET_ONLY dry-run eligible; zero Production changes performed."
  echo "Approval to create does not include IAM, Functions deploy or Pilot GO."
  exit 0
fi

echo "Scope: create ONLY Secret $SECRET in project $PROD."
echo "Replication: automatic. Random content: 32 bytes encoded as 64 hex characters."
echo "No IAM grants, Functions deployment, public flags, Pilot or payment changes."
read -r -p "Type CREATE-PACKTOOK-HMAC-SECRET-ONLY to execute this one change: " CONFIRM
[[ "$CONFIRM" == "CREATE-PACKTOOK-HMAC-SECRET-ONLY" ]] ||
  { echo "Cancelled; no change performed"; exit 2; }
unset CONFIRM

# Repeat all read-only checks immediately before this one Production mutation.
review_gate

# No plaintext key on argv, terminal, env, files or shell history. The only
# secret bytes travel via an anonymous pipe into gcloud --data-file=-.
# gcloud create fails (no overwrite) if another operator created the Secret.
python3 -c 'import secrets,sys;sys.stdout.write(secrets.token_hex(32))' |
  gcloud secrets create "$SECRET" \
    --project="$PROD" --replication-policy=automatic \
    --data-file=- --quiet --format='value(name)' >/dev/null

# Metadata-only verification; never read or print the Secret version payload.
gcloud secrets describe "$SECRET" --project="$PROD" \
  --format='value(name)' >/dev/null ||
  { echo "CHECK REQUIRED: Secret creation outcome unclear; do NOT rerun or rotate" >&2; exit 2; }
STATES="$(gcloud secrets versions list "$SECRET" --project="$PROD" \
  --format='value(state)')" ||
  { echo "CHECK REQUIRED: Secret version metadata unreadable" >&2; exit 2; }
if ! printf '%s\n' "$STATES" | grep -qx "ENABLED"; then
  echo "CHECK REQUIRED: no ENABLED Secret version confirmed; do NOT retry create" >&2
  exit 2
fi
unset STATES
echo "PASS: HMAC Secret created and ENABLED version verified (metadata only)."
echo "NO IAM OR FUNCTIONS CHANGES. Public/Pilot remains OFF. Pilot remains NO-GO."
echo "NEXT: run node scripts/v72-secret-iam-audit.mjs $PROD"
