#!/usr/bin/env bash
# P123 read-only six-function revision check against P122 baseline.
set -euo pipefail
PROJECT="packtook-staging"
REGION="asia-southeast1"
HERE="$(cd "$(dirname "$0")" && pwd)"
for binary in gcloud node; do command -v "$binary" >/dev/null || { echo "P123_MISSING_BINARY=$binary";exit 2; }; done
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
for n in recordingStatus usageStatus ownerGetCustomerAdjustmentHistory ownerGetCustomerManageState ownerGrantVideoCredits ownerUpdateCustomerExpiry; do
  gcloud functions describe "$n" --v2 --project="$PROJECT" --region="$REGION" --format=json > "$tmp/$n.json"
done
node "$HERE/p123-six-revision-compare.cjs" "$tmp"
