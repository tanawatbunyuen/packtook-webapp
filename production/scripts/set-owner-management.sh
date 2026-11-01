#!/usr/bin/env bash
# Explicitly opt-in to / opt-out of Production Owner Customer Management.
# This updates ONLY the local owner-functions Production environment file.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
PROD="$1"
ACTION="$2"
[[ "$PROD" == "packtook-prod-01" ]] || { echo "ERROR: Expected packtook-prod-01" >&2; exit 1; }
[[ "$ACTION" == "enable" || "$ACTION" == "disable" ]] || { echo "Usage: bash scripts/set-owner-management.sh packtook-prod-01 enable|disable" >&2;exit 1; }
ENVFILE="owner-functions/.env.$PROD"
if [[ "$ACTION" == "enable" ]];then
 echo "WARNING: This permits explicitly authorized Owner Managers to change REAL customer credit wallets and paid subscription expiration."
 echo "A separate platform Owner + Owner Manager Firebase Auth claim is still required."
 read -r -p "Type ENABLE-PROD-OWNER-MANAGEMENT to confirm: " YES
 [[ "$YES" == "ENABLE-PROD-OWNER-MANAGEMENT" ]] || { echo "Cancelled.";exit 1; }
 VALUE=true
else
 echo "Disabling customer mutations in the next Owner Functions deploy."
 VALUE=false
fi
printf 'PACKTOOK_PRODUCTION_PROJECT_ID=%s\nPACKTOOK_OWNER_MANAGEMENT_ENABLED=%s\n' "$PROD" "$VALUE" > "$ENVFILE"
echo "Updated LOCAL Owner Functions Production environment. Management enabled: $VALUE"
echo "Run deploy-owner-functions.sh to apply this change. Neither Staging nor Customer Functions is changed."
