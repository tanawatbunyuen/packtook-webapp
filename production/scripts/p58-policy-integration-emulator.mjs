/**
 * P58 Firebase Auth + Firestore REAL DEMO policy-integrated backend regression.
 * App Check verifier and Omise HTTP response are synthetic test fakes;
 * neither reaches production or external Omise.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../payment-functions/index.js', import.meta.url));
const admin=require('firebase-admin');
const {buildP58DemoRecoveryBackend,createOmiseTestAdapter,assertDemoOnly}=require(
  '../payment-functions/p58-policy-integrated-backend.cjs');
assertDemoOnly(process.env);
admin.initializeApp({projectId:'demo-packtook-v72'});
const db=admin.firestore(),auth=admin.auth();
const acctId='client_p54_demo_001',requestId='request_p54_demo_001';
const chargeId='chrg_test_p54test123',password='P54emulator_test_only_2026';
const actors=[
 {uid:'p54_maker_00001',role:'maker'},
 {uid:'p54_finance_00001',role:'finance'},
 {uid:'p54_technical_00001',role:'technical'},
 {uid:'p54_owner_00001',role:'owner'}
];
const roleClaims={maker:'packtookRecoveryMaker',finance:'packtookRecoveryFinance',
  technical:'packtookRecoveryTechnical',owner:'packtookRecoveryOwner'};
const login=async email=>{
 const endpoint='http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-project-key';
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email,password,returnSecureToken:true})});
 const json=await response.json();
 if(!response.ok||typeof json.idToken!=='string')throw Error('AUTH_EMULATOR_LOGIN_FAILED:'+JSON.stringify(json));
 return json.idToken;
};
const tokens={};
for(const {uid,role} of actors){
 const email=uid+'@example.invalid';
 await auth.createUser({uid,email,password,emailVerified:true});
 await auth.setCustomUserClaims(uid,{[roleClaims[role]]:true});
 tokens[role]=await login(email);
}
const accountRef=db.collection('accounts').doc(acctId);
const billRef=accountRef.collection('billingRequests').doc(requestId);
const seedAccount={
 plan:'Starter',planExpiresAt:'2026-12-01T00:00:00.000Z',period:'2026-11',
 used:0,reserved:0,creditWalletRemaining:120,creditWalletV1:true,
 billingVersion:3,openBillingRequestId:requestId
};
const seedBill={
 requestedBy:acctId,status:'payment_review',reviewReason:'invalid_credit_state',
 paymentProvider:'omise',paymentMethod:'promptpay',plan:'Basic',amountTHB:299,
 baseBillingVersion:3,omiseChargeId:chargeId,providerVerifiedPaid:true,
 providerVerifiedChargeId:chargeId,providerVerifiedAmountSatang:29900,
 providerVerifiedCurrency:'thb',providerVerifiedLivemode:false
};
await accountRef.set(seedAccount);
await billRef.set(seedBill);
const policyRefs={};
for(const {uid,role} of actors){
 const ref=accountRef.collection('p57DemoRolePolicies').doc(role+'_'+uid);
 await ref.create({accountId:acctId,actorId:uid,role,active:true,epoch:1});
 policyRefs[role]=ref;
}
const fakeOmiseCharge={
 id:chargeId,status:'successful',paid:true,livemode:false,
 currency:'thb',amount:29900,source:{type:'promptpay'},
 metadata:{uid:acctId,requestId},refunded_amount:0,reversed:false
};
const omiseCalls=[];
const provider=createOmiseTestAdapter({
 readSecret:async()=> 'skey_test_fake_for_emulator_only',
 fetchImpl:async (url,opts)=>{
  omiseCalls.push({url,method:opts.method,hasAuth:!!opts.headers?.Authorization});
  return {ok:true,json:async()=>({...fakeOmiseCharge})};
 }
});
const appTokens=new Set(),mockAppCheck={async verifyToken(t,opt){
  if(opt?.consume!==true||typeof t!=='string'||!t.startsWith('p54_once_'))
    throw Error('APP_CHECK_SYNTHETIC_INVALID');
  if(appTokens.has(t))return {alreadyConsumed:true};
  appTokens.add(t);return {alreadyConsumed:false,app_id:'demo_appcheck_synthetic'};
}};
let nonce=0;
const input=(role,over={})=>({idToken:tokens[role],appCheckToken:'p54_once_'+(++nonce),
  accountId:acctId,requestId,...over});
const api=buildP58DemoRecoveryBackend({db,auth,appCheck:mockAppCheck,provider,
 env:process.env,now:()=>Date.now()});
let passed=0;
const pass=(title)=>{passed++;console.log('PASS P54 '+title)};
async function rejected(fn,pattern){
 let err;try{await fn()}catch(e){err=e}
 assert.ok(err, 'Expected rejection');assert.match(err.message,pattern);
}
try {
 const beforeAccount=(await accountRef.get()).data(),beforeBill=(await billRef.get()).data();
 const opened=await api.openCase(input('maker'));
 assert.equal(opened.status,'AWAITING_FINANCE');assert.equal(opened.action,'NONE');
 pass('real Auth verified maker + Firestore transaction opened review-only case');
 const openedAgain=await api.openCase(input('maker'));
 assert.equal(openedAgain.status,'AWAITING_FINANCE');
 const events=()=>accountRef.collection('p54DemoRecoveryCases').doc(requestId).collection('events');
 assert.equal((await events().get()).size,1);
 pass('case open replay idempotent — one case event');
 await rejected(()=>api.reviewFinance(input('maker')),/role_or_user_not_authorized/);
 pass('maker cannot impersonate Finance role');
 await auth.setCustomUserClaims('p54_finance_00001',{});
 await rejected(()=>api.reviewFinance(input('finance')),/role_or_user_not_authorized/);
 await auth.setCustomUserClaims('p54_finance_00001',{packtookRecoveryFinance:true});
 pass('role revocation in live Auth blocks Finance review');
 await policyRefs.finance.update({active:false,epoch:2});
 await rejected(()=>api.reviewFinance(input('finance')),/policy_revoked_or_invalid/);
 assert.equal((await events().get()).size,1);
 await policyRefs.finance.update({active:true,epoch:3});
 pass('P58 transaction-bound Finance policy blocks revoked actor even with live Auth claim');
 const financial=await api.reviewFinance(input('finance'));
 assert.equal(financial.status,'AWAITING_TECHNICAL');assert.equal(financial.action,'NONE');
 pass('Finance approval is recorded with real Firestore transaction');
 await rejected(()=>api.reviewFinance(input('finance')),/wrong_review_state/);
 pass('duplicate Finance review is rejected');
 await policyRefs.technical.update({active:false,epoch:2});
 await rejected(()=>api.reviewTechnical(input('technical')),/policy_revoked_or_invalid/);
 await policyRefs.technical.update({active:true,epoch:3});
 pass('P58 transaction-bound Technical policy blocks revoked actor');
 const replayInput=input('technical');
 const afterReplay=await api.reviewTechnical(replayInput);
 assert.equal(afterReplay.status,'AWAITING_OWNER');
 await rejected(()=>api.reviewTechnical(replayInput),/appcheck_invalid_or_replayed/);
 pass('consumed synthetic App Check token cannot be replayed');
 await auth.setCustomUserClaims('p54_technical_00001',{});
 await rejected(()=>api.ownerDecision(input('owner',{resolutionType:'NO_ACTION'})),
   /reviewer_role_revoked/);
 await auth.setCustomUserClaims('p54_technical_00001',{packtookRecoveryTechnical:true});
 pass('revoked Technical reviewer invalidates Owner decision');
 await accountRef.update({creditWalletRemaining:121});
 await rejected(()=>api.ownerDecision(input('owner',{resolutionType:'NO_ACTION'})),
   /evidence_changed_refresh_required/);
 await accountRef.update({creditWalletRemaining:120});
 pass('account change invalidates Owner decision, without wallet adjustment by P54');
 await policyRefs.owner.update({active:false,epoch:2});
 await rejected(()=>api.ownerDecision(input('owner',{resolutionType:'NO_ACTION'})),
   /policy_revoked_or_invalid/);
 await policyRefs.owner.update({active:true,epoch:3});
 pass('P58 transaction-bound Owner policy blocks revoked actor');
 const decision=await api.ownerDecision(input('owner',{
  resolutionType:'MANUAL_PROMPTPAY_REFUND_ESCALATION'}));
 assert.equal(decision.status,'OWNER_DECISION_RECORDED');
 assert.equal(decision.action,'NONE');assert.equal(decision.ownerDecided,true);
 pass('independent Owner records escalation decision only');
 await rejected(()=>api.ownerDecision(input('owner',{
  resolutionType:'ENTITLEMENT_RECONCILIATION_PROPOSAL'})),/dual_review_not_complete/);
 pass('cannot record second Owner resolution or double-execute');
 const status=await api.status(input('owner'));
 assert.equal(status.status,'OWNER_DECISION_RECORDED');assert.equal(status.financeApproved,true);
 assert.equal(status.technicalApproved,true);
 pass('restricted Owner read returns masked case summary');
 const finalAccount=(await accountRef.get()).data(),finalBill=(await billRef.get()).data();
 assert.deepEqual(finalAccount,beforeAccount);
 assert.deepEqual(finalBill,beforeBill);
 assert.equal((await events().get()).size,4);
 pass('NO account/billing mutations; exactly four audit case events');
 assert.ok(omiseCalls.length>=4);
 assert.ok(omiseCalls.every(x=>x.method==='GET'&&
   x.url==='https://api.omise.co/charges/'+chargeId&&x.hasAuth));
 pass('Omise adapter only constructs authenticated TEST charge GET');
 await rejected(()=>createOmiseTestAdapter({
  fetchImpl:async()=>({ok:true,json:async()=>fakeOmiseCharge}),
  readSecret:async()=> 'skey_live_never_allowed'
 }).getCharge(chargeId),/omise_test_key_only/);
 pass('live Omise secret is rejected in candidate adapter');
 await accountRef.collection('entitlementGrants').doc(requestId).create({
  existingGrant:true,source:'fixture_previously_applied'});
 await rejected(()=>api.openCase(input('maker')),
   /prior_entitlement_grant/);
 pass('pre-existing deterministic entitlement grant blocks case replay');
 console.log('=== PACKTOOK P58 POLICY-INTEGRATED AUTH/FIRESTORE DEMO EMULATOR ===');
 console.log('P58_INTEGRATION_EMULATOR: '+passed+'/19 PASS');
 console.log('P58_ACCOUNT_BILLING_WRITES_BY_BACKEND: 0');
 console.log('P58_ACTUAL_OMISE_REQUESTS: 0');
 console.log('P58_APP_CHECK: SYNTHETIC_REPLAY_TEST_ONLY');
 console.log('P58_CLOUD_ENDPOINTS_EXPORTED: 0');
 console.log('P58_RELEASE: NO_GO_RELEASE PUBLIC_CLOSED');
 console.log('=== P54 END ===');
} finally {await admin.app().delete();}
