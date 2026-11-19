#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)";trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/gcloud" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
arg=" $* "
[[ "$arg" == *" --project=packtook-staging "* ]] || exit 91
if [[ "$arg" == *" functions list "* ]]; then
 [[ "$arg" == *" --v2 "* && "$arg" == *" --regions=asia-southeast1 "* ]] || exit 92
 python3 - "$PWD/functions/index.js" <<'PY'
import json,re,sys,pathlib
s=pathlib.Path(sys.argv[1]).read_text()
names=re.findall(r'exports\.(\w+)\s*=\s*(?:onCall|onRequest)\(',s)+["legacyOtherA","legacyOtherB","legacyOtherC","legacyOtherD"]
print(json.dumps([{"name":"projects/packtook-staging/locations/asia-southeast1/functions/"+x} for x in names]))
PY
elif [[ "$arg" == *" functions describe recordingStatus "* || "$arg" == *" functions describe usageStatus "* ]]; then
 [[ "$arg" == *" --v2 "* && "$arg" == *" --region=asia-southeast1 "* ]] || exit 93
 name="$3"
 printf '{"name":"projects/packtook-staging/locations/asia-southeast1/functions/%s","state":"ACTIVE","buildConfig":{"runtime":"nodejs22","entryPoint":"%s","source":{"storageSource":{"bucket":"fake-fixture","object":"fake"}}},"labels":{}}\n' "$name" "$name"
else
 echo "BLOCK_MUTATING_COMMAND" >&2;exit 94
fi
EOF
chmod +x "$tmp/gcloud"
PATH="$tmp:$PATH" bash "$root/audit/p120-staging-inventory-drift-readonly.sh" > "$tmp/result"
grep -Fq 'P120_CLOUD_FUNCTION_COUNT=27' "$tmp/result"
grep -Fq 'P120_SOURCE_FUNCTION_COUNT=23' "$tmp/result"
grep -Fq 'P120_CLOUD_ONLY_COUNT=4' "$tmp/result"
grep -Fq 'P120_SOURCE_ONLY_COUNT=0' "$tmp/result"
grep -Fq 'P120_recordingStatus_CODEBASE_LABEL=UNSET' "$tmp/result"
grep -Fq 'P120_DECISION=NO_GO_DEPLOY_SOURCE_PROVENANCE_UNVERIFIED' "$tmp/result"
echo "P120_MOCK_READONLY_INVENTORY=PASS"
