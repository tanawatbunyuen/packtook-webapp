#!/usr/bin/env bash
# P124 authenticated Cloud Shell metadata read-only; project and region pinned.
set -euo pipefail
PROJECT=packtook-staging
REGION=asia-southeast1
HERE="$(cd "$(dirname "$0")" && pwd)"
for bin in gcloud python3; do command -v "$bin" >/dev/null || { echo "P124_MISSING_TOOL=$bin";exit 2; };done
temp="$(mktemp -d)";trap 'rm -rf "$temp"' EXIT
for n in recordingStatus usageStatus; do
  gcloud functions describe "$n" --v2 --project="$PROJECT" --region="$REGION" --format=json > "$temp/$n.json"
done
python3 "$HERE/p124-compare-buildsource.py" "$temp" "$HERE/p124-buildsource-baseline.json"
