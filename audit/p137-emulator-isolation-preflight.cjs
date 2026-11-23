'use strict';
// P137 isolation preflight: validates only process settings. NEVER imports source,
// starts emulators, performs network connections, or writes Cloud/Git.
const fs=require('node:fs');
const project='demo-packtook-owner-security';
const expectedPorts={FIRESTORE_EMULATOR_HOST:'18080',FIREBASE_AUTH_EMULATOR_HOST:'19099'};
const redFlags=['GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_CLOUD_KEYFILE_JSON','GOOGLE_CLOUD_KEYFILE','FIREBASE_TOKEN','GOOGLE_OAUTH_ACCESS_TOKEN','GOOGLE_API_KEY','GCLOUD_SERVICE_KEY','OMISE_SECRET_KEY','OMISE_WEBHOOK_SECRET','OMISE_PUBLIC_KEY'];
function report(label,condition){
 console.log('P137_CHECK='+label+' RESULT='+(condition?'PASS':'BLOCK'));
 return !!condition;
}
const env=process.env;
const checks=[];
checks.push(report('DEMO_PROJECT',env.GCLOUD_PROJECT===project&&env.GOOGLE_CLOUD_PROJECT===project&&env.FIREBASE_PROJECT_ID===project));
checks.push(report('EMULATOR_ONLY_EXPLICIT',env.PACKTOOK_EMULATOR_ONLY==='1'&&env.NODE_ENV==='test'));
for(const [key,port]of Object.entries(expectedPorts)){
 checks.push(report(key+'_LOOPBACK',env[key]==='127.0.0.1:'+port));
}
checks.push(report('NO_ADC_OR_PAYMENT_CREDENTIAL_ENV',redFlags.every(key=>!Object.hasOwn(env,key))));
checks.push(report('NO_LIVE_FIREBASE_CONFIG',!Object.hasOwn(env,'FIREBASE_CONFIG')&&!Object.hasOwn(env,'FIREBASE_DATABASE_EMULATOR_HOST')));
checks.push(report('NO_CLOUD_RUN_OR_FUNCTION_ID',!Object.hasOwn(env,'K_SERVICE')&&!Object.hasOwn(env,'FUNCTION_TARGET')&&!Object.hasOwn(env,'FUNCTION_NAME')));
checks.push(report('SOURCE_IMPORT_NOT_REQUESTED',!process.argv.slice(2).some(x=>x.startsWith('--import')||x.startsWith('--run'))));
console.log('P137_CHECKS='+checks.filter(Boolean).length+'/'+checks.length);
console.log('P137_EMULATOR_PROCESSES_STARTED=NO P137_NETWORK_PROBE=NO P137_REAL_HANDLER_IMPORTED=NO');
console.log('P137_CLOUD_CALLS=0 P137_GIT_WRITES=0 P137_DEPLOYS=0');
console.log('P137_DECISION='+(checks.every(Boolean)?'ENV_ISOLATION_PREFLIGHT_PASS_NOT_RUNTIME_PROOF':'BLOCK_EMULATOR_IMPORT_OR_RUNTIME'));
if(!checks.every(Boolean))process.exitCode=1;
