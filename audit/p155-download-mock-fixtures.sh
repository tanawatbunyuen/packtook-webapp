#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/.packtook-demo-emulator-home/.cache/firebase/emulators" "$T/bin"
cat > "$T/bin/firebase" <<'MOCK'
#!/usr/bin/env bash
[[ "${1:-}" == "setup:emulators:firestore" && "${2:-}" == "--non-interactive" ]] || exit 22
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile
p=Path.home()/".cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar"
with ZipFile(p,'w') as z:z.writestr('test.bin',b'0'*1000001)
PY
MOCK
chmod +x "$T/bin/firebase"
# PATH must provide mock CLI first, preserving an actual Node runtime.
O="$(HOME="$T" PATH="$T/bin:$PATH" bash "$ROOT/audit/p155-official-download-only.sh" --download-only)"
grep -Fq 'P155_SETUP_EXIT_CODE=0' <<< "$O"
grep -Fq 'P155_JAR_1_22_0_VALID=TRUE' <<< "$O"
grep -Fq 'P155_EMULATOR_STARTS=0' <<< "$O"
echo "P155_OFFICIAL_SETUP_MOCK=PASS"
set +e
O="$(HOME="$T" PATH="$T/bin:$PATH" bash "$ROOT/audit/p155-official-download-only.sh" 2>&1)"
S=$?
set -e
[[ "$S" -ne 0 ]]
grep -Fq 'P155_BLOCK=EXPLICIT_DOWNLOAD_ONLY_FLAG_REQUIRED' <<< "$O"
echo "P155_EXPLICIT_FLAG_REQUIRED=PASS"
echo "P155_OFFLINE_FIXTURES=2/2_PASS"
