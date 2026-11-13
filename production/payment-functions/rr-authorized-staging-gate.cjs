'use strict';
// Manual isolated staging verification gate; NEVER active in PR CI or production.
// Refuses to run until explicit nonproduction project, secret files and consent flags.
const fs=require('node:fs');
const path=require('node:path');
function assertAuthorizedIsolatedStaging(env,readable=fs.existsSync){
 const fail=[];
 const p=env.RR_STAGING_PROJECT_ID;
 if(p!=='packtook-staging')fail.push('staging_project_not_allowlisted');
 if(env.RR_ENABLE_REAL_STAGING_PROBES!=='I_AUTHORIZE_TEST_ONLY_READS')
  fail.push('explicit_probe_authorization_absent');
 if(env.RR_PUBLIC_SIGNUP_CLOSED!=='true')fail.push('public_signup_closed_not_confirmed');
 if(env.RR_NO_PRODUCTION_WRITES!=='true')fail.push('production_write_prohibition_absent');
 if(env.GCLOUD_PROJECT&&env.GCLOUD_PROJECT!==p)fail.push('gcloud_project_mismatch');
 if(env.GOOGLE_CLOUD_PROJECT&&env.GOOGLE_CLOUD_PROJECT!==p)
  fail.push('google_cloud_project_mismatch');
 if(env.GCP_PROJECT&&env.GCP_PROJECT!==p)fail.push('gcp_project_mismatch');
 if(env.PACKTOOK_PRODUCTION_PROJECT_ID||env.FIRESTORE_EMULATOR_HOST||
    env.FIREBASE_AUTH_EMULATOR_HOST||env.FIREBASE_TOKEN||
    env.OMISE_SECRET_KEY||env.GOOGLE_APPLICATION_CREDENTIALS)
   fail.push('unsafe_runtime_environment');
 for(const [key,label] of [
   ['RR_APPCHECK_LIMITED_USE_TOKEN_FILE','appcheck_limited_use_token_file'],
   ['RR_OMISE_TEST_SECRET_FILE','omise_test_secret_file']]){
   const file=env[key];
   if(typeof file!=='string'||!path.isAbsolute(file)||!file.startsWith('/run/secrets/')||
     !readable(file))fail.push(label+'_not_mounted');
 }
 if(typeof env.RR_STAGING_FIREBASE_APP_ID!=='string'||
   !/^1:[0-9]+:web:[a-f0-9]+$/.test(env.RR_STAGING_FIREBASE_APP_ID))
   fail.push('staging_firebase_app_id_missing');
 if(typeof env.RR_OMISE_TEST_CHARGE_ID!=='string'||
   !/^chrg_test_[a-zA-Z0-9]{8,128}$/.test(env.RR_OMISE_TEST_CHARGE_ID))
   fail.push('omise_test_charge_id_missing');
 if(!Number.isSafeInteger(Number(env.RR_EXPECTED_AMOUNT_SATANG))||
  Number(env.RR_EXPECTED_AMOUNT_SATANG)<=0)
   fail.push('expected_charge_amount_invalid');
 for(const key of ['RR_EXPECTED_ACCOUNT_ID','RR_EXPECTED_REQUEST_ID']){
   if(typeof env[key]!=='string'||!/^[a-zA-Z0-9_-]{6,128}$/.test(env[key]))
    fail.push(key.toLowerCase()+'_missing');
 }
 return Object.freeze({permitted:fail.length===0,missing:fail,productionWritesAllowed:false,
   chargeCreationAllowed:false,refundAllowed:false,publicActivationAllowed:false});
}
module.exports={assertAuthorizedIsolatedStaging};
