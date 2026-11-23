#!/usr/bin/env bash
# P139: resolve installed Node BEFORE sanitizing PATH. Never imports recovered code.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" || "$NODE_BIN" != /* || ! -f "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  printf '%s\n' 'P139_BLOCK=NODE_BINARY_NOT_FOUND'
  exit 1
fi
exec env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  HOME="${HOME}" \
  NODE_ENV="test" \
  PACKTOOK_EMULATOR_ONLY="1" \
  GCLOUD_PROJECT="demo-packtook-owner-security" \
  GOOGLE_CLOUD_PROJECT="demo-packtook-owner-security" \
  FIREBASE_PROJECT_ID="demo-packtook-owner-security" \
  FIRESTORE_EMULATOR_HOST="127.0.0.1:18080" \
  FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:19099" \
  "$NODE_BIN" "$HERE/p138-local-emulator-listener.cjs"
