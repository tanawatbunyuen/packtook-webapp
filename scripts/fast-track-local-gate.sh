#!/usr/bin/env bash
# Local demo only. Run from repository root after npm ci --prefix functions.
set -euo pipefail
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || { echo PACKTOOK_NODE22_REQUIRED; exit 2; }
[[ -f firebase.emulator-fast-track.json && -f functions/package-lock.json ]] || exit 2
export GCLOUD_PROJECT=demo-packtook-integrated-01
export GOOGLE_CLOUD_PROJECT=demo-packtook-integrated-01
export CLOUDSDK_CORE_PROJECT=demo-packtook-integrated-01
unset GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN FIREBASE_CONFIG
LOG="$(mktemp /tmp/packtook-fast-track.XXXXXX)"
echo "PACKTOOK_LOG=$LOG"
set +e
firebase emulators:exec --config firebase.emulator-fast-track.json --only auth,firestore,functions --project demo-packtook-integrated-01 'node functions/tests/multiuser-invitation-lifecycle-emulator.cjs && node functions/tests/multiuser-integrated-credit-callable-emulator.cjs' >"$LOG" 2>&1
RC=$?
set -e
grep -E 'PACKTOOK_|Error|FAIL' "$LOG" | tail -n 80 || true
echo "PACKTOOK_EMULATOR_EXIT=$RC"
echo PACKTOOK_FULL_PUBLIC=NO_GO
[[ "$RC" == 0 ]] || exit "$RC"
grep -Fxq 'PACKTOOK_INVITATION_ACCEPTANCE_E2E=13/13_PASS' "$LOG"
grep -Fxq 'PACKTOOK_INTEGRATED_CREDIT_CALLABLE_E2E=19/19_PASS' "$LOG"
echo PACKTOOK_FAST_TRACK_LOCAL_GATE=32/32_PASS
echo PACKTOOK_STAGING_SECURITY=NOT_VERIFIED
