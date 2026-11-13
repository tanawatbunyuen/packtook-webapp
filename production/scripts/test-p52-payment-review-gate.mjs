/** P52 pure fail-closed review gate regression: NO network, Firebase, Omise or writes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import gate from '../payment-functions/payment-review-dual-control.cjs';
const T=1794580000000;
const fixture=()=>({
  account:{id:'account_demo_001',plan:'Starter',period:'2026-11',planExpiresAt:'2026-12-01T00:00:00.000Z',
    used:0,reserved:0,creditWalletRemaining:120,billingVersion:3,openBillingRequestId:'request_demo_001'},
  bill:{id:'request_demo_001',accountId:'account_demo_001',status:'payment_review',reviewReason:'invalid_credit_state',
    baseBillingVersion:3,amountTHB:199,omiseChargeId:'charge_demo_001',providerVerifiedPaid:true,
    providerVerifiedChargeId:'charge_demo_001',providerVerifiedAmountSatang:19900,providerVerifiedLivemode:false},
  charge:{id:'charge_demo_001',status:'successful',paid:true,livemode:false,currency:'thb',amount:19900,
    source:{type:'promptpay'},metadata:{uid:'account_demo_001',requestId:'request_demo_001'}},
  checks:{providerFetchedServerSide:true,authzVerifiedServerSide:true,snapshotReadInTransaction:true,
    noPriorEntitlementGrant:true,ledgerReviewed:true,billingEvidenceUnchanged:true,providerCheckedAtMs:T},
  nowMs:T
});
const make=(f=fixture())=>gate.createReviewCase({...f,caseId:'case_demo_001',requesterId:'maker_owner_001'});
const propose=(s,who,role,hash=s.evidenceHash,now=T+1000)=>gate.addReview(s,{reviewerId:who,role,authorizedByTrustedServer:true,evidenceHash:hash,nowMs:now});
const scenarios=[
  ['account mismatch',f=>{f.bill.accountId='account_other_01'}],
  ['bill wrong status',f=>{f.bill.status='paid'}],
  ['charge wrong ID',f=>{f.charge.id='another_charge_01'}],
  ['charge not paid',f=>{f.charge.paid=false}],
  ['provider failed',f=>{f.charge.status='failed'}],
  ['provider live charge',f=>{f.charge.livemode=true}],
  ['wrong currency',f=>{f.charge.currency='usd'}],
  ['wrong source type',f=>{f.charge.source.type='card'}],
  ['amount differs',f=>{f.charge.amount=100}],
  ['provider uid mismatch',f=>{f.charge.metadata.uid='another_account_01'}],
  ['provider request mismatch',f=>{f.charge.metadata.requestId='another_request_01'}],
  ['stored evidence differs',f=>{f.bill.providerVerifiedPaid=false}],
  ['billing lock missing',f=>{f.account.openBillingRequestId=null}],
  ['billing revision drift',f=>{f.account.billingVersion=4}],
  ['used invalid',f=>{f.account.used='NaN'}],
  ['reserved invalid',f=>{f.account.reserved=Number.MAX_SAFE_INTEGER+1}],
  ['wallet negative',f=>{f.account.creditWalletRemaining=-1}],
  ['inflight recording',f=>{f.account.reserved=1}],
  ['unknown plan',f=>{f.account.plan='UnknownTier'}],
  ['missing server provider check',f=>{f.checks.providerFetchedServerSide=false}],
  ['missing server authz',f=>{f.checks.authzVerifiedServerSide=false}],
  ['no transactional snapshot',f=>{f.checks.snapshotReadInTransaction=false}],
  ['prior grant possible',f=>{f.checks.noPriorEntitlementGrant=false}],
  ['ledger not reviewed',f=>{f.checks.ledgerReviewed=false}],
  ['bill evidence changed',f=>{f.checks.billingEvidenceUnchanged=false}],
  ['provider check stale',f=>{f.checks.providerCheckedAtMs=T-gate.REVIEW_TTL_MS-1}],
  ['provider check in future',f=>{f.checks.providerCheckedAtMs=T+10000}]
];
for(const [label,mutate] of scenarios){
  test("P52 fail-closed: "+label,()=>{const f=fixture();mutate(f);const s=make(f);
    assert.equal(s.status,'BLOCKED',JSON.stringify(s));assert.equal(s.action,'NONE');});
}
test('P52 valid evidence creates review-only case; not a wallet command',()=>{
  const s=make();assert.equal(s.status,'AWAITING_TWO_REVIEWERS');assert.equal(s.approvals.length,0);assert.equal(s.action,'NONE');
});
test('P52 distinct finance and technical reviewers reach REVIEW_READY_ONLY',()=>{
  const start=make();const f=propose(start,'finance_reviewer_01','finance');assert.equal(f.accepted,true);
  const t=propose(f.state,'tech_reviewer_01','technical');assert.equal(t.accepted,true);
  assert.equal(t.state.status,'REVIEW_READY_ONLY');assert.equal(t.state.action,'NONE');
  const decision=gate.assessReview(t.state,fixture());assert.equal(decision.status,'REVIEW_READY_ONLY');assert.equal(decision.action,'NONE');
});
test('P52 duplicate reviewer is blocked',()=>{
  const f=propose(make(),'finance_reviewer_01','finance');
  assert.equal(propose(f.state,'finance_reviewer_01','technical').accepted,false);
});
test('P52 duplicate role is blocked',()=>{
  const f=propose(make(),'finance_reviewer_01','finance');
  assert.equal(propose(f.state,'finance_reviewer_02','finance').accepted,false);
});
test('P52 maker self-review is blocked',()=>{
  assert.equal(propose(make(),'maker_owner_001','finance').accepted,false);
});
test('P52 customer approval is blocked',()=>{
  assert.equal(propose(make(),'account_demo_001','finance').accepted,false);
});
test('P52 unauthorized review is blocked',()=>{
  const s=make();assert.equal(gate.addReview(s,{reviewerId:'finance_reviewer_01',role:'finance',evidenceHash:s.evidenceHash,nowMs:T+1000}).accepted,false);
});
test('P52 stale review attempt is blocked',()=>{
  const s=make();assert.equal(propose(s,'finance_reviewer_01','finance',s.evidenceHash,T+gate.REVIEW_TTL_MS+1).accepted,false);
});
test('P52 approval for different evidence hash is blocked',()=>{
  assert.equal(propose(make(),'finance_reviewer_01','finance','different').accepted,false);
});
test('P52 no third review can be appended',()=>{
  const s=propose(propose(make(),'finance_reviewer_01','finance').state,'tech_reviewer_01','technical').state;
  assert.equal(propose(s,'extra_reviewer_01','technical').accepted,false);
});
test('P52 snapshot drift blocks ready case after two reviews',()=>{
  const s=propose(propose(make(),'finance_reviewer_01','finance').state,'tech_reviewer_01','technical').state;
  const f=fixture();f.account.creditWalletRemaining=90;
  assert.equal(gate.assessReview(s,f).status,'BLOCKED');
});
test('P52 provider changes after approval block ready case',()=>{
  const s=propose(propose(make(),'finance_reviewer_01','finance').state,'tech_reviewer_01','technical').state;
  const f=fixture();f.charge.paid=false;
  assert.equal(gate.assessReview(s,f).status,'BLOCKED');
});
test('P52 expired full case cannot become ready',()=>{
  const s=propose(propose(make(),'finance_reviewer_01','finance').state,'tech_reviewer_01','technical').state;
  const f=fixture();f.nowMs=T+gate.REVIEW_TTL_MS+1;f.checks.providerCheckedAtMs=f.nowMs;
  assert.equal(gate.assessReview(s,f).status,'BLOCKED');
});
test('P52 mutated original input does not mutate case record',()=>{
  const f=fixture(),s=make(f);f.account.creditWalletRemaining=0;
  assert.notEqual(s.evidenceHash,gate.evidenceFingerprint(f.account,f.bill,f.charge));
  assert.equal(s.approvals.length,0);
});
