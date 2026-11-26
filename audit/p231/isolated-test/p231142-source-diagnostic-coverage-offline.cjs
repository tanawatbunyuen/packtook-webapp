'use strict';
// P231.142: offline-only static security and diagnostic coverage check.
// Run from repository root. Reads local source only; no credentials or network.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path='audit/p231/isolated-test/index.js';
const s=fs.readFileSync(path,'utf8');
const checks=[
  ['ENFORCE_APPCHECK_TRUE',/\benforceAppCheck\s*:\s*true\b/.test(s)],
  ['PRIVATE_INVOKER',/\binvoker\s*:\s*['"]private['"]/.test(s)],
  ['EXPECTED_RUNTIME_SA',/p231-appcheck-probe@packtook-staging\.iam\.gserviceaccount\.com/.test(s)],
  ['EXPECTED_ISOLATED_EXPORT',/exports\.p231AppCheckIsolatedProbe\s*=\s*onCall\s*\(/.test(s)],
  ['HANDLER_CHECKS_APP_ID',/request\.app\?\.appId/.test(s)],
  ['HANDLER_CHECKS_VERIFIED_AUTH',/request\.auth\.token\?\.email_verified\s*!==\s*true/.test(s)],
  ['HANDLER_ACCEPTS_EMPTY_DATA_ONLY',/Object\.keys\(request\.data\)\.length\s*!==\s*0/.test(s)],
  ['HANDLER_HAS_NO_EXPLICIT_LOGGER',!/\b(?:console\.(?:log|warn|error|info)|logger\.|functions\.logger\.)/.test(s)],
  ['NO_BUSINESS_DB_WRITES_IN_HANDLER',!/\b(?:firestore|\.collection\(|\.set\(|\.update\(|\.delete\()/.test(s)]
];
console.log('P231_CHECK=ISOLATED_CALLABLE_SOURCE_DIAGNOSTIC_COVERAGE_OFFLINE');
let failed=0;
for(const [name,pass] of checks){
 console.log('P231_'+name+'='+(pass?'PASS':'FAIL'));
 if(!pass)failed++;
}
console.log('P231_STATIC_FIXTURES='+ (checks.length-failed)+'/'+checks.length+'_PASS');
console.log('P231_UNMATCHED_401_DIAGNOSTIC_CAUSE=NOT_INFERABLE_FROM_HANDLER_SOURCE');
console.log('P231_WRITES=0');
console.log('P231_RUNTIME_CALLS=0');
console.log('P231_RELEASE=NO_GO');
process.exitCode=failed?1:0;
