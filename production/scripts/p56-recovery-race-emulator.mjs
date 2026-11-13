/**
 * P56 — Real LOCAL Auth/Firestore Emulator contention and fault integration.
 * All provider and App Check responses are synthetic. No cloud/Omise connections.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../payment-functions/index.js',import.meta.url));
const admin=require('firebase-admin');
const {assertDemoOnly,buildDemoRecoveryBackend}=require('../payment-functions/p54-recovery-backend-candidate.cjs');
assertDemoOnly(process.env);
admin.initializeApp({projectId:'demo-packtook-v72'});
const db=admin.firestore(),auth=admin.auth();
const accountId='p56_client_0001',requestId='p56_request_0001',chargeId='chrg_test_p56ABC123';
const password='P56_emulator_only_password_2026';
const names=['maker','finance','technical','owner'],uids=Object.fromEntries(names.map(n=>[n,'p56_'+n+'_0001']));
const claims={maker:'packtookRecoveryMaker',finance:'packtookRecoveryFinance',technical:'packtookRecoveryTechnical',owner:'packtookRecoveryOwner'};
async function login(email){
 const r=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
 const j=await r.json();if(!r.ok||!j.idToken)throw Error('P56_EMULATOR_LOGIN_FAILED');
 return j.idToken;
}
const tokens={};let seq=0,providerCalls=0,providerFailure=false;
const input=(who,extra={})=>({accountId,requestId,idToken:tokens[who],appCheckToken:'p56_once_'+(++seq),...extra});
const consumed=new Set();
const check={async verifyToken(token,opts){
 if(opts?.consume!==true||!token?.startsWith('p56_once_'))throw Error('synthetic_appcheck_invalid');
 if(consumed.has(token))return {alreadyConsumed:true};
 consumed.add(token);return {alreadyConsumed:false};
}};
const charge={id:chargeId,status:'successful',paid:true,livemode:false,
 currency:'thb',amount:29900,source:{type:'promptpay'},
 metadata:{uid:accountId,requestId},refunded_amount:0,reversed:false};
const provider={async getCharge(id){
 providerCalls++;if(providerFailure)throw Error('P56_SYNTHETIC_OMISE_OUTAGE');
 assert.equal(id,chargeId);return {...charge,source:{...charge.source},metadata:{...charge.metadata}};
}};
const acctRef=db.collection('accounts').doc(accountId);
const billRef=acctRef.collection('billingRequests').doc(requestId);
const caseRef=acctRef.collection('p54DemoRecoveryCases').doc(requestId);
const events=()=>caseRef.collection('events').get();
const baseAccount={plan:'Starter',planExpiresAt:'2026-12-01T00:00:00.000Z',period:'2026-11',
 used:0,reserved:0,creditWalletRemaining:120,billingVersion:3,openBillingRequestId:requestId};
const baseBill={requestedBy:accountId,status:'payment_review',paymentProvider:'omise',
 paymentMethod:'promptpay',plan:'Basic',amountTHB:299,baseBillingVersion:3,
 omiseChargeId:chargeId,providerVerifiedPaid:true,providerVerifiedChargeId:chargeId,
 providerVerifiedAmountSatang:29900,providerVerifiedCurrency:'thb',providerVerifiedLivemode:false};
const api=buildDemoRecoveryBackend({db,auth,appCheck:check,provider,now:()=>Date.now(),env:process.env});
let count=0;function pass(n){count++;console.log('PASS P56 '+n)}
async function rejected(fn,pattern){
 await assert.rejects(fn,pattern);
}
async function concurrent(fn,n=8){
 const results=await Promise.allSettled(Array.from({length:n},()=>fn()));
 return {success:results.filter(x=>x.status==='fulfilled'),
 failure:results.filter(x=>x.status==='rejected')};
}
try{
 for(const n of names){
   const email=uids[n]+'@example.invalid';
   await auth.createUser({uid:uids[n],email,password,emailVerified:true});
   await auth.setCustomUserClaims(uids[n],{[claims[n]]:true});
   tokens[n]=await login(email);
 }
 await acctRef.set(baseAccount);await billRef.set(baseBill);
 const opened=await concurrent(()=>api.openCase(input('maker')),12);
 assert.equal(opened.success.length,12);
 assert.equal((await events()).size,1);
 assert.equal((await caseRef.get()).data().revision,1);
 pass('12 concurrent openCase: deterministic idempotency, exactly one audit');
 providerFailure=true;
 await rejected(()=>api.reviewFinance(input('finance')),/P56_SYNTHETIC_OMISE_OUTAGE/);
 assert.equal((await caseRef.get()).data().state,'AWAITING_FINANCE');
 assert.equal((await events()).size,1);
 providerFailure=false;
 pass('provider outage: fail closed with no review write');
 const finance=await concurrent(()=>api.reviewFinance(input('finance')),8);
 assert.equal(finance.success.length,1);
 assert.equal(finance.failure.length,7);
 assert.equal((await caseRef.get()).data().state,'AWAITING_TECHNICAL');
 assert.equal((await events()).size,2);
 pass('8 concurrent Finance approvals: one state transition');
 await auth.setCustomUserClaims(uids.technical,{});
 await rejected(()=>api.reviewTechnical(input('technical')),/role_or_user_not_authorized/);
 assert.equal((await events()).size,2);
 await auth.setCustomUserClaims(uids.technical,{[claims.technical]:true});
 pass('revoked Technical claim blocks new approval');
 const technical=await concurrent(()=>api.reviewTechnical(input('technical')),8);
 assert.equal(technical.success.length,1);
 assert.equal(technical.failure.length,7);
 assert.equal((await caseRef.get()).data().state,'AWAITING_OWNER');
 assert.equal((await events()).size,3);
 pass('8 concurrent Technical approvals: one state transition');
 await auth.setCustomUserClaims(uids.finance,{});
 await rejected(()=>api.ownerDecision(input('owner',{resolutionType:'NO_ACTION'})),/reviewer_role_revoked/);
 assert.equal((await events()).size,3);
 await auth.setCustomUserClaims(uids.finance,{[claims.finance]:true});
 pass('revoked Finance reviewer blocks Owner approval');
 const replay=input('owner');
 await api.status(replay);
 await rejected(()=>api.status(replay),/appcheck_invalid_or_replayed/);
 pass('synthetic limited-use token replay rejected');
 const owner=await concurrent(()=>api.ownerDecision(input('owner',{resolutionType:'NO_ACTION'})),8);
 assert.equal(owner.success.length,1);
 assert.equal(owner.failure.length,7);
 assert.equal((await caseRef.get()).data().state,'OWNER_DECISION_RECORDED');
 assert.equal((await events()).size,4);
 pass('8 concurrent Owner decisions: exactly one decision');
 const a=(await acctRef.get()).data(),b=(await billRef.get()).data();
 assert.deepEqual(a,baseAccount);assert.deepEqual(b,baseBill);
 assert.equal((await acctRef.collection('entitlementGrants').get()).size,0);
 pass('account, bill, grant untouched by candidate backend');
 assert.ok(providerCalls>0);
 pass('all provider reads came from synthetic Test provider');
 console.log('P56_RACE_EMULATOR: '+count+'/10 PASS');
 console.log('P56_ACTUAL_OMISE_REQUESTS: 0');
 console.log('P56_REAL_APP_CHECK_ATTESTATIONS: 0');
 console.log('P56_ACCOUNT_BILLING_GRANT_WRITES_BY_BACKEND: 0');
 console.log('P56_PRODUCTION_WRITES: 0');
 console.log('P56_NO_GO_RELEASE: true');
} finally {await admin.app().delete()}
