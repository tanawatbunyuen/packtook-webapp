#!/usr/bin/env bash
# P141: persistent private Firebase emulator cache; no recovered Owner code imported.
set -euo pipefail
AUDIT="$(cd "$(dirname "$0")" && pwd)"
FIREBASE_BIN="$(command -v firebase || true)"
NODE_BIN="$(command -v node || true)"
JAVA_BIN="$(command -v java || true)"
for bin in "$FIREBASE_BIN" "$NODE_BIN" "$JAVA_BIN"; do
  if [[ "$bin" != /* || ! -x "$bin" || ! -f "$bin" ]]; then
    echo 'P141_BLOCK=REQUIRED_EXECUTABLE_MISSING'
    exit 1
  fi
done
[[ "$HOME" == /* && -d "$HOME" ]] || { echo 'P141_BLOCK=HOME_INVALID'; exit 1; }
PRIVATE_HOME="$HOME/.packtook-demo-emulator-home"
if [[ -L "$PRIVATE_HOME" ]]; then echo 'P141_BLOCK=PRIVATE_HOME_SYMLINK'; exit 1; fi
(umask 077; mkdir -p "$PRIVATE_HOME/.cache/firebase/emulators")
chmod 700 "$PRIVATE_HOME" "$PRIVATE_HOME/.cache" "$PRIVATE_HOME/.cache/firebase" "$PRIVATE_HOME/.cache/firebase/emulators"
SOURCE_CACHE="$HOME/.cache/firebase/emulators"
TARGET_CACHE="$PRIVATE_HOME/.cache/firebase/emulators"
if [[ -d "$SOURCE_CACHE" && ! -L "$SOURCE_CACHE" ]]; then
  if find "$SOURCE_CACHE" -type l -print -quit | grep -q .; then
    echo 'P141_CACHE_SEED=SKIPPED_SYMLINK_FOUND'
  elif [[ -z "$(find "$TARGET_CACHE" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    cp -a "$SOURCE_CACHE/." "$TARGET_CACHE/"
    echo 'P141_CACHE_SEED=COPIED_EXISTING_EMULATOR_CACHE'
  else
    echo 'P141_CACHE_SEED=REUSED_PRIVATE_CACHE'
  fi
else
  echo 'P141_CACHE_SEED=EMPTY'
fi
echo 'P141_MODE=DEMO_LOCAL_AUTH_FIRESTORE_ONLY'
echo 'P141_PROJECT=demo-packtook-owner-security'
echo 'P141_CACHE=PERSISTENT_PRIVATE_ISOLATED_HOME'
echo 'P141_NO_IMPORTED_OWNER_SOURCE=TRUE P141_NO_FUNCTIONS_EMULATOR=TRUE'
echo 'P141_NO_PRODUCTION_OR_STAGING_DEPLOY=TRUE'
if [[ $# -eq 1 && "$1" == "--preflight" ]]; then
  echo 'P141_PREFLIGHT=PASS'
  exit 0
fi
[[ $# -eq 0 ]] || { echo 'P141_BLOCK=INVALID_ARGUMENT'; exit 1; }
for port in 18080 19099 14400 4500; do
  if ! "$NODE_BIN" -e "let n=require('net'),s=n.createServer();s.once('error',()=>process.exit(1));s.listen($port,'127.0.0.1',()=>s.close(()=>process.exit(0)))"; then
    echo "P141_BLOCK=PORT_${port}_IN_USE"
    exit 1
  fi
done
LOG="$PRIVATE_HOME/p141-emulator.log"
umask 077
: > "$LOG"
SECONDS_LIMIT=90
CHILD=""
stop_child() {
  if [[ -n "$CHILD" ]] && kill -0 "$CHILD" 2>/dev/null; then
    kill -INT "$CHILD" 2>/dev/null || true
    sleep 1
    kill -TERM "$CHILD" 2>/dev/null || true
    wait "$CHILD" 2>/dev/null || true
  fi
}
trap stop_child EXIT
trap 'exit 130' INT TERM
echo "P141_STARTUP_DEADLINE_SECONDS=$SECONDS_LIMIT"
env -i \
  PATH="/usr/local/bin:/usr/bin:/bin:$(dirname "$NODE_BIN"):$(dirname "$JAVA_BIN"):$(dirname "$FIREBASE_BIN")" \
  HOME="$PRIVATE_HOME" NODE_ENV="test" PACKTOOK_EMULATOR_ONLY="1" \
  GCLOUD_PROJECT="demo-packtook-owner-security" \
  GOOGLE_CLOUD_PROJECT="demo-packtook-owner-security" \
  FIREBASE_PROJECT_ID="demo-packtook-owner-security" \
  FIRESTORE_EMULATOR_HOST="127.0.0.1:18080" \
  FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:19099" \
  "$FIREBASE_BIN" emulators:start \
  --project demo-packtook-owner-security --only firestore,auth \
  --config "$AUDIT/p140-firebase-emulator.json" --non-interactive >"$LOG" 2>&1 &
CHILD=$!
ready() {
  "$NODE_BIN" -e "const n=require('net'),p=[18080,19099];Promise.all(p.map(port=>new Promise(r=>{const c=n.connect({host:'127.0.0.1',port});c.setTimeout(800);c.once('connect',()=>{c.destroy();r(true)});c.once('error',()=>r(false));c.once('timeout',()=>{c.destroy();r(false)})}))).then(v=>process.exit(v.every(Boolean)?0:1));"
}
started="$(date +%s)"
while (( $(date +%s) - started < SECONDS_LIMIT )); do
  if ready; then
    echo 'P141_PRIMARY_LISTENERS=FIRESTORE_AUTH_RESPONDING'
    echo 'P141_AUXILIARY_HUB_LOGGING=NOT_REQUIRED_FOR_PRIMARY_READINESS'
    echo 'P141_LOCAL_LISTENERS=RESPONDING'
    echo 'P141_EMULATOR_IDENTITY=NOT_ATTESTED'
    echo 'P141_DECISION=LOCAL_STARTUP_REACHED_NOT_IMPORT_APPROVAL'
    wait "$CHILD" || true
    exit 0
  fi
  if ! kill -0 "$CHILD" 2>/dev/null; then
    wait "$CHILD" 2>/dev/null || true
    echo 'P141_BLOCK=FIREBASE_CLI_EARLY_EXIT'
    echo 'P141_LOCAL_LOG_STORED_IN_PRIVATE_HOME=YES'
    exit 1
  fi
  sleep 2
done
echo 'P141_BLOCK=STARTUP_DEADLINE_EXCEEDED'
echo 'P141_LOCAL_LOG_STORED_IN_PRIVATE_HOME=YES'
exit 1
