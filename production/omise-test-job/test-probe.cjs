'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateConfig,readOnlyTestCharge}=require('./probe.cjs');
const env={
 RR_STAGING_PROJECT_ID:'packtook-staging',
 RR_ENABLE_OMISE_TEST_READ:'I_AUTHORIZE_TEST_ONLY_READS',
 RR_NO_PRODUCTION_WRITES:'true',RR_PUBLIC_SIGNUP_CLOSED:'true',
 RR_OMISE_TEST_SECRET_FILE:'/run/secrets/omise-test-secret',
 RR_OMISE_TEST_CHARGE_ID:'chrg_test_123456789abcdef',
 RR_EXPECTED_AMOUNT_SATANG:'29900',
 RR_EXPECTED_ACCOUNT_ID:'account_test001',
 RR_EXPECTED_REQUEST_ID:'request_test001'
};
const charge={id:env.RR_OMISE_TEST_CHARGE_ID,livemode:false,
 currency:'thb',amount:29900,status:'successful',
 metadata:{uid:'account_test001',requestId:'request_test001'}};
const secret=()=> 'skey_test_1234567890abcdef';
const exists=()=>true;
const fake=(obj=charge)=>async()=>({ok:true,json:async()=>obj});
test('reject empty config (no accidental execution)',()=>assert.equal(validateConfig({},()=>false).ok,false));
test('allow exact staging inputs only',()=>assert.equal(validateConfig(env,exists).ok,true));
test('reject production project',()=>assert.equal(validateConfig({...env,RR_STAGING_PROJECT_ID:'packtook-prod-01'},exists).ok,false));
test('reject mismatched cloud project',()=>assert.equal(validateConfig({...env,GOOGLE_CLOUD_PROJECT:'packtook-prod-01'},exists).ok,false));
test('reject missing authorization',()=>assert.equal(validateConfig({...env,RR_ENABLE_OMISE_TEST_READ:'yes'},exists).ok,false));
test('reject open public signup',()=>assert.equal(validateConfig({...env,RR_PUBLIC_SIGNUP_CLOSED:'false'},exists).ok,false));
test('reject inherited credential environment',()=>assert.equal(validateConfig({...env,OMISE_SECRET_KEY:'skey_live_invalid'},exists).ok,false));
test('reject missing secret mount',()=>assert.equal(validateConfig(env,()=>false).ok,false));
test('reject secret path outside /run/secrets',()=>assert.equal(validateConfig({...env,RR_OMISE_TEST_SECRET_FILE:'/tmp/key'},exists).ok,false));
test('reject live charge id',()=>assert.equal(validateConfig({...env,RR_OMISE_TEST_CHARGE_ID:'chrg_live_123456789abcdef'},exists).ok,false));
test('reject missing expected owner',()=>assert.equal(validateConfig({...env,RR_EXPECTED_ACCOUNT_ID:''},exists).ok,false));
test('reject unexpected amount',()=>assert.equal(validateConfig({...env,RR_EXPECTED_AMOUNT_SATANG:'NaN'},exists).ok,false));
test('mock successful only authorized GET with no body',async()=>{
 let called=0;
 const result=await readOnlyTestCharge({env,exists,readSecret:secret,fetchImpl:async(url,options)=>{
  called++;assert.equal(url,'https://api.omise.co/charges/'+charge.id);
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  assert.equal(options.body,undefined);assert.ok(options.headers.Authorization.startsWith('Basic '));
  return {ok:true,json:async()=>charge};
 }});
 assert.equal(called,1);assert.equal(result.verified,true);
});
test('refuse live secret without provider call',async()=>{
 let called=false;
 await assert.rejects(readOnlyTestCharge({env,exists,readSecret:()=> 'skey_live_bad',fetchImpl:async()=>{called=true;}}),/TEST_SECRET_ONLY/);
 assert.equal(called,false);
});
test('reject returned livemode true',async()=>{
 await assert.rejects(readOnlyTestCharge({env,exists,readSecret:secret,fetchImpl:fake({...charge,livemode:true})}),/TEST_CHARGE_ID_OR_LIVEMODE_MISMATCH/);
});
test('reject returned different test charge id',async()=>{
 await assert.rejects(readOnlyTestCharge({env,exists,readSecret:secret,fetchImpl:fake({...charge,id:'chrg_test_other123456789'})}),/TEST_CHARGE_ID_OR_LIVEMODE_MISMATCH/);
});
test('reject amount mismatch',async()=>{
 await assert.rejects(readOnlyTestCharge({env,exists,readSecret:secret,fetchImpl:fake({...charge,amount:100})}),/AMOUNT_OR_OWNER_METADATA_MISMATCH/);
});
test('reject account or request mismatch',async()=>{
 await assert.rejects(readOnlyTestCharge({env,exists,readSecret:secret,fetchImpl:fake({...charge,metadata:{uid:'wrong_account',requestId:'wrong_request'}})}),/AMOUNT_OR_OWNER_METADATA_MISMATCH/);
});
test('reject bad provider HTTP',async()=>{
 await assert.rejects(readOnlyTestCharge({env,exists,readSecret:secret,fetchImpl:async()=>({ok:false})}),/PROVIDER_HTTP_NOT_SUCCESS/);
});
test('reject unexpected currency',async()=>{
 await assert.rejects(readOnlyTestCharge({env,exists,readSecret:secret,fetchImpl:fake({...charge,currency:'usd'})}),/TEST_CHARGE_ID_OR_LIVEMODE_MISMATCH/);
});

test('preserve safe provider HTTP 401 status without body',async()=>{
 await assert.rejects(readOnlyTestCharge({
  env,exists,readSecret:secret,fetchImpl:async()=>({ok:false,status:401,
    json:async()=>{throw Error('MUST_NOT_READ_PROVIDER_ERROR_BODY')}})
 }),e=>e.code==='PROVIDER_HTTP_NOT_SUCCESS'&&e.httpStatus===401);
});
test('preserve safe provider HTTP 404 status',async()=>{
 await assert.rejects(readOnlyTestCharge({
  env,exists,readSecret:secret,fetchImpl:async()=>({ok:false,status:404})
 }),e=>e.code==='PROVIDER_HTTP_NOT_SUCCESS'&&e.httpStatus===404);
});
test('invalid provider status cannot be included in logs',async()=>{
 await assert.rejects(readOnlyTestCharge({
  env,exists,readSecret:secret,fetchImpl:async()=>({ok:false,status:'private-message'})
 }),e=>e.code==='PROVIDER_HTTP_NOT_SUCCESS'&&e.httpStatus===null);
});
