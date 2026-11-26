#!/usr/bin/env bash
# P231.73 — no cloud deployment, no IAM, no git commit/push
set -u -o pipefail
set +x
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 2
printf 'P231_CHECK=LOCKFILE_BUILD_AND_VERIFY\n'
if [ ! -f package.json ] || [ ! -f index.js ] || [ ! -f test.cjs ]; then
  echo 'P231_GATE=BLOCKED_PACKAGE_FILES_MISSING'
  exit 2
fi
node --version
npm --version
if [ "$(node -p 'process.versions.node.split(".")[0]')" != '22' ]; then
  echo 'P231_NODE_RUNTIME_MATCH=FAIL_EXPECTED_22'
  exit 2
fi

if ! node -e 'const p=require("./package.json");if(p.name!=="packtook-p231-isolated-appcheck-probe"||p.private!==true||p.dependencies?.["firebase-functions"]!=="^6.0.0")process.exit(2)'; then
  echo 'P231_GATE=BLOCKED_MANIFEST_UNEXPECTED'
  exit 2
fi
if [ -e package-lock.json ]; then
  echo 'P231_LOCKFILE_ALREADY_PRESENT=YES'
  echo 'P231_GATE=BLOCKED_EXISTING_LOCKFILE_REVIEW_REQUIRED'
  exit 2
fi
if ! npm install --package-lock-only --ignore-scripts --no-audit --no-fund; then
  echo 'P231_LOCKFILE_GENERATION=FAIL'
  exit 2
fi
if ! npm ci --ignore-scripts --no-audit --no-fund; then
  echo 'P231_NPM_CI=FAIL'
  exit 2
fi
# Run each step separately. The prior compound negation skipped tests.
if ! node --check index.js; then
  echo 'P231_SYNTAX_CHECK=FAIL'
  exit 2
fi
if ! node --test test.cjs; then
  echo 'P231_UNIT_TESTS=FAIL'
  exit 2
fi
if ! node p23172-package-preflight.cjs; then
  echo 'P231_STATIC_PREFLIGHT=FAIL'
  exit 2
fi
echo 'P231_VALIDATION=PASS'
node - <<'NODE'
const fs=require('fs'),crypto=require('crypto');
const f=fs.readFileSync('package-lock.json');
const p=JSON.parse(f);
console.log('P231_LOCKFILE_VERSION='+p.lockfileVersion);
console.log('P231_LOCKFILE_PACKAGE_COUNT='+Object.keys(p.packages||{}).length);
console.log('P231_LOCKFILE_SHA256='+crypto.createHash('sha256').update(f).digest('hex'));
NODE
echo 'P231_LOCKFILE_GENERATION=PASS'
echo 'P231_NPM_CI=PASS'
echo 'P231_LOCAL_WRITES=PACKAGE_LOCK_AND_NODE_MODULES_ONLY'
echo 'P231_GIT_WRITES=0'
echo 'P231_GOOGLE_CLOUD_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
