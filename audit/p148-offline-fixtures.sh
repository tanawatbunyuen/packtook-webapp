#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/.nvm/versions/node/v22-mock/bin"
cat > "$T/.nvm/versions/node/v22-mock/bin/node" <<'MOCK'
#!/usr/bin/env bash
[[ "$1" == "-p" ]] && echo 22 || exit 1
MOCK
chmod +x "$T/.nvm/versions/node/v22-mock/bin/node"
O="$(HOME="$T" bash "$ROOT/audit/p148-node22-preflight.sh")"
grep -Fq 'P148_NODE22_AVAILABLE=TRUE' <<< "$O"
echo 'P148_MOCK_INSTALLED_NODE22=PASS'
rm "$T/.nvm/versions/node/v22-mock/bin/node"
O="$(HOME="$T" bash "$ROOT/audit/p148-node22-preflight.sh")"
grep -Fq 'P148_NODE22_AVAILABLE=FALSE' <<< "$O"
echo 'P148_MISSING_NODE22_NO_RESTART=PASS'
echo 'P148_OFFLINE_FIXTURES=2/2_PASS'
