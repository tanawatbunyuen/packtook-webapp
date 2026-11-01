#!/usr/bin/env bash
# Read-only Production PromptPay QR Test diagnostic. No secret values or payment operations.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROD="${1:-}"
UID_TO_CHECK="${2:-}"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "Usage: bash scripts/check-promptpay-test.sh packtook-prod-01 [TEST_CUSTOMER_UID]" >&2; exit 2; }
echo "PACKTOOK QR TEST -- Production diagnosis (read only)"
node scripts/verify.mjs "$PROD"
echo "Local flag:"
if [[ -s "payment-functions/.env.$PROD" ]]; then
  grep '^PACKTOOK_PROMPTPAY_TEST_ENABLED=' "payment-functions/.env.$PROD" || true
else
  echo "Local flag file missing"
fi
echo "Deployed Cloud Function flag:"
if command -v gcloud >/dev/null 2>&1; then
  gcloud functions describe promptpayConfig --gen2 \
    --region=asia-southeast1 --project="$PROD" \
    --format='value(serviceConfig.environmentVariables.PACKTOOK_PROMPTPAY_TEST_ENABLED)' \
    || echo "Unable to inspect deployed Function. Check gcloud permissions."
else echo "gcloud unavailable";fi
if [[ -n "$UID_TO_CHECK" ]]; then
  [[ "$UID_TO_CHECK" =~ ^[A-Za-z0-9_-]{1,128}$ ]] || { echo "Invalid UID" >&2;exit 2;}
  node - "$PROD" "$UID_TO_CHECK" <<'JS'
const admin=require("./payment-functions/node_modules/firebase-admin");
const [project,uid]=process.argv.slice(2);
admin.initializeApp({projectId:project});
admin.auth().getUser(uid).then(u=>{
  console.log("Auth account active:",!u.disabled);
  console.log("Email verified:",u.emailVerified===true);
  console.log("Production Beta:",u.customClaims?.packtookProductionBeta===true);
  console.log("QR Tester:",u.customClaims?.packtookPaymentTester===true);
  console.log("Owner (not permitted as QR tester):",u.customClaims?.packtookPlatformOwner===true);
}).catch(e=>{console.error("Auth claim read failed:",e.message);process.exitCode=1});
JS
fi
echo "No configuration has been changed."
