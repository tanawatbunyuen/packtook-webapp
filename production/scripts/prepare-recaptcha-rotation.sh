#!/usr/bin/env bash
# V6.9.2: verify new PUBLIC reCAPTCHA Enterprise Web Site Key is from
# packtook-prod-01 BEFORE editing the local Customer config. Never deploys.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT="packtook-prod-01"
if [[ "$#" -ne 1 || "$1" != "--production-prelaunch-only" ]]; then
 echo "SAFETY BLOCK: use --production-prelaunch-only" >&2; exit 2
fi
if ! command -v gcloud >/dev/null 2>&1; then
 echo "SAFETY BLOCK: Google Cloud SDK required." >&2;exit 2
fi
echo "No Firebase deploy, public flag changes, or GCP key creation will occur."
echo "Paste the NEW PUBLIC Site Key from packtook-prod-01, not the old one:"
read -r -p "New PUBLIC Site Key: " NEW
if [[ ! "$NEW" =~ ^[a-zA-Z0-9_-]{30,160}$ ]]; then
 echo "SAFETY BLOCK: incomplete Site Key" >&2;exit 2
fi
META="$(mktemp /tmp/packtook-recaptcha-key.XXXXXX.json)"
chmod 600 "$META"
trap 'rm -f "$META"; unset NEW' EXIT
if ! gcloud recaptcha keys describe "$NEW" --project="$PROJECT" --format=json > "$META"; then
 echo "SAFETY BLOCK: key cannot be described in expected Production project." >&2
 exit 2
fi
NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
PACKTOOK_RECAPTCHA_SITE_KEY_NEW="$NEW" \
PACKTOOK_GCP_PROJECT_NUMBER="$NUMBER" \
PACKTOOK_RECAPTCHA_KEY_METADATA_FILE="$META" \
 node scripts/rotate-appcheck-site-key.mjs --apply
unset NEW
node scripts/test-appcheck-key-rotation.mjs
node scripts/test-appcheck-sitekey-configuration.mjs
node scripts/test-appcheck-readiness.mjs
node scripts/test-onboarding-ui.mjs
node scripts/test-public-launch-preflight.mjs
echo "Local key rotation tests passed. Do NOT deploy until Firebase App Check Console uses the SAME new key."
echo "Review: git diff -- app/signup-config.js"
