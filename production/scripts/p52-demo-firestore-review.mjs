/**
 * P52 DEMO-ONLY Firestore transaction test for dual approval, no settlement.
 * Writes ONLY to an isolated collection in the localhost DEMO emulator.
 * Does NOT verify production identity/provider; approvals are synthetic fixtures.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const env=process.env;
function refuse(message){throw Error('P52 SAFETY GUARD: '+message)}
if(env.GCLOUD_PROJECT!=='demo-packtook-v72' ||
   env.GOOGLE_CLOUD_PROJECT!=='demo-packtook-v72' ||
   env.GCP_PROJECT!=='demo-packtook-v72') refuse('Only demo-packtook-v72 project accepted');
if(env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080') refuse('Local Firestore Emulator required');
if(env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_TOKEN ||
   env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE || env.PACKTOOK_PRODUCTION_PROJECT_ID)
  refuse('Production credentials or project guard env detected');
const require=createRequire(new URL('../payment-functions/index.js', import.meta.url));
const admin=require('firebase-admin');
const gate=require('../payment-functions/payment-review-dual-control.cjs');
admin.initializeApp({projectId:'demo-packtook-v72'});
const db=admin.firestore();
const NOW=1794580000000;
const data=()=>({
 account:{id:'account_demo_001',plan:'Starter',period:'2026-11',planExpiresAt:'2026-12-01T00:00:00.000Z',
   used:0,reserved:0,creditWalletRemaining:120,billingVersion:3,openBillingRequestId:'request_demo_001'},
 bill:{id:'request_demo_001',accountId:'account_demo_001',status:'payment_review',reviewReason:'invalid_credit_state',
   baseBillingVersion:3,amountTHB:199,omiseChargeId:'charge_demo_001',providerVerifiedPaid:true,
   providerVerifiedChargeId:'charge_demo_001',providerVerifiedAmountSatang:19900,providerVerifiedLivemode:false},
 charge:{id:'charge_demo_001',status:'successful',paid:true,livemode:false,currency:'thb',amount:19900,
   source:{type:'promptpay'},metadata:{uid:'account_demo_001',requestId:'request_demo_001'}},
 checks:{providerFetchedServerSide:true,authzVerifiedServerSide:true,snapshotReadInTransaction:true,
   noPriorEntitlementGrant:true,ledgerReviewed:true,billingEvidenceUnchanged:true,providerCheckedAtMs:NOW},
 nowMs:NOW
});
const cases=db.collection('p52DemoDualReviewCases');
const approvals=async (caseId, reviewerId,role,now=NOW+1000)=>db.runTransaction(async tx=>{
  const doc=cases.doc(caseId);const snap=await tx.get(doc);
  if(!snap.exists)throw Error('case_missing');
  const state=snap.data();
  const proposed=gate.addReview(state,{reviewerId,role,evidenceHash:state.evidenceHash,
    authorizedByTrustedServer:true,nowMs:now});
  if(proposed.accepted){
    tx.set(doc,proposed.state);
    tx.create(doc.collection('demoAudits').doc(),{reviewerId,role,atMs:now,
      result:'recorded_review_only',caseRevision:proposed.state.revision});
  }
  return {accepted:proposed.accepted,reason:proposed.reason};
},{maxAttempts:5});
let count=0;
const pass=(title)=>{count++;console.log('PASS P52 '+title)};
try{
 const f=data(),s=gate.createReviewCase({...f,caseId:'p52_demo_case_001',requesterId:'owner_maker_001'});
 assert.equal(s.status,'AWAITING_TWO_REVIEWERS');
 await cases.doc(s.caseId).create(s);
 pass('case created in local emulator with immutable evidence hash');
 const first=await approvals(s.caseId,'finance_user_001','finance');
 assert.equal(first.accepted,true);
 pass('first independent synthetic reviewer recorded transactionally');
 const duplicate=await approvals(s.caseId,'finance_user_001','technical');
 assert.equal(duplicate.accepted,false);
 pass('same reviewer cannot approve twice');
 const second=await approvals(s.caseId,'technical_user_001','technical');
 assert.equal(second.accepted,true);
 const ready=(await cases.doc(s.caseId).get()).data();
 assert.equal(ready.status,'REVIEW_READY_ONLY');
 assert.equal(ready.approvals.length,2);
 assert.equal(ready.action,'NONE');
 pass('two distinct synthetic roles produce REVIEW_READY_ONLY');
 const audits=await cases.doc(s.caseId).collection('demoAudits').get();
 assert.equal(audits.size,2);
 pass('approval audit records are not duplicated');
 const changed=data();changed.account.creditWalletRemaining=121;
 assert.equal(gate.assessReview(ready,changed).status,'BLOCKED');
 pass('wallet snapshot drift requires fresh approvals');
 const raceCase=gate.createReviewCase({...data(),caseId:'p52_demo_case_race',requesterId:'owner_maker_001'});
 await cases.doc(raceCase.caseId).create(raceCase);
 const results=await Promise.all([
  approvals(raceCase.caseId,'finance_racer_001','finance'),
  approvals(raceCase.caseId,'finance_racer_002','finance')]);
 assert.equal(results.filter(v=>v.accepted).length,1);
 const afterRace=(await cases.doc(raceCase.caseId).get()).data();
 assert.equal(afterRace.approvals.length,1);
 pass('concurrent same-role approvals commit only one');
 const stale=data();stale.checks.providerCheckedAtMs=NOW-gate.REVIEW_TTL_MS-1;
 assert.equal(gate.createReviewCase({...stale,caseId:'p52_demo_stale_001',requesterId:'owner_maker_001'}).status,'BLOCKED');
 pass('stale provider check refused');
 console.log('=== PACKTOOK P52 DEMO FIRESTORE DUAL REVIEW ===');
 console.log('P52_DEMO_FIRESTORE_TESTS: '+count+'/8 PASS');
 console.log('P52_WALLET_WRITES: 0 | PAYMENT_SETTLEMENT: 0 | BILLING_LOCK_RELEASE: 0');
 console.log('P52_REVIEWERS: SYNTHETIC_NOT_REAL_HUMAN_APPROVAL');
 console.log('P52_RELEASE: NO_GO_RELEASE / PUBLIC_CLOSED / MIGRATION_HOLD');
 console.log('=== P52 END ===');
} finally {await admin.app().delete();}
