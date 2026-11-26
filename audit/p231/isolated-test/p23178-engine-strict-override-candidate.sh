#!/usr/bin/env bash
# P231.78 isolated package override candidate: local-only, never commits/deploys.
set -u -o pipefail
set +x
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 2
echo "P231_CHECK=NODE22_STRICT_OVERRIDE_CANDIDATE"
MAJOR="$(node -p 'process.versions.node.split(".")[0]')" || exit 2
if [[ "$MAJOR" != "22" ]]; then
  echo "P231_NODE22=FAIL"; exit 2
fi
echo "P231_NODE22=PASS"

# Only edit the isolated package and its lockfile; backups remain outside Git.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$ROOT" || "$PWD" != "$ROOT/audit/p231/isolated-test" ]]; then
  echo "P231_ISOLATED_PATH=FAIL"; exit 2
fi
if [[ ! -f package.json || ! -f package-lock.json ]]; then
  echo "P231_PACKAGE_INPUTS=FAIL"; exit 2
fi
if ! node -e 'const p=require("./package.json");if(p.name!=="packtook-p231-isolated-appcheck-probe"||p.private!==true||p.dependencies?.["firebase-functions"]!=="^6.0.0")process.exit(2)'; then
  echo "P231_MANIFEST_GUARD=FAIL"; exit 2
fi

BACKUP="$(mktemp -d)"
cp package.json "$BACKUP/package.json"
cp package-lock.json "$BACKUP/package-lock.json"
echo "P231_LOCAL_BACKUP_CREATED=YES"

# Registry metadata should be inspected before proposing version choices.
echo "P231_REGISTRY_PEER_DEPENDENCIES_BEGIN"
npm view @firebase/database-compat@2.1.7 peerDependencies --json || {
  echo "P231_REGISTRY_CHECK=FAIL"; exit 2;
}
npm view @firebase/database@1.1.5 engines --json || {
  echo "P231_REGISTRY_CHECK=FAIL"; exit 2;
}
npm view @firebase/database-compat@2.1.7 engines --json || {
  echo "P231_REGISTRY_CHECK=FAIL"; exit 2;
}
echo "P231_REGISTRY_PEER_DEPENDENCIES_END"

# Scoped overrides in test package only.
npm pkg set 'overrides.@firebase/database=1.1.5' \
            'overrides.@firebase/database-compat=2.1.7' || {
  echo "P231_OVERRIDES_SET=FAIL"; exit 2;
}
if ! npm install --package-lock-only --engine-strict --ignore-scripts --no-audit --no-fund; then
  echo "P231_STRICT_RESOLUTION=FAIL"
  echo "P231_BACKUP_DIRECTORY=$BACKUP"
  exit 2
fi
echo "P231_STRICT_RESOLUTION=PASS"
if ! npm ci --engine-strict --ignore-scripts --no-audit --no-fund; then
  echo "P231_STRICT_CI=FAIL"
  echo "P231_BACKUP_DIRECTORY=$BACKUP"
  exit 2
fi
echo "P231_STRICT_CI=PASS"
if ! node --check index.js; then echo "P231_SYNTAX=FAIL";exit 2;fi
if ! node --test test.cjs; then echo "P231_UNIT_TESTS=FAIL";exit 2;fi
if ! node p23172-package-preflight.cjs; then echo "P231_STATIC_PREFLIGHT=FAIL";exit 2;fi

node - <<'NODE'
const fs=require('node:fs'),crypto=require('node:crypto');
const p=require('./package.json');
const lock=require('./package-lock.json');
const list=Object.entries(lock.packages||{}).filter(([k])=>k.endsWith('node_modules/@firebase/database')||k.endsWith('node_modules/@firebase/database-compat'));
for(const [path,v] of list)console.log('P231_LOCKED_DEPENDENCY='+path+'@'+v.version);
const expected={'node_modules/@firebase/database':'1.1.5','node_modules/@firebase/database-compat':'2.1.7'};
for(const [key,value] of Object.entries(expected)){
if(lock.packages[key]?.version!==value)throw Error('Lockfile version mismatch: '+key);
}
if(p.overrides?.['@firebase/database']!=='1.1.5'||p.overrides?.['@firebase/database-compat']!=='2.1.7')throw Error('Overrides missing');
const sum=crypto.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex');
console.log('P231_NEW_LOCKFILE_SHA256='+sum);
console.log('P231_LOCKFILE_PACKAGES='+Object.keys(lock.packages||{}).length);
NODE
RC=$?
if [[ "$RC" -ne 0 ]];then echo 'P231_VERSION_PIN=FAIL';exit "$RC";fi
echo "P231_NODE22_ENGINE_STRICT=PASS"
echo "P231_UNIT_TESTS=PASS_7_OF_7_IF_OUTPUT_CONFIRMED"
echo "P231_STATIC_PREFLIGHT=PASS"
echo "P231_PACKAGE_RELEASE_GATE=READY_FOR_REVIEW_NOT_DEPLOY"
echo "P231_LOCAL_PACKAGE_JSON_AND_LOCK_CHANGED=YES"
echo "P231_GITHUB_WRITES=0"
echo "P231_CLOUD_WRITES=0"
echo "P231_DEPLOY=NOT_PERFORMED"
echo "P231_RUNTIME_APPCHECK=NOT_VERIFIED"
echo "P231_RELEASE=NO_GO"
