'use strict';
// PACKTOOK V4: real handler + real Firestore EMULATOR transactions.
// External Omise is always mocked. Fail closed if project or emulator are missing.
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
if(!process.env.FIRESTORE_EMULATOR_HOST||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST))
 throw Error('FIRESTORE_EMULATOR_LOOPBACK_REQUIRED');
if(process.env.GCLOUD_PROJECT!=='demo-packtook-v4-e2e'||
   process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
 throw Error('DEMO_PROJECT_ONLY_NO_CLOUD_CREDENTIALS');
const admin=require('firebase-admin');
admin.initializeApp({projectId:process.env.GCLOUD_PROJECT});
const db=admin.firestore();
const CHARGE='chrg_test_MOCK_V4_READONLY_001';
let counter=0;
function makeHarness({id,plan='Basic',paid=true,status='successful',amount,livemode=false,
 metadataBad=false,previousPlan='Free',wallet=20,reserved=0,revision=0}={}){
 const accountId='v4_emulator_'+(++counter)+'_'+(id||'scenario');
 const requestId='v4_test_request_'+counter+'_0001';
 const price={Basic:299,Business:1290}[plan];
 const charge={id:CHARGE,livemode,currency:'thb',amount:amount??price*100,
  status,paid,metadata:{uid:metadataBad?'wrong_uid':accountId,requestId}};
 let calls=0;
 class HttpsError extends Error{
  constructor(code,message,details){super(message);this.code=code;this.details=details}
 }
 const sandbox={
  exports:{},Buffer,URLSearchParams,Date,Promise,
  console:{log(){},warn(){},error(){}},
  require(name){
   if(name==='firebase-admin')return {initializeApp(){},firestore:Object.assign(()=>db,{FieldValue:admin.firestore.FieldValue})};
   if(name==='firebase-functions/v2/https')return {onCall:(_opts,fn)=>fn,onRequest:(_opts,fn)=>fn,HttpsError};
   if(name==='firebase-functions/params')return {defineSecret:()=>({value:()=> 'skey_test_LOCAL_V4_MOCK'})};
   if(name==='node:crypto')return crypto;
   throw Error('UNEXPECTED_IMPORT');
  },
  fetch:async(url,options)=>{
   calls++;
   assert.equal(url,'https://api.omise.co/charges/'+CHARGE);
   assert.equal(options.method,'GET');
   return {ok:true,json:async()=>structuredClone(charge)};
  }
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../functions/index.js'),'utf8'),
  sandbox,{filename:'functions/index.js',timeout:4000});
 const ref=db.collection('accounts').doc(accountId),ticket=ref.collection('billingRequests').doc(requestId);
 const account={plan:previousPlan,period:new Date().toISOString().slice(0,7),used:0,reserved,
  creditWalletV1:true,creditWalletRemaining:wallet,billingVersion:revision,
  openBillingRequestId:requestId};
 const billing={plan,amountTHB:price,requestedBy:accountId,omiseChargeId:CHARGE,
  status:'payment_pending',baseBillingVersion:0,basePlan:'Free',
  baseExpiresAt:null,purchaseKind:'new'};
 const req={auth:{uid:accountId,token:{email_verified:true}},data:{requestId}};
 return {ref,ticket,account,billing,req,handler:sandbox.exports.omisePaymentStatus,
  async seed(){await ref.set(account);await ticket.set(billing)},
  async state(){return {a:(await ref.get()).data(),b:(await ticket.get()).data(),
    audit:(await ref.collection('audit').get()).size}},
  calls:()=>calls};
}
test('Business paid 1290 activates 5000 credits plus 20 unused credits, once',async()=>{
 const h=makeHarness({id:'business',plan:'Business'});
 await h.seed();
 const r=await h.handler(h.req);
 assert.equal(r.status,'paid');
 assert.equal(r.creditsPurchased,5000);
 assert.equal(r.balanceAfter,5020);
 const a=await h.state();
 assert.equal(a.a.plan,'Business');
 assert.equal(a.a.creditWalletRemaining,5020);
 assert.equal(a.a.billingVersion,1);
 assert.equal(a.b.status,'paid');
 assert.equal(a.audit,1);
 const again=await h.handler(h.req);
 assert.equal(again.alreadyApplied,true);
 const second=await h.state();
 assert.equal(second.a.creditWalletRemaining,5020);
 assert.equal(second.audit,1);
});
test('simultaneous settlement retries cannot double-grant credits',async()=>{
 const h=makeHarness({id:'concurrent'});
 await h.seed();
 const results=await Promise.allSettled(Array.from({length:6},()=>h.handler(h.req)));
 assert.ok(results.some(x=>x.status==='fulfilled'&&x.value.status==='paid'));
 const s=await h.state();
 assert.equal(s.a.creditWalletRemaining,320);
 assert.equal(s.a.billingVersion,1);
 assert.equal(s.audit,1);
 assert.equal(s.b.status,'paid');
});
test('Pending payment never activates account',async()=>{
 const h=makeHarness({id:'pending',paid:false,status:'pending'});
 await h.seed();
 const r=await h.handler(h.req);
 assert.equal(r.status,'pending');
 const s=await h.state();
 assert.equal(s.a.plan,'Free');assert.equal(s.a.creditWalletRemaining,20);
 assert.equal(s.b.status,'payment_pending');assert.equal(s.audit,0);
});
test('Charge amount mismatch denies any mutation',async()=>{
 const h=makeHarness({id:'amount',amount:99900});
 await h.seed();
 await assert.rejects(h.handler(h.req),/Charge mismatch/);
 const s=await h.state();
 assert.equal(s.a.creditWalletRemaining,20);assert.equal(s.audit,0);
});
test('Charge owner metadata mismatch denies any mutation',async()=>{
 const h=makeHarness({id:'metadata',metadataBad:true});
 await h.seed();
 await assert.rejects(h.handler(h.req),/Charge mismatch/);
 const s=await h.state();
 assert.equal(s.a.plan,'Free');assert.equal(s.audit,0);
});
test('Changed billing version sends payment to manual review',async()=>{
 const h=makeHarness({id:'revision',revision:1});
 await h.seed();
 const r=await h.handler(h.req);
 assert.equal(r.status,'payment_review');
 const s=await h.state();
 assert.equal(s.a.creditWalletRemaining,20);
 assert.equal(s.b.status,'payment_review');
 assert.equal(s.audit,1);
});
test('Reserved video prevents merge and sends to manual review',async()=>{
 const h=makeHarness({id:'reservation',reserved:1});
 await h.seed();
 const r=await h.handler(h.req);
 assert.equal(r.status,'payment_review');
 const s=await h.state();
 assert.equal(s.a.creditWalletRemaining,20);
 assert.equal(s.b.status,'payment_review');
});
test('Test charge cannot be live mode',async()=>{
 const h=makeHarness({id:'live',livemode:true});
 await h.seed();
 await assert.rejects(h.handler(h.req),/Charge mismatch/);
 assert.equal((await h.state()).audit,0);
});
