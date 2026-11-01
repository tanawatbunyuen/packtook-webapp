#!/usr/bin/env bash
# V6.3.0 Prepare QR-only payment functions. NO deployment.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Production project must be packtook-prod-01" >&2;exit 1; }
node scripts/verify.mjs "$PROD"
node --check payment-functions/index.js
node --check payment-functions/scripts/manage-qr-tester.js
node scripts/test-promptpay.mjs
# Prepare fails closed. Do not re-run after opt-in without re-enabling the flag.
printf 'PACKTOOK_PRODUCTION_PROJECT_ID=%s\nPACKTOOK_PROMPTPAY_TEST_ENABLED=false\n' "$PROD" > "payment-functions/.env.$PROD"
npm --prefix payment-functions install --no-audit --no-fund
echo "PASS: PACKTOOK V6.3 PromptPay Test prepared, disabled by default; no deploy."
echo "Secrets: set via firebase functions:secrets:set PACKTOOK_OMISE_TEST_SECRET_KEY / PACKTOOK_OMISE_TEST_WEBHOOK_SECRET --project $PROD"
