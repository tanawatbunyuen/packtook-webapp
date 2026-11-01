#!/usr/bin/env bash
# V6.3 Enable / disable QR TEST on a dedicated Production codebase only.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"; ACTION="$2"
[[ "$PROD" == "packtook-prod-01" && ( "$ACTION" == "enable" || "$ACTION" == "disable" ) ]] || {
 echo "Usage: bash scripts/set-promptpay-test.sh packtook-prod-01 enable|disable" >&2;exit 1;}
if [[ "$ACTION" == "enable" ]];then
 echo "WARNING: This opens Omise TEST PromptPay QR payments for verified Production Beta users."
 echo "No real charges are accepted; Credit Cards are not supported."
 read -r -p "Type ENABLE-PROD-QR-TEST to authorize test payments: " OK
 [[ "$OK" == "ENABLE-PROD-QR-TEST" ]] || { echo "Cancelled.";exit 1; }
 VALUE=true
else VALUE=false; fi
printf 'PACKTOOK_PRODUCTION_PROJECT_ID=%s\nPACKTOOK_PROMPTPAY_TEST_ENABLED=%s\n' "$PROD" "$VALUE" > "payment-functions/.env.$PROD"
echo "Local PromptPay Test gate set to $VALUE — deploy payment codebase to apply."
