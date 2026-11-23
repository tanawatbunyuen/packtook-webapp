#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP="$(mktemp -d -t p140-offline-XXXXXXXX)"
trap 'rm -rf "$TEMP"' EXIT
NODE_REAL="$(command -v node)"
mkdir -p "$TEMP/bin"
cat > "$TEMP/bin/firebase" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == "emulators:start" ]]
[[ "$2" == "--project" && "$3" == "demo-packtook-owner-security" ]]
[[ "$4" == "--only" && "$5" == "firestore,auth" ]]
[[ "$GCLOUD_PROJECT" == "demo-packtook-owner-security" ]]
[[ "$FIREBASE_PROJECT_ID" == "demo-packtook-owner-security" ]]
[[ "$FIRESTORE_EMULATOR_HOST" == "127.0.0.1:18080" ]]
[[ "$FIREBASE_AUTH_EMULATOR_HOST" == "127.0.0.1:19099" ]]
[[ "$PACKTOOK_EMULATOR_ONLY" == "1" ]]
[[ ! -e "${HOME}/.config/gcloud/application_default_credentials.json" ]]
echo 'P140_MOCK_FIREBASE_START_ARGS_AND_ENV=PASS'
MOCK
cat > "$TEMP/bin/java" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$TEMP/bin/firebase" "$TEMP/bin/java"
# Mock CLI only. This must NEVER launch real Firebase emulators in GitHub Actions.
OUT="$(PATH="$TEMP/bin:$(dirname "$NODE_REAL"):/usr/bin:/bin" bash "$ROOT/audit/p140-start-demo-emulators.sh")"
printf '%s\n' "$OUT" | grep -Fq 'P140_MODE=FOREGROUND_FIRESTORE_AUTH_EMULATORS_ONLY'
printf '%s\n' "$OUT" | grep -Fq 'P140_MOCK_FIREBASE_START_ARGS_AND_ENV=PASS'
echo 'P140_SYNTHETIC_FIREBASE_CLI_GUARD=PASS'
node - "$ROOT/audit/p140-firebase-emulator.json" <<'NODE'
const f=require(process.argv[2]);
if(f.emulators.auth.host!=='127.0.0.1'||f.emulators.firestore.host!=='127.0.0.1')process.exit(1);
if(f.emulators.auth.port!==19099||f.emulators.firestore.port!==18080)process.exit(1);
if(Object.hasOwn(f.emulators,'functions')||f.emulators.ui.enabled!==false||f.emulators.hub.host!=='127.0.0.1'||f.emulators.hub.port!==14400)process.exit(1);
if(f.emulators.logging.host!=='127.0.0.1'||f.emulators.logging.port!==4500)process.exit(1);
if(f.firestore.rules!=='p140-firestore-deny-all.rules')process.exit(1);
console.log('P140_LOCAL_ONLY_CONFIG_VALIDATION=PASS');
NODE
grep -Fq 'allow read, write: if false;' "$ROOT/audit/p140-firestore-deny-all.rules"
echo 'P140_FIRESTORE_DENY_ALL_RULES=PASS'
echo 'P140_OFFLINE_FIXTURES=3/3_PASS'
