#!/usr/bin/env bash
# P140: foreground-only Firebase Auth + Firestore Emulators on local demo project.
# Never starts Functions emulator, imports recovered source or deploys anything.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
FIREBASE_BIN="$(command -v firebase || true)"
NODE_BIN="$(command -v node || true)"
JAVA_BIN="$(command -v java || true)"
if [[ -z "$FIREBASE_BIN" || "$FIREBASE_BIN" != /* || ! -x "$FIREBASE_BIN" ]]; then
  echo 'P140_BLOCK=FIREBASE_CLI_MISSING'
  exit 1
fi
if [[ -z "$NODE_BIN" || "$NODE_BIN" != /* || ! -x "$NODE_BIN" ]]; then
  echo 'P140_BLOCK=NODE_BINARY_MISSING'
  exit 1
fi
if [[ -z "$JAVA_BIN" || "$JAVA_BIN" != /* || ! -x "$JAVA_BIN" ]]; then
  echo 'P140_BLOCK=JAVA_BINARY_MISSING'
  exit 1
fi
if [[ -e "$ROOT/audit/p140-firebase-emulator.json" && -L "$ROOT/audit/p140-firebase-emulator.json" ]]; then
  echo 'P140_BLOCK=SYMLINK_CONFIG'
  exit 1
fi
# Fail if an existing process is bound to either expected port, so a wrong
# listener cannot be silently mistaken for the emulator we intend to launch.
for port in 18080 19099; do
  if "$NODE_BIN" -e "const n=require('net');const s=n.createServer();s.once('error',()=>process.exit(1));s.listen($port,'127.0.0.1',()=>s.close(()=>process.exit(0)))"; then
    :
  else
    echo "P140_BLOCK=PORT_${port}_IN_USE"
    exit 1
  fi
done
# Firebase CLI processes need a writable isolated HOME for local state/cache.
# Prevent reading user Cloud Shell gcloud ADC files from the ordinary HOME.
PRIVATE_HOME="$(mktemp -d -t packtook-p140-emulator-XXXXXXXX)"
chmod 700 "$PRIVATE_HOME"
cleanup(){
  rm -rf -- "$PRIVATE_HOME"
}
trap cleanup EXIT
echo 'P140_MODE=FOREGROUND_FIRESTORE_AUTH_EMULATORS_ONLY'
echo 'P140_PROJECT=demo-packtook-owner-security'
echo 'P140_PORTS=FIRESTORE_18080_AUTH_19099'
echo 'P140_FUNCTIONS_EMULATOR=DISABLED P140_RECOVERED_SOURCE_IMPORT=NO'
echo 'P140_FIREBASE_CLOUD_WRITES=0 P140_DEPLOYS=0'
echo 'P140_STATUS=STARTING_LOCAL_EMULATORS'
# An isolated HOME does not completely remove Cloud metadata/network access.
# This launcher is only for official Firestore/Auth emulator binaries and test data.
# Run in foreground; Ctrl+C stops both emulators.
exec env -i \
  PATH="/usr/local/bin:/usr/bin:/bin:$(dirname "$NODE_BIN"):$(dirname "$JAVA_BIN")" \
  HOME="$PRIVATE_HOME" \
  NODE_ENV="test" PACKTOOK_EMULATOR_ONLY="1" \
  GCLOUD_PROJECT="demo-packtook-owner-security" \
  GOOGLE_CLOUD_PROJECT="demo-packtook-owner-security" \
  FIREBASE_PROJECT_ID="demo-packtook-owner-security" \
  FIRESTORE_EMULATOR_HOST="127.0.0.1:18080" \
  FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:19099" \
  "$FIREBASE_BIN" emulators:start --project demo-packtook-owner-security \
  --only firestore,auth --config "$ROOT/audit/p140-firebase-emulator.json" \
  --non-interactive
