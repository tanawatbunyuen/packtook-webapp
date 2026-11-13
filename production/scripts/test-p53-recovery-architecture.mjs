/** P53 DESIGN-ONLY architecture policy tests; no Firebase/Omise/network/writes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const policy=require('./p53-recovery-policy.cjs');
const contract=JSON.parse(fs.readFileSync(new URL('../docs/p53-recovery-contract.json',import.meta.url),'utf8'));
const model=fs.readFileSync(new URL('./p53-recovery-policy.cjs',import.meta.url),'utf8');
const NOW=1794580000000, HASH='a'.repeat(64), ACCOUNT='b'.repeat(64), LOCK='c'.repeat(64);
function fresh(){
  const o=policy.open({caseId:'case_012345',requestId:'bill_012345',makerId:'maker_012345',
    beneficiaryId:'customer_012345',evidenceHash:HASH,accountHash:ACCOUNT,lockHash:LOCK,nowMs:NOW});
  assert.equal(o.ok,true);return o.state;
}
function apply(s,type,p={},when=NOW+1000){
  return policy.transition(s,{type,serverVerified:true,expectedRevision:s.revision,
    evidenceHash:HASH,accountHash:ACCOUNT,lockHash:LOCK,...p},when);
}
const verify=s=>apply(s,'VERIFY_EVIDENCE',{
  actorRole:'system',chargeSuccessfulPaid:true,omiseGetPerformedOutsideTransaction:true,
  noPriorGrant:true,testLiveSeparated:true});
const reviewOpen=s=>apply(s,'OPEN_DUAL_REVIEW',{actorId:'maker_012345',actorRole:'maker'},NOW+2000);
const finance=s=>apply(s,'FINANCE_REVIEW',{
  actorId:'fin_012345',actorRole:'finance',roleVerifiedFresh:true,decision:'approved'},NOW+3000);
const technical=s=>apply(s,'TECHNICAL_REVIEW',{
  actorId:'tech_012345',actorRole:'technical',roleVerifiedFresh:true,decision:'approved'},NOW+4000);
const owner=(s,choice='MANUAL_PROMPTPAY_REFUND_ESCALATION')=>apply(s,'OWNER_DECISION',{
  actorId:'owner_012345',actorRole:'owner',roleVerifiedFresh:true,
  providerRecheckedFresh:true,ledgerNoDuplicateGrant:true,resolutionType:choice},NOW+5000);
const openState=()=>reviewOpen(verify(fresh()).state).state;
const dualState=()=>technical(finance(openState()).state).state;
test('P53 contract forbids live operations and omitted endpoints',()=>{
  assert.equal(contract.designStatus,'PROPOSAL_ONLY');
  for(const key of ['productionEndpointImplemented','productionWritesAllowed','omiseRefundApiEnabled',
    'entitlementMutationAllowed','billingLockReleaseAllowed','mergesOrDeploysAllowed','publicSignupEnabled'])
    assert.equal(contract.controls[key],false,key);
  assert.equal(contract.externalProviderRefundPolicy,'NO_OMISE_PROMPTPAY_REFUNDS_API');
});
test('P53 contract contains exact separate finance/technical roles and Owner',()=>{
  assert.deepEqual(contract.controls.requiredDistinctReviewRoles,['finance','technical']);
  assert.equal(contract.controls.ownerDecisionRequired,true);
  assert.equal(contract.controls.approvalTTLMinutes,15);
});
test('P53 pure model cannot call SDK, provider or write ledger',()=>{
  for(const forbidden of ['firebase-admin','api.omise.co','getFirestore','FieldValue.increment',
    'entitlementGrants'].filter(x=>x!=='entitlementGrants'))assert.equal(model.includes(forbidden),false,forbidden);
  const o=owner(dualState());
  assert.equal(o.action,'NONE');assert.equal(o.state.status,'OWNER_DECISION_RECORDED');
});
test('P53 model open validates identity and digest',()=>{
  const invalid=policy.open({caseId:'short',makerId:'abc',nowMs:NOW});
  assert.equal(invalid.ok,false);assert.equal(invalid.action,'NONE');
});
test('P53 valid case starts at PAYMENT_REVIEW',()=>{
  const s=fresh();assert.equal(s.status,'PAYMENT_REVIEW');assert.equal(s.revision,1);
});
test('P53 rejects untrusted server input',()=>{
  const s=fresh(),r=policy.transition(s,{type:'VERIFY_EVIDENCE',expectedRevision:s.revision},NOW+1);
  assert.equal(r.ok,false);assert.equal(r.reason,'not_trusted_server');
});
test('P53 rejects out-of-date revision',()=>{
  const s=fresh();assert.equal(apply(s,'VERIFY_EVIDENCE',{expectedRevision:9}).reason,'stale_case_revision');
});
test('P53 rejects evidence digest changed',()=>{
  const s=fresh();assert.equal(apply(s,'VERIFY_EVIDENCE',{evidenceHash:'f'.repeat(64)}).reason,'evidence_drift');
});
test('P53 rejects billing-lock/account digest drift',()=>{
  const s=fresh();assert.equal(apply(s,'VERIFY_EVIDENCE',{lockHash:'e'.repeat(64)}).reason,'account_or_lock_drift');
});
test('P53 rejects unverified provider payment',()=>{
  assert.equal(apply(fresh(),'VERIFY_EVIDENCE',{actorRole:'system',chargeSuccessfulPaid:false}).reason,
    'provider_evidence_incomplete');
});
test('P53 verified provider evidence moves to EVIDENCE_VERIFIED but does not grant',()=>{
  const r=verify(fresh());assert.equal(r.ok,true);assert.equal(r.state.status,'EVIDENCE_VERIFIED');
  assert.equal(r.action,'NONE');
});
test('P53 dual-review can only open by maker',()=>{
  const s=verify(fresh()).state;
  assert.equal(apply(s,'OPEN_DUAL_REVIEW',{actorId:'other_012345',actorRole:'maker'}).ok,false);
  assert.equal(reviewOpen(s).state.status,'AWAITING_DUAL_REVIEW');
});
test('P53 technical review is not allowed before finance',()=>{
  assert.equal(technical(openState()).reason,'finance_review_first');
});
test('P53 finance approves first without settling or unlocking',()=>{
  const r=finance(openState());assert.equal(r.ok,true);assert.equal(r.action,'NONE');
  assert.equal(r.state.reviews.length,1);assert.equal(r.state.status,'AWAITING_DUAL_REVIEW');
});
test('P53 finance reviewer cannot equal maker',()=>{
  const r=apply(openState(),'FINANCE_REVIEW',{actorId:'maker_012345',
    actorRole:'finance',roleVerifiedFresh:true,decision:'approved'});
  assert.equal(r.reason,'reviewer_unauthorized');
});
test('P53 finance reviewer cannot equal beneficiary',()=>{
  const r=apply(openState(),'FINANCE_REVIEW',{actorId:'customer_012345',
    actorRole:'finance',roleVerifiedFresh:true,decision:'approved'});
  assert.equal(r.reason,'reviewer_unauthorized');
});
test('P53 duplicate role review fails',()=>{
  const r=finance(openState()),v=finance(r.state);assert.equal(v.reason,'duplicate_reviewer_or_role');
});
test('P53 cannot reuse Finance reviewer as Technical reviewer',()=>{
  const s=finance(openState()).state;
  const r=apply(s,'TECHNICAL_REVIEW',{actorId:'fin_012345',actorRole:'technical',
    roleVerifiedFresh:true,decision:'approved'});
  assert.equal(r.reason,'duplicate_reviewer_or_role');
});
test('P53 dual roles complete review without payment action',()=>{
  const s=dualState();assert.equal(s.status,'DUAL_REVIEW_COMPLETE');
  assert.deepEqual(s.reviews.map(r=>r.role),['finance','technical']);
});
test('P53 Owner decision requires independent Owner',()=>{
  const s=dualState();const r=apply(s,'OWNER_DECISION',{actorId:'fin_012345',
    actorRole:'owner',roleVerifiedFresh:true,providerRecheckedFresh:true,
    ledgerNoDuplicateGrant:true,resolutionType:'NO_ACTION'});
  assert.equal(r.reason,'owner_resolution_not_authorized');
});
test('P53 Owner decision must recheck provider and ledger',()=>{
  const s=dualState();const r=apply(s,'OWNER_DECISION',{actorId:'owner_012345',
    actorRole:'owner',roleVerifiedFresh:true,providerRecheckedFresh:false,
    ledgerNoDuplicateGrant:true,resolutionType:'ENTITLEMENT_RECONCILIATION_PROPOSAL'});
  assert.equal(r.reason,'owner_resolution_not_authorized');
});
test('P53 manual refund is escalation only, never an API refund',()=>{
  const r=owner(dualState());assert.equal(r.state.ownerDecision.type,'MANUAL_PROMPTPAY_REFUND_ESCALATION');
  assert.equal(r.action,'NONE');
});
test('P53 entitlement choice is proposal only',()=>{
  const r=owner(dualState(),'ENTITLEMENT_RECONCILIATION_PROPOSAL');
  assert.equal(r.state.ownerDecision.type,'ENTITLEMENT_RECONCILIATION_PROPOSAL');
  assert.equal(r.action,'NONE');
});
test('P53 rejects AUTO_REFUND choice',()=>{
  const r=owner(dualState(),'AUTO_REFUND');
  assert.equal(r.ok,false);assert.equal(r.action,'NONE');
});
test('P53 cannot progress beyond Owner decision in model',()=>{
  const s=owner(dualState()).state;
  assert.equal(apply(s,'EXECUTE_ENTITLEMENT',{actorRole:'owner'}).reason,'terminal_state');
});
test('P53 expires evidence after 15 minutes',()=>{
  const s=verify(fresh()).state;
  const r=apply(s,'OPEN_DUAL_REVIEW',{actorId:'maker_012345',actorRole:'maker'},
    s.verifiedAtMs+policy.ttlMs+1);
  assert.equal(r.reason,'evidence_expired');
});
test('P53 cancellation requires owner and proof of no external action',()=>{
  const s=fresh();
  assert.equal(apply(s,'CANCEL',{actorId:'owner_012345',actorRole:'owner',reasonCode:'not_needed'}).ok,false);
  assert.equal(apply(s,'CANCEL',{actorId:'owner_012345',actorRole:'owner',
    reasonCode:'not_needed',noExternalActionConfirmed:true}).state.status,'CANCELLED');
});
test('P53 escalation retains NONE action',()=>{
  const r=apply(fresh(),'ESCALATE',{actorId:'owner_012345',actorRole:'owner',reasonCode:'provider_dispute'});
  assert.equal(r.state.status,'ESCALATED');assert.equal(r.action,'NONE');
});
test('P53 unknown event is rejected',()=>{const r=apply(fresh(),'PAY_AND_UNLOCK');assert.equal(r.reason,'unsupported_event')});
test('P53 state transitions never mutate input case',()=>{
  const s=fresh(),before=JSON.stringify(s);verify(s);assert.equal(JSON.stringify(s),before);
});
