#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d -t p141-fixture-XXXXXXXX)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/home/.cache/firebase/emulators" "$T/bin"
echo 'synthetic fixture only' > "$T/home/.cache/firebase/emulators/synthetic-cache.bin"
cat > "$T/bin/firebase" <<'MOCK'
#!/usr/bin/env bash
[[ "$1" == "emulators:start" && "$2" == "--project" && "$3" == "demo-packtook-owner-security" ]] || exit 5
echo 'mock emulator exits without binding ports'
exit 2
MOCK
cat > "$T/bin/java" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$T/bin/firebase" "$T/bin/java"
REAL_NODE="$(command -v node)"
ln -s "$REAL_NODE" "$T/bin/node"
O="$(HOME="$T/home" PATH="$T/bin:/usr/bin:/bin" bash "$ROOT/audit/p141-demo-emulator-start.sh" --preflight)"
printf '%s\n' "$O" | grep -Fq 'P141_PREFLIGHT=PASS'
printf '%s\n' "$O" | grep -Fq 'P141_CACHE_SEED=COPIED_EXISTING_EMULATOR_CACHE'
test -f "$T/home/.packtook-demo-emulator-home/.cache/firebase/emulators/synthetic-cache.bin"
echo 'P141_PERSISTENT_CACHE_SEED=PASS'
O="$(HOME="$T/home" PATH="$T/bin:/usr/bin:/bin" bash "$ROOT/audit/p141-demo-emulator-start.sh" --preflight)"
printf '%s\n' "$O" | grep -Fq 'P141_CACHE_SEED=REUSED_PRIVATE_CACHE'
echo 'P141_PERSISTENT_CACHE_REUSE=PASS'
set +e
O="$(HOME="$T/home" PATH="$T/bin:/usr/bin:/bin" bash "$ROOT/audit/p141-demo-emulator-start.sh")"
STATUS=$?
set -e
test "$STATUS" -eq 1
printf '%s\n' "$O" | grep -Fq 'P141_BLOCK=FIREBASE_CLI_EARLY_EXIT'
echo 'P141_CLI_EARLY_EXIT_FAIL_CLOSED=PASS'
echo 'P141_OFFLINE_FIXTURES=3/3_PASS'
