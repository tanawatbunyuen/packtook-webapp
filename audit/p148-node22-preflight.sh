#!/usr/bin/env bash
# P148: offline installed Node22 check, no Firebase operations.
set -euo pipefail
ROOT="$HOME/.nvm/versions/node"
CURRENT="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo UNAVAILABLE)"
[[ "$CURRENT" =~ ^[0-9]+$ ]] || CURRENT=UNAVAILABLE
echo "P148_CURRENT_NODE_MAJOR=$CURRENT"
COUNT=0
if [[ -d "$ROOT" && ! -L "$ROOT" ]]; then
  while IFS= read -r -d '' folder; do
    [[ -L "$folder" ]] && continue
    BIN="$folder/bin/node"
    [[ -f "$BIN" && -x "$BIN" && ! -L "$BIN" ]] || continue
    MAJOR="$("$BIN" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
    [[ "$MAJOR" == "22" ]] && COUNT=$((COUNT+1))
  done < <(find "$ROOT" -mindepth 1 -maxdepth 1 -type d -print0)
fi
echo "P148_INSTALLED_NODE22_CANDIDATES=$COUNT"
if (( COUNT > 0 )); then
  echo 'P148_NODE22_AVAILABLE=TRUE'
  echo 'P148_RECOMMENDED_ACTION=PLAN_EXPLICIT_NODE22_TRIAL_ONLY'
else
  echo 'P148_NODE22_AVAILABLE=FALSE'
  echo 'P148_RECOMMENDED_ACTION=NO_RESTART_NO_AUTO_INSTALL'
fi
echo 'P148_FIREBASE_RUNS=0 P148_EMULATOR_STARTS=0 P148_NVM_INSTALLS=0 P148_CLOUD_CALLS=0'
echo 'P148_DECISION=DIAGNOSTIC_ONLY_NO_GO_IMPORT_OR_DEPLOY'
