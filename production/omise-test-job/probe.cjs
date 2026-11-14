'use strict';
// PACKTOOK Omise TEST-only Cloud Run Job. No Firebase SDK or provider write methods.
// Secret value and charge metadata must never be printed.
const fs=require('node:fs');
const path=require('node:path');
const TEST_CHARGE=/^chrg_test_[A-Za-z0-9]{8,128}$/;
const TEST_SECRET=/^skey_test_[A-Za-z0-9_]+$/;
function deny(code){const e=new Error(code);e.code=code;throw e}
function validateConfig(env,exists=fs.existsSync){
 const errors=[];
 if(env.RR_STAGING_PROJECT_ID!=='packtook-staging')errors.push('STAGING_PROJECT_REQUIRED');
 if(env.RR_ENABLE_OMISE_TEST_READ!=='I_AUTHORIZE_TEST_ONLY_READS')errors.push('EXPLICIT_TEST_READ_REQUIRED');
 if(env.RR_NO_PRODUCTION_WRITES!=='true')errors.push('NO_PRODUCTION_WRITES_REQUIRED');
 if(env.RR_PUBLIC_SIGNUP_CLOSED!=='true')errors.push('PUBLIC_SIGNUP_CLOSED_REQUIRED');
 for(const k of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','GCP_PROJECT']){
   if(env[k]&&env[k]!=='packtook-staging')errors.push('CLOUD_PROJECT_MISMATCH');
 }
 for(const k of ['OMISE_SECRET_KEY','FIREBASE_TOKEN','GOOGLE_APPLICATION_CREDENTIALS','PACKTOOK_PRODUCTION_PROJECT_ID']){
   if(env[k])errors.push('UNSAFE_ENVIRONMENT_'+k);
 }
 const file=env.RR_OMISE_TEST_SECRET_FILE;
 if(typeof file!=='string'||!path.isAbsolute(file)||!file.startsWith('/run/secrets/')||
    !exists(file))errors.push('MOUNTED_SECRET_REQUIRED');
 if(typeof env.RR_OMISE_TEST_CHARGE_ID!=='string'||!TEST_CHARGE.test(env.RR_OMISE_TEST_CHARGE_ID))
  errors.push('TEST_CHARGE_ID_REQUIRED');
 const amount=Number(env.RR_EXPECTED_AMOUNT_SATANG);
 if(!Number.isSafeInteger(amount)||amount<=0||String(amount)!==env.RR_EXPECTED_AMOUNT_SATANG)
  errors.push('EXPECTED_AMOUNT_REQUIRED');
 for(const k of ['RR_EXPECTED_ACCOUNT_ID','RR_EXPECTED_REQUEST_ID']){
  if(typeof env[k]!=='string'||!/^[A-Za-z0-9_-]{6,128}$/.test(env[k]))
   errors.push('EXPECTED_METADATA_REQUIRED_'+k);
 }
 return Object.freeze({ok:errors.length===0,errors});
}
async function readOnlyTestCharge({env,fetchImpl=fetch,readSecret=fs.readFileSync,exists=fs.existsSync}){
 const check=validateConfig(env,exists);
 if(!check.ok)deny(check.errors.join(','));
 const secret=String(readSecret(env.RR_OMISE_TEST_SECRET_FILE,'utf8')).trim();
 if(!TEST_SECRET.test(secret))deny('TEST_SECRET_ONLY');
 const abort=new AbortController();
 const timeout=setTimeout(()=>abort.abort(),4000);
 try{
  const response=await fetchImpl('https://api.omise.co/charges/'+env.RR_OMISE_TEST_CHARGE_ID,{
   method:'GET',redirect:'error',signal:abort.signal,headers:{
    Authorization:'Basic '+Buffer.from(secret+':').toString('base64'),
    Accept:'application/json'
   }
  });
  if(!response||response.ok!==true||typeof response.json!=='function'){
   const error=new Error('PROVIDER_HTTP_NOT_SUCCESS');
   error.code='PROVIDER_HTTP_NOT_SUCCESS';
   // Report only a bounded numeric HTTP code, never the response body or headers.
   error.httpStatus=Number.isInteger(response?.status)&&response.status>=100&&response.status<=599
     ?response.status:null;
   throw error;
  }
  const charge=await response.json();
  if(charge?.id!==env.RR_OMISE_TEST_CHARGE_ID||charge?.livemode!==false||
    String(charge.currency||'').toLowerCase()!=='thb')
    deny('TEST_CHARGE_ID_OR_LIVEMODE_MISMATCH');
  if(charge.amount!==Number(env.RR_EXPECTED_AMOUNT_SATANG)||
      charge.metadata?.uid!==env.RR_EXPECTED_ACCOUNT_ID||
      charge.metadata?.requestId!==env.RR_EXPECTED_REQUEST_ID)
    deny('AMOUNT_OR_OWNER_METADATA_MISMATCH');
  return Object.freeze({testMode:true,readOnly:true,verified:true,providerStatusKnown:typeof charge.status==='string'});
 }catch(e){
  if(e?.name==='AbortError')deny('PROVIDER_TIMEOUT');
  throw e;
 }finally{clearTimeout(timeout)}
}
async function main(){
 try{
  const result=await readOnlyTestCharge({env:process.env});
  if(!result.verified)throw new Error('UNVERIFIED');
  console.log('OMISE_TEST_READ_ONLY_VERIFIED: PASS');
  console.log('PRODUCTION_WRITES: 0');
  console.log('RELEASE_DECISION: NO_GO_RELEASE');
 }catch(e){
  // No provider errors, metadata, Authorization headers or secrets in runtime logs.
  const safe=new Set(['TEST_SECRET_ONLY','PROVIDER_HTTP_NOT_SUCCESS',
   'TEST_CHARGE_ID_OR_LIVEMODE_MISMATCH','AMOUNT_OR_OWNER_METADATA_MISMATCH','PROVIDER_TIMEOUT']);
  console.error('OMISE_TEST_READ_ONLY_VERIFIED: FAIL');
  console.error('FAILURE_CATEGORY:',safe.has(e?.code)?e.code:'CONFIG_OR_PROVIDER_FAILURE');
  if(e?.code==='PROVIDER_HTTP_NOT_SUCCESS')
   console.error('PROVIDER_HTTP_STATUS:',Number.isInteger(e?.httpStatus)?e.httpStatus:'UNKNOWN');
  process.exitCode=1;
 }
}
module.exports={validateConfig,readOnlyTestCharge};
if(require.main===module)main();
