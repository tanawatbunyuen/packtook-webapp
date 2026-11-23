'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const script=path.join(__dirname,'p137-emulator-isolation-preflight.cjs');
const good={
  PATH:'/usr/bin:/bin',
  HOME:'/tmp',
  NODE_ENV:'test',
  PACKTOOK_EMULATOR_ONLY:'1',
  GCLOUD_PROJECT:'demo-packtook-owner-security',
  GOOGLE_CLOUD_PROJECT:'demo-packtook-owner-security',
  FIREBASE_PROJECT_ID:'demo-packtook-owner-security',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',
  FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099'
};
function run(changes){return cp.spawnSync(process.execPath,[script],{env:{...good,...changes},encoding:'utf8'})}
function checkBlock(changes,label){const r=run(changes);assert.equal(r.status,1,r.stdout+r.stderr);assert.match(r.stdout,/P137_DECISION=BLOCK_EMULATOR_IMPORT_OR_RUNTIME/);console.log('P137_FIXTURE_'+label+'=PASS')}
const ok=run({});
assert.equal(ok.status,0,ok.stdout+ok.stderr);
assert.match(ok.stdout,/P137_CHECKS=8\/8/);
assert.match(ok.stdout,/P137_DECISION=ENV_ISOLATION_PREFLIGHT_PASS_NOT_RUNTIME_PROOF/);
console.log('P137_FIXTURE_CLEAN_DEMO_ENV=PASS');
checkBlock({GCLOUD_PROJECT:'packtook-prod-01'},'PRODUCTION_PROJECT_BLOCK');
checkBlock({FIRESTORE_EMULATOR_HOST:'8.8.8.8:18080'},'REMOTE_HOST_BLOCK');
checkBlock({GOOGLE_APPLICATION_CREDENTIALS:'/tmp/fake-key.json'},'ADC_ENV_BLOCK');
checkBlock({FIREBASE_CONFIG:'{"projectId":"packtook-staging"}'},'LIVE_FIREBASE_CONFIG_BLOCK');
checkBlock({FIREBASE_AUTH_EMULATOR_HOST:''},'MISSING_AUTH_EMULATOR_BLOCK');
console.log('P137_OFFLINE_FIXTURES=6/6_PASS');
