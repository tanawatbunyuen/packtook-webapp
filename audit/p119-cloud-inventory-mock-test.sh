#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/gcloud" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
args=" $* "
[[ "$args" == *" --project=packtook-staging "* ]] || exit 91
if [[ "$args" == *" functions list "* ]]; then
 [[ "$args" == *" --v2 "* && "$args" == *" --regions=asia-southeast1 "* ]] || exit 92
 printf '[{"name":"projects/packtook-staging/locations/asia-southeast1/functions/usageStatus"},{"name":"projects/packtook-staging/locations/asia-southeast1/functions/recordingStatus"}]\n'
elif [[ "$args" == *" functions describe recordingStatus "* || "$args" == *" functions describe usageStatus "* ]]; then
 [[ "$args" == *" --v2 "* && "$args" == *" --region=asia-southeast1 "* ]] || exit 93
 name="3"
 printf '{"name":"projects/packtook-staging/locations/asia-southeast1/functions/%s","state":"ACTIVE","buildConfig":{"runtime":"nodejs22","entryPoint":"%s","source":{"storageSource":{}}},"labels":{"firebase-functions-codebase":"default"}}\n' "$name" "$name"
else
 echo "MOCK_REFUSED_UNAPPROVED_GCLOUD_COMMAND" >&2;exit 94
fi
MOCK
chmod +x "$tmp/gcloud"
PATH="$tmp:$PATH" bash "$root/audit/p119-staging-cloud-inventory-readonly.sh" > "$tmp/out"
grep -Fq "P119_FUNCTIONS_LISTED=2" "$tmp/out"
grep -Fq "P119_FUNCTION=recordingStatus" "$tmp/out"
grep -Fq "P119_FUNCTION=usageStatus" "$tmp/out"
grep -Fq "P119_DEPLOYMENTS=0 P119_SECRET_READS=0" "$tmp/out"
grep -Fq "P119_DECISION=EVIDENCE_COLLECTED_REQUIRES_INDEPENDENT_REVIEW" "$tmp/out"
echo "P119_MOCK_CLOUD_INVENTORY=PASS"
