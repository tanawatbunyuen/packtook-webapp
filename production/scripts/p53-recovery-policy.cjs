'use strict';
// P53 DOCUMENTATION/TEST MODEL ONLY — no Cloud Functions, SDK, network, DB,
// billing, Omise or production imports. serverVerified is synthetic test data.
// EVERY accepted transition returns action NONE.
const ttlMs=15*60*1000;
const resolutions=new Set(['ENTITLEMENT_RECONCILIATION_PROPOSAL',
  'MANUAL_PROMPTPAY_REFUND_ESCALATION','FRAUD_OR_DISPUTE_ESCALATION','NO_ACTION']);
const states=new Set(['PAYMENT_REVIEW','EVIDENCE_VERIFIED','AWAITING_DUAL_REVIEW',
  'DUAL_REVIEW_COMPLETE','OWNER_DECISION_RECORDED','ESCALATED','CANCELLED']);
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{6,128}$/.test(x);
const validHash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const validTime=x=>Number.isSafeInteger(x)&&x>=0;
const fail=(state,reason)=>({ok:false,reason,state,action:'NONE'});
const ok=(state)=>({ok:true,reason:null,state,action:'NONE'});
function open({caseId,requestId,makerId,beneficiaryId,evidenceHash,accountHash,lockHash,nowMs}={}){
  if(![caseId,requestId,makerId,beneficiaryId].every(validId)||
    ![evidenceHash,accountHash,lockHash].every(validHash)||
    makerId===beneficiaryId||!validTime(nowMs))
    return fail(null,'invalid_case');
  return ok({status:'PAYMENT_REVIEW',caseId,requestId,makerId,beneficiaryId,
    evidenceHash,accountHash,lockHash,revision:1,createdAtMs:nowMs,
    verifiedAtMs:null,reviews:[],ownerDecision:null});
}
function transition(current,event={},nowMs){
  if(!current||!states.has(current.status)||!event||!validTime(nowMs))
    return fail(current,'invalid_input');
  if(['OWNER_DECISION_RECORDED','ESCALATED','CANCELLED'].includes(current.status))
    return fail(current,'terminal_state');
  if(event.serverVerified!==true)return fail(current,'not_trusted_server');
  if(event.expectedRevision!==current.revision)return fail(current,'stale_case_revision');
  if(!['ESCALATE','CANCEL'].includes(event.type) &&
     current.verifiedAtMs!==null && (nowMs<current.verifiedAtMs || nowMs-current.verifiedAtMs>ttlMs))
    return fail(current,'evidence_expired');
  const next=change=>ok({...current,...change,revision:current.revision+1});
  if(event.type==='ESCALATE') {
    if(!validId(event.actorId)||!['owner','system'].includes(event.actorRole)||!event.reasonCode)
      return fail(current,'escalation_requires_authority');
    return next({status:'ESCALATED',escalationReason:event.reasonCode});
  }
  if(event.type==='CANCEL') {
    if(event.actorRole!=='owner'||!validId(event.actorId)||event.actorId===current.beneficiaryId||
      !event.reasonCode||event.noExternalActionConfirmed!==true)
      return fail(current,'cancel_requires_authority_no_execution');
    return next({status:'CANCELLED',cancelReason:event.reasonCode});
  }
  if(event.evidenceHash!==current.evidenceHash)return fail(current,'evidence_drift');
  if(event.accountHash!==current.accountHash||event.lockHash!==current.lockHash)
    return fail(current,'account_or_lock_drift');
  if(event.type==='VERIFY_EVIDENCE'){
    if(current.status!=='PAYMENT_REVIEW')return fail(current,'wrong_state');
    if(event.actorRole!=='system'||event.chargeSuccessfulPaid!==true||
      event.omiseGetPerformedOutsideTransaction!==true||event.noPriorGrant!==true||
      event.testLiveSeparated!==true)return fail(current,'provider_evidence_incomplete');
    return next({status:'EVIDENCE_VERIFIED',verifiedAtMs:nowMs});
  }
  if(event.type==='OPEN_DUAL_REVIEW'){
    if(current.status!=='EVIDENCE_VERIFIED'||event.actorId!==current.makerId||
      event.actorRole!=='maker')return fail(current,'maker_and_state_required');
    return next({status:'AWAITING_DUAL_REVIEW'});
  }
  if(event.type==='FINANCE_REVIEW'||event.type==='TECHNICAL_REVIEW'){
    const role=event.type==='FINANCE_REVIEW'?'finance':'technical';
    if(current.status!=='AWAITING_DUAL_REVIEW')return fail(current,'wrong_state');
    if(event.actorRole!==role||!validId(event.actorId)||event.actorId===current.makerId||
      event.actorId===current.beneficiaryId||event.roleVerifiedFresh!==true||
      event.decision!=='approved')return fail(current,'reviewer_unauthorized');
    if(current.reviews.some(x=>x.actorId===event.actorId||x.role===role))
      return fail(current,'duplicate_reviewer_or_role');
    if(role==='technical'&&!current.reviews.some(x=>x.role==='finance'))
      return fail(current,'finance_review_first');
    const reviews=[...current.reviews,{actorId:event.actorId,role,decision:'approved',atMs:nowMs}];
    return next({reviews,status:reviews.length===2?'DUAL_REVIEW_COMPLETE':'AWAITING_DUAL_REVIEW'});
  }
  if(event.type==='OWNER_DECISION'){
    if(current.status!=='DUAL_REVIEW_COMPLETE'||current.reviews.length!==2)
      return fail(current,'dual_review_missing');
    const identities=new Set([current.makerId,current.beneficiaryId,...current.reviews.map(x=>x.actorId)]);
    if(event.actorRole!=='owner'||!validId(event.actorId)||identities.has(event.actorId)||
      event.roleVerifiedFresh!==true||event.providerRecheckedFresh!==true||
      event.ledgerNoDuplicateGrant!==true||!resolutions.has(event.resolutionType))
      return fail(current,'owner_resolution_not_authorized');
    return next({status:'OWNER_DECISION_RECORDED',
      ownerDecision:{actorId:event.actorId,type:event.resolutionType,atMs:nowMs}});
  }
  return fail(current,'unsupported_event');
}
module.exports={open,transition,ttlMs};
