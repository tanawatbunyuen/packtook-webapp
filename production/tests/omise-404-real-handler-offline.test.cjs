'use strict';
/*
 * Offline isolation tests against REAL functions/index.js handlers.
 * VM substitutes Firebase, Omise fetch and Firestore with in-memory spies.
 * No network access, GCP credentials or deployed resources are involved.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

const uid='mock_account_1234567890', requestId='mock_request_1234567890';
const chargeId='chrg_test_1234567890abcdef';
function harness({http=404,providerCode='not_found',ticketStatus='payment_pending',duplicatePaid=false}={}){
 let apiCalls=0, writes=0, transactions=0;
 const account={plan:'Free',period:'2026-11',used:0,reserved:0,billingVersion:0,
  creditWalletV1:true,creditWalletRemaining:20,openBillingRequestId:requestId};
 const ticket={status:ticketStatus,omiseChargeId:chargeId,requestedBy:uid,plan:'Basic',
  amountTHB:299,purchaseKind:'new',baseBillingVersion:0,basePlan:'Free'};
 const accountRef={
  id:uid,
  collection(name){
   if(name!=='billingRequests')throw Error('UNEXPECTED_COLLECTION_'+name);
   return {doc(id){
    assert.equal(id,requestId);
    return {get:async()=>({exists:true,data:()=>ticket}),id,
     update(){writes++;throw Error('UNEXPECTED_TICKET_WRITE')}};
   }};
  },
  get:async()=>({exists:true,data:()=>account})
 };
 const db={
  collection(name){
   assert.equal(name,'accounts');
   return {doc(id){assert.equal(id,uid);return accountRef}};
  },
  async runTransaction(){transactions++;throw Error('TRANSACTION_NOT_ALLOWED_ON_PROVIDER_404')}
 };
 class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details}}
 const https={onCall:(_options,handler)=>handler,onRequest:(_options,handler)=>handler,HttpsError};
 const admin={initializeApp(){},firestore(){return db}};
 admin.firestore.FieldValue={serverTimestamp:()=>({}),increment:n=>n,delete:()=>({})};
 const definitions={OMISE_SECRET_KEY:'skey_test_MOCKONLY',OMISE_PUBLIC_KEY:'pkey_test_MOCKONLY',OMISE_WEBHOOK_SECRET:''};
 const mocks={
  'firebase-functions/v2/https':https,
  'firebase-functions/params':{defineSecret:name=>({value:()=>definitions[name]})},
  'firebase-admin':admin,
  'node:crypto':crypto
 };
 const sandbox={
  exports:{},Buffer,URLSearchParams,Date,Number,Math,Promise,
  require:name=>{if(!(name in mocks))throw Error('UNMOCKED_MODULE_'+name);return mocks[name]},
  fetch:async(url,options)=>{
   apiCalls++;
   assert.equal(url,'https://api.omise.co/charges/'+chargeId);
   assert.equal(options.method,'GET');
   assert.equal(options.body,undefined);
   if(http===200)return {ok:true,json:async()=>({
    id:chargeId,currency:'thb',amount:29900,metadata:{uid,requestId},
    livemode:false,status:'successful',paid:true
   })};
   return {ok:false,status:http,json:async()=>({object:'error',code:providerCode})};
  },
  console:{log(){},warn(){},error(){throw Error('UNEXPECTED_LOG')}}
 };
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../functions/index.js'),'utf8'),sandbox,
  {filename:'functions/index.js',timeout:3000});
 const auth={auth:{uid,token:{email_verified:true}},data:{requestId}};
 return {handlers:sandbox.exports,auth,getStats:()=>({apiCalls,writes,transactions})};
}
test('Omise 404 not_found cannot credit wallet or activate subscription in payment status',async()=>{
 const h=harness();
 await assert.rejects(h.handlers.omisePaymentStatus(h.auth),e=>e.code==='failed-precondition'&&/not_found/.test(e.message));
 assert.deepEqual(h.getStats(),{apiCalls:1,writes:0,transactions:0});
});
test('Omise 404 is never silently converted to success for previously paid ticket',async()=>{
 const h=harness({ticketStatus:'paid'});
 await assert.rejects(h.handlers.omisePaymentStatus(h.auth),e=>e.code==='failed-precondition');
 assert.deepEqual(h.getStats(),{apiCalls:1,writes:0,transactions:0});
});
test('Omise 404 cannot activate subscription through customer recovery',async()=>{
 const h=harness();
 await assert.rejects(h.handlers.recoverOmiseCharge(h.auth),e=>e.code==='failed-precondition');
 assert.deepEqual(h.getStats(),{apiCalls:1,writes:0,transactions:0});
});
test('Omise 404 cannot update wallet using payment audit',async()=>{
 const h=harness();
 await assert.rejects(h.handlers.paymentAudit(h.auth),e=>e.code==='failed-precondition');
 assert.deepEqual(h.getStats(),{apiCalls:1,writes:0,transactions:0});
});
test('invalid webhook signature returns 401, without provider call or writes',async()=>{
 const h=harness();
 const replies=[];
 const res={status(status){replies.push(status);return this},send(s){replies.push(s);return this}};
 const req={method:'POST',rawBody:Buffer.from('{}'),
  headers:{'omise-signature-timestamp':String(Math.floor(Date.now()/1000)),
           'omise-signature':'0'.repeat(64)}};
 await h.handlers.omisePaymentWebhook(req,res);
 assert.deepEqual(replies,[503,'Webhook secret missing']);
 assert.deepEqual(h.getStats(),{apiCalls:0,writes:0,transactions:0});
});
test('webhook with invalid HTTP method does not read Omise or write credits',async()=>{
 const h=harness();const replies=[];
 const res={status(status){replies.push(status);return this},send(s){replies.push(s);return this}};
 await h.handlers.omisePaymentWebhook({method:'GET',headers:{}},res);
 assert.deepEqual(replies,[405,'Method not allowed']);
 assert.deepEqual(h.getStats(),{apiCalls:0,writes:0,transactions:0});
});
