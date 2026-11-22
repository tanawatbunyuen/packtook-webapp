#!/usr/bin/env bash
# P125 source archaeology; Git data only, no Firebase API or deployment.
set -euo pipefail
git rev-parse --is-inside-work-tree >/dev/null
mapfile -t refs < <(git for-each-ref --format='%(refname)' refs/remotes/origin/ | grep -v '/HEAD$')
if [[ "${#refs[@]}" -eq 0 ]]; then echo "P125_BLOCK_NO_REMOTE_REFS"; exit 2; fi
names=(
 ownerGetCustomerAdjustmentHistory
 ownerGetCustomerManageState
 ownerGrantVideoCredits
 ownerUpdateCustomerExpiry
)
echo "P125_MODE=GIT_READ_ONLY_SOURCE_ARCHAEOLOGY"
echo "P125_REMOTE_REFS_SCANNED=${#refs[@]}"
for name in "${names[@]}"; do
  echo "P125_SYMBOL=$name"
  matches=0
  for ref in "${refs[@]}"; do
    # Print names and ref identifiers only; never print source lines or secret values.
    if git grep -l -F "$name" "$ref" -- 'functions/*.js' 'functions/**/*.js' >/dev/null 2>&1; then
      echo "P125_REF_HIT=$name REF=$ref"
      matches=$((matches+1))
    fi
  done
  echo "P125_REF_HIT_COUNT=$name:$matches"
  # Git -S finds commits that add/remove the symbol in functions JS history.
  hits="$(git log --all --format='%h' -S "$name" -- 'functions/*.js' 'functions/**/*.js' | head -n 8 || true)"
  if [[ -n "$hits" ]]; then
    while IFS= read -r sha; do echo "P125_HISTORY_COMMIT=$name:$sha"; done <<< "$hits"
  else
    echo "P125_HISTORY_COMMIT=$name:NONE_IN_SCANNED_HISTORY"
  fi
done
echo "P125_RESULT=DISCOVERY_ONLY_NOT_DEPLOY_PROVENANCE"
echo "P125_CLOUD_CALLS=0 P125_DEPLOYS=0"
