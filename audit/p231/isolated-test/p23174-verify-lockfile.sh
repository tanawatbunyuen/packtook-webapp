#!/usr/bin/env bash
# P231.74 -- verify existing local lockfile under target Node.js 22.
# No cloud writes, no deployment, no git writes, no credentials printed.
set -u -o pipefail
set +x
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 2

echo 'P231_CHECK=NODE22_LOCKFILE_VALIDATION'
node --version
npm --version
MAJOR="$(node -p 'process.versions.node.split(".")[0]')" || exit 2
if [ "$MAJOR" != 22 ]; then
  echo 'P231_NODE_RUNTIME_MATCH=FAIL_EXPECTED_22'
  exit 2
fi
echo 'P231_NODE_RUNTIME_MATCH=PASS'

if [ ! -f package-lock.json ]; then
  echo 'P231_LOCKFILE_PRESENT=FAIL'
  exit 2
fi

if ! node -e 'const p=require("./package-lock.json"),m=require("./package.json"); if(p.lockfileVersion!==3||p.name!==m.name||p.packages?.[""]?.dependencies?.["firebase-functions"]!==m.dependencies["firebase-functions"])process.exit(2)'; then
  echo 'P231_LOCKFILE_MANIFEST_PARITY=FAIL'
  exit 2
fi
echo 'P231_LOCKFILE_MANIFEST_PARITY=PASS'

if ! npm ci --ignore-scripts --no-audit --no-fund; then
  echo 'P231_NODE22_NPM_CI=FAIL'
  exit 2
fi
echo 'P231_NODE22_NPM_CI=PASS'
if ! node --check index.js; then
  echo 'P231_SYNTAX_CHECK=FAIL'
  exit 2
fi
echo 'P231_SYNTAX_CHECK=PASS'
if ! node --test test.cjs; then
  echo 'P231_UNIT_TESTS=FAIL'
  exit 2
fi
echo 'P231_UNIT_TESTS=PASS_7_DEFINED'
if ! node p23172-package-preflight.cjs; then
  echo 'P231_STATIC_PREFLIGHT=FAIL'
  exit 2
fi
echo 'P231_STATIC_PREFLIGHT=PASS'
node - <<'NODE'
const crypto=require('node:crypto'),fs=require('node:fs');
const f=fs.readFileSync('package-lock.json');
const p=JSON.parse(f);
console.log('P231_LOCKFILE_SHA256='+crypto.createHash('sha256').update(f).digest('hex'));
console.log('P231_LOCKFILE_PACKAGES='+Object.keys(p.packages||{}).length);
NODE
echo 'P231_PACKAGE_GATE=PASS_OPERATOR_SIDE'
echo 'P231_GOOGLE_CLOUD_WRITES=0'
echo 'P231_GIT_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
