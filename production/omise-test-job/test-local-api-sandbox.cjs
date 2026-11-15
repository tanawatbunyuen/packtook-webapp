'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {once}=require('node:events');
const {createLocalOmiseSandbox,AUTH,ID,ACCOUNT,REQUEST}=require('./local-api-sandbox.cjs');
const {readOnlyTestCharge}=require('./probe.cjs');
const baseEnv=Object.freeze({
 RR_STAGING_PROJECT_ID:'packtook-staging',
 RR_ENABLE_OMISE_TEST_READ:'I_AUTHORIZE_TEST_ONLY_READS',
 RR_NO_PRODUCTION_WRITES:'true',RR_PUBLIC_SIGNUP_CLOSED:'true',
 RR_OMISE_TEST_SECRET_FILE:'/run/secrets/omise-test-secret',
 RR_OMISE_TEST_CHARGE_ID:ID,RR_EXPECTED_AMOUNT_SATANG:'29900',
 RR_EXPECTED_ACCOUNT_ID:ACCOUNT,RR_EXPECTED_REQUEST_ID:REQUEST
});
async function withSandbox(mode,callback){
 const instance=createLocalOmiseSandbox(mode);
 instance.server.listen(0,'127.0.0.1');
 await once(instance.server,'listening');
 const address=instance.server.address();
 assert.equal(address.address,'127.0.0.1');
 const origin='http://127.0.0.1:'+address.port;
 const adapter=async(url,options)=>{
  // Keep the real probe's provider URL assertion and TEST-only request contract.
  assert.equal(url,'https://api.omise.co/charges/'+ID);
  assert.equal(options.method,'GET');
  assert.equal(options.body,undefined);
  assert.equal(options.redirect,'error');
  return fetch(origin+'/charges/'+ID,options);
 };
 try{return await callback({origin,instance,adapter});}
 finally{await new Promise((resolve,reject)=>instance.server.close(e=>e?reject(e):resolve()));}
}
const expectError=async(mode,category,status,code)=>{
 await withSandbox(mode,async({instance,adapter})=>{
  await assert.rejects(readOnlyTestCharge({env:baseEnv,fetchImpl:adapter,
   readSecret:()=> 'skey_test_LOCAL_MOCK_ONLY',exists:()=>true
  }),e=>e.code===category&&(
    status===undefined||e.httpStatus===status
   )&&(code===undefined||e.providerErrorCode===code));
  assert.equal(instance.counts.requests,1);
 });
};
test('paid synthetic charge: real probe verifies GET only without external Omise',async()=>{
 await withSandbox('paid',async({instance,adapter})=>{
  const result=await readOnlyTestCharge({env:baseEnv,fetchImpl:adapter,
   readSecret:()=> 'skey_test_LOCAL_MOCK_ONLY',exists:()=>true});
  assert.equal(result.verified,true);
  assert.equal(result.testMode,true);
  assert.equal(result.readOnly,true);
  assert.deepEqual(instance.counts,{requests:1,authorizedGets:1});
 });
});
test('mock 404 not_found: fail closed',()=>expectError('not_found','PROVIDER_HTTP_NOT_SUCCESS',404,'not_found'));
test('mock 401 bad_key: fail closed',()=>expectError('bad_key','PROVIDER_HTTP_NOT_SUCCESS',401,'authentication_failure'));
test('mock 500 internal_error: fail closed',()=>expectError('provider_error','PROVIDER_HTTP_NOT_SUCCESS',500,'internal_error'));
test('mock metadata mismatch: fail closed',()=>expectError('bad_metadata','AMOUNT_OR_OWNER_METADATA_MISMATCH'));
test('mock amount mismatch: fail closed',()=>expectError('bad_amount','AMOUNT_OR_OWNER_METADATA_MISMATCH'));
test('mock live charge: fail closed',()=>expectError('live_charge','TEST_CHARGE_ID_OR_LIVEMODE_MISMATCH'));
test('mock wrong currency: fail closed',()=>expectError('bad_currency','TEST_CHARGE_ID_OR_LIVEMODE_MISMATCH'));
test('mock pending charge: provider GET can verify identity but does not prove paid',async()=>{
 await withSandbox('pending',async({instance,adapter})=>{
  const result=await readOnlyTestCharge({env:baseEnv,fetchImpl:adapter,
   readSecret:()=> 'skey_test_LOCAL_MOCK_ONLY',exists:()=>true});
  assert.equal(result.verified,true);
  assert.equal(result.providerStatusKnown,true);
  // This is identity-level verifier only: never grant credits from this outcome.
  assert.equal(instance.counts.authorizedGets,1);
 });
});
test('POST create-charge is rejected by sandbox (never create a charge)',async()=>{
 await withSandbox('paid',async({origin,instance})=>{
  const response=await fetch(origin+'/charges',{method:'POST',headers:{Authorization:AUTH}});
  assert.equal(response.status,405);
  assert.equal(instance.counts.authorizedGets,0);
 });
});
test('unknown charge ID returns 404 without echoing identifiers',async()=>{
 await withSandbox('paid',async({origin})=>{
  const response=await fetch(origin+'/charges/chrg_test_UNKNOWN000',{headers:{Authorization:AUTH}});
  assert.equal(response.status,404);
  assert.equal((await response.json()).code,'not_found');
 });
});
test('missing provider secret is rejected before any HTTP call',async()=>{
 await withSandbox('paid',async({instance,adapter})=>{
  await assert.rejects(readOnlyTestCharge({env:baseEnv,fetchImpl:adapter,
   readSecret:()=> 'skey_live_FAKE',exists:()=>true}),/TEST_SECRET_ONLY/);
  assert.equal(instance.counts.requests,0);
 });
});
