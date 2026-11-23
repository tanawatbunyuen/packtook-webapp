#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec env -i  PATH="/usr/local/bin:/usr/bin:/bin"  HOME="${HOME}" NODE_ENV="test" PACKTOOK_EMULATOR_ONLY="1"  GCLOUD_PROJECT="demo-packtook-owner-security"  GOOGLE_CLOUD_PROJECT="demo-packtook-owner-security"  FIREBASE_PROJECT_ID="demo-packtook-owner-security"  FIRESTORE_EMULATOR_HOST="127.0.0.1:18080"  FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:19099"  node "$HERE/p138-local-emulator-listener.cjs"
