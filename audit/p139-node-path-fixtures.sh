#!/usr/bin/env bash
# P139 regression for nvm/Cloud Shell Node outside sanitized PATH.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHIM="$(mktemp -d)"
trap 'rm -rf "$SHIM"' EXIT
REAL_NODE="$(command -v node)"
[[ "$REAL_NODE" = /* && -x "$REAL_NODE" ]]
ln -s "$REAL_NODE" "$SHIM/node"
# Force command -v to see a Node binary outside the wrapper's sanitized PATH.
OUTPUT="$(PATH="$SHIM:/usr/bin:/bin" NODE_OPTIONS='--require /a/nonexistent/p139-injection.js' bash "$ROOT/audit/p137-isolation-preflight.sh")"
printf '%s\n' "$OUTPUT" | grep -Fq 'P137_CHECKS=8/8'
printf '%s\n' "$OUTPUT" | grep -Fq 'P137_DECISION=ENV_ISOLATION_PREFLIGHT_PASS_NOT_RUNTIME_PROOF'
echo 'P139_P137_EXTERNAL_NODE_AND_ENV_SCRUB=PASS'
# P138 must execute its Node program; no emulator listeners should result in
# a normal listener BLOCK, not node-not-found.
set +e
P138_RESULT="$(PATH="$SHIM:/usr/bin:/bin" bash "$ROOT/audit/p138-local-listener-preflight.sh" 2>&1)"
P138_EXIT=$?
set -e
[[ $P138_EXIT -eq 1 ]]
printf '%s\n' "$P138_RESULT" | grep -Fq 'P138_DECISION=BLOCK_LOCAL_LISTENER_UNAVAILABLE'
echo 'P139_P138_EXTERNAL_NODE_AND_MISSING_LISTENERS=PASS'
# An absent Node binary must fail closed without trying to start anything.
# Use an empty local binary directory and shell built-in mkdir-free invocation.
set +e
NO_NODE_RESULT="$(PATH="/usr/bin:/bin" bash "$ROOT/audit/p137-isolation-preflight.sh" 2>&1)"
NO_NODE_EXIT=$?
set -e
if [[ $NO_NODE_EXIT -eq 0 ]]; then
  echo 'P139_SYSTEM_NODE_PRESENT=YES'
else
  printf '%s\n' "$NO_NODE_RESULT" | grep -Fq 'P139_BLOCK=NODE_BINARY_NOT_FOUND'
  echo 'P139_MISSING_NODE_FAIL_CLOSED=PASS'
fi
echo 'P139_REQUIRED_REGRESSIONS=2/2_PASS'
