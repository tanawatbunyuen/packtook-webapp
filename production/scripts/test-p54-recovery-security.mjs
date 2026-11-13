// P54 pure tests. No Firestore/Auth emulator, Omise network or production writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {assertDemoOnly,createOmiseTestAdapter,buildDemoRecoveryBackend,
  chargeEvidence,REVIEW_TTL_MS}=require('../payment-functions/p54-recovery-backend-candidate.cjs');
const demoEnv={
 GCLOUD_PROJECT:'demo-packtook-v72',GOOGLE_CLOUD_PROJECT:'demo-packtook-v72',
 GCP_PROJECT:'demo-packtook-v72',FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',
 FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099'
};
const accountId='account_demo_01',reqId='request_demo_01',chId='chrg_test_p54test123';
function fixture(){
 return {
  account:{plan:'Starter',used:0,reserved:0,creditWalletRemaining:120,
   billingVersion:3,openBillingRequestId:reqId},
  bill:{requestedBy:accountId,status:'payment_review',paymentMethod:'promptpay',
   paymentProvider:'omise',plan:'Basic',amountTHB:299,omiseChargeId:chId,
   providerVerifiedPaid:true,providerVerifiedChargeId:chId,
   providerVerifiedAmountSatang:29900,providerVerifiedCurrency:'thb',
   providerVerifiedLivemode:false,baseBillingVersion:3},
  charge:{id:chId,status:'successful',paid:true,livemode:false,
   currency:'thb',amount:29900,source:{type:'promptpay'},
   metadata:{uid:accountId,requestId:reqId},refunded_amount:0}
 };
}
const digest=(f)=>chargeEvidence(accountId,reqId,f.account,f.bill,f.charge).evidenceHash;
test('P54 demo guard accepts isolated localhost emulator',()=>assert.doesNotThrow(()=>assertDemoOnly(demoEnv)));
for(const [name,change] of [
 ['wrong project',{GCLOUD_PROJECT:'packtook-prod-01'}],
 ['missing second project',{GOOGLE_CLOUD_PROJECT:null}],
 ['production Firestore host',{FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com:443'}],
 ['production Auth host',{FIREBASE_AUTH_EMULATOR_HOST:'example:9099'}],
 ['production project override',{PACKTOOK_PRODUCTION_PROJECT_ID:'packtook-prod-01'}],
 ['credential path',{GOOGLE_APPLICATION_CREDENTIALS:'/unsafe/key.json'}],
 ['Firebase token',{FIREBASE_TOKEN:'secret'}],
 ['Cloud SDK override',{CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE:'/gcloud.json'}]
 ])test('P54 rejects '+name,()=>assert.throws(()=>assertDemoOnly({...demoEnv,...change}),/demo_emulator_only/));
test('P54 cannot create backend without all trust dependencies',()=>
 assert.throws(()=>buildDemoRecoveryBackend({env:demoEnv}),/trusted_dependencies_required/));
test('P54 evidence hash is stable for identical input',()=>{
 const f=fixture();assert.equal(digest(f),digest(f));assert.equal(digest(f).length,64);
});
test('P54 evidence hash binds account, provider, and billing',()=>{
 const f=fixture(),a=digest(f);
 f.account.creditWalletRemaining=121;assert.notEqual(digest(f),a);
});
for(const [label,mutate] of [
 ['wrong payer',f=>{f.charge.metadata.uid='another_demo_12'}],
 ['wrong bill',f=>{f.charge.metadata.requestId='another_request_12'}],
 ['wrong amount',f=>{f.charge.amount=29901}],
 ['wrong plan price',f=>{f.bill.amountTHB=199}],
 ['wrong method',f=>{f.charge.source.type='card'}],
 ['wrong currency',f=>{f.charge.currency='usd'}],
 ['not successful',f=>{f.charge.status='failed'}],
 ['not paid',f=>{f.charge.paid=false}],
 ['live charge',f=>{f.charge.livemode=true}],
 ['bad stored paid evidence',f=>{f.bill.providerVerifiedPaid=false}],
 ['billing lock changed',f=>{f.account.openBillingRequestId='wrong_lock_01'}],
 ['billing revision drift',f=>{f.account.billingVersion=4}],
 ['negative wallet',f=>{f.account.creditWalletRemaining=-1}],
 ['inflight reservation',f=>{f.account.reserved=1}],
 ['unrecognized current plan',f=>{f.account.plan='NonPlan'}],
 ['refund amount present',f=>{f.charge.refunded_amount=100}],
 ['reversed charge',f=>{f.charge.reversed=true}],
 ['already settled',f=>{f.bill.status='paid'}]
])test('P54 fail closed: '+label,()=>{
 const f=fixture();mutate(f);
 assert.throws(()=>digest(f),/P54_DENIED/);
});
test('P54 15-minute time window is bounded',()=>assert.equal(REVIEW_TTL_MS,900000));
test('P54 Omise adapter refuses live charge ID without network',async()=>{
 const a=createOmiseTestAdapter({fetchImpl:async()=>{throw Error('should_not_call')},
  readSecret:async()=> 'skey_test_only'});
 await assert.rejects(()=>a.getCharge('chrg_live_123'),/test_charge_id_only/);
});
test('P54 Omise adapter refuses live secret without network',async()=>{
 const a=createOmiseTestAdapter({fetchImpl:async()=>{throw Error('should_not_call')},
  readSecret:async()=> 'skey_live_only'});
 await assert.rejects(()=>a.getCharge(chId),/omise_test_key_only/);
});
test('P54 Omise adapter only GETs exact test charge',async()=>{
 const calls=[];
 const adapter=createOmiseTestAdapter({
  readSecret:async()=> 'skey_test_demo',
  fetchImpl:async(url,opts)=>{calls.push({url,opts});return {
   ok:true,json:async()=>({id:chId,livemode:false})};
  }});
 assert.equal((await adapter.getCharge(chId)).id,chId);
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.method,'GET');
 assert.equal(calls[0].url,'https://api.omise.co/charges/'+chId);
 assert.ok(calls[0].opts.headers.Authorization.startsWith('Basic '));
});
test('P54 provider rejects live-looking payload',async()=>{
 const a=createOmiseTestAdapter({readSecret:async()=> 'skey_test_demo',
  fetchImpl:async()=>({ok:true,json:async()=>({id:chId,livemode:true})})});
 await assert.rejects(()=>a.getCharge(chId),/omise_charge_not_test/);
});
test('P54 exported API does not include any settlement, refund, grant or unlock',()=>{
 const deps={env:demoEnv,db:{runTransaction(){},collection(){}},
  auth:{verifyIdToken(){},getUser(){}},
  appCheck:{verifyToken(){}},provider:{getCharge(){}},now:()=>Date.now()};
 const api=buildDemoRecoveryBackend(deps);
 assert.deepEqual(Object.keys(api).sort(),
  ['openCase','ownerDecision','reviewFinance','reviewTechnical','status'].sort());
 assert.equal(Object.isFrozen(api),true);
});
