#!/usr/bin/env bash
# P155: official Firestore emulator binary setup in existing isolated private HOME only.
set -euo pipefail
if [[ "${1:-}" != "--download-only" || $# -ne 1 ]]; then
  echo "P155_BLOCK=EXPLICIT_DOWNLOAD_ONLY_FLAG_REQUIRED"; exit 2
fi
ROOT="${HOME:-}"
if [[ "$ROOT" != /* || ! -d "$ROOT" ]]; then echo "P155_BLOCK=HOME_INVALID"; exit 2; fi
PRIVATE="$ROOT/.packtook-demo-emulator-home"
if [[ -L "$PRIVATE" || ! -d "$PRIVATE" || ! -d "$PRIVATE/.cache/firebase/emulators" ]]; then
  echo "P155_BLOCK=PRIVATE_CACHE_HOME_INVALID"; exit 2
fi
FIREBASE="$(command -v firebase || true)"
NODE="$(command -v node || true)"
if [[ "$FIREBASE" != /* || ! -x "$FIREBASE" || "$NODE" != /* || ! -x "$NODE" ]]; then
  echo "P155_BLOCK=CLI_OR_NODE_MISSING"; exit 2
fi
if [[ -L "$PRIVATE/.cache/firebase/emulators" ]]; then
  echo "P155_BLOCK=PRIVATE_CACHE_SYMLINK"; exit 2
fi
LOG="$PRIVATE/p155-setup.log"
umask 077
: > "$LOG"
echo "P155_MODE=OFFICIAL_FIRESTORE_DOWNLOAD_ONLY"
echo "P155_PRIVATE_HOME=ISOLATED_EXISTING_HOME"
echo "P155_NO_EMULATOR_START=TRUE P155_NO_OWNER_IMPORT=TRUE"
echo "P155_NO_STAGING_PRODUCTION_DEPLOY=TRUE"
set +e
timeout 180s env -i HOME="$PRIVATE" PATH="/usr/local/bin:/usr/bin:/bin:$(dirname "$NODE"):$(dirname "$FIREBASE")" NODE_ENV=test CI=true \
  "$FIREBASE" setup:emulators:firestore --non-interactive > "$LOG" 2>&1
STATUS=$?
set -e
echo "P155_SETUP_EXIT_CODE=$STATUS"
python3 - "$PRIVATE/.cache/firebase/emulators" <<'PY'
from pathlib import Path
import sys,zipfile,re
cache=Path(sys.argv[1])
good=[]
for p in cache.iterdir():
    if p.is_symlink() or not p.is_file() or not re.fullmatch(r'cloud-firestore-emulator-v\d+(?:\.\d+){1,3}\.jar',p.name):
        continue
    if p.stat().st_size>1_000_000 and zipfile.is_zipfile(p):
        good.append(p.name)
print("P155_JAR_1_22_0_VALID="+str('cloud-firestore-emulator-v1.22.0.jar' in good).upper())
print("P155_VALID_JAR_COUNT="+str(len(good)))
print("P155_RAW_LOG_PRINTED=NO")
PY
echo "P155_LOG_STORED_PRIVATE=YES"
echo "P155_EMULATOR_STARTS=0 P155_CLOUD_DEPLOYS=0"
if [[ "$STATUS" -ne 0 ]]; then
  echo "P155_DECISION=NO_GO_SETUP_INCOMPLETE"
  exit 1
fi
echo "P155_DECISION=DOWNLOAD_COMPLETE_VERIFY_JAR_FLAG_ABOVE"
