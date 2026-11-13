'use strict';
/**
 * P52 REVIEW-ONLY DUAL CONTROL CANDIDATE.
 * NOT wired to Firebase Callable Functions. NO refund / entitlement / wallet / lock writes.
 * Inputs represent evidence snapshots; trusted IAM/JWT and provider verification are NOT
 * implemented here. Production must verify them server-side before using this logic.
 */
const {createHash} = require('node:crypto');
const VALID_ROLES = new Set(['finance', 'technical']);
const REVIEW_TTL_MS = 15 * 60 * 1000;
const validInteger = x => Number.isSafeInteger(x) && x >= 0;
const validId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(x);
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');

function evidenceFingerprint(account, bill, charge) {
  if (!account || !bill || !charge) throw new TypeError('missing_evidence');
  // Canonical fixed order; never include secrets or free text. All fields required
  // before the snapshot is considered review-ready.
  return digest({v:1, accountId:account.id, plan:account.plan,
    period:account.period ?? null, expiresAt:account.planExpiresAt ?? null,
    used:account.used, reserved:account.reserved,
    walletRemaining:account.creditWalletRemaining,
    billingVersion:account.billingVersion,
    billingLock:account.openBillingRequestId,
    requestId:bill.id, billAccountId:bill.accountId, status:bill.status,
    reviewReason:bill.reviewReason, baseBillingVersion:bill.baseBillingVersion,
    billAmountTHB:bill.amountTHB, chargeId:bill.omiseChargeId,
    evidenceChargeId:bill.providerVerifiedChargeId,
    evidencePaid:bill.providerVerifiedPaid,
    evidenceAmountSatang:bill.providerVerifiedAmountSatang,
    chargeStatus:charge.status, chargePaid:charge.paid,
    chargeIdObserved:charge.id, chargeAmount:charge.amount,
    chargeCurrency:charge.currency, chargeLivemode:charge.livemode,
    chargeMethod:charge.source?.type,
    metaAccount:charge.metadata?.uid, metaRequest:charge.metadata?.requestId});
}

function checkEvidence({account:a,bill:b,charge:c,checks={},nowMs=Date.now()}={}) {
  const errors=[];
  if (!a || !b || !c) return ['missing_evidence'];
  if (!validId(a.id) || !validId(b.id) || !validId(b.accountId) || !validId(b.omiseChargeId)) errors.push('identity_invalid');
  if (a.id !== b.accountId) errors.push('account_mismatch');
  if (b.status !== 'payment_review') errors.push('wrong_bill_status');
  if (!validInteger(b.amountTHB) || b.amountTHB === 0 || !validInteger(c.amount)) errors.push('amount_invalid');
  if (c.id !== b.omiseChargeId || c.status !== 'successful' || c.paid !== true ||
      c.livemode !== false || c.currency !== 'thb' || c.source?.type !== 'promptpay' ||
      c.amount !== b.amountTHB * 100 || c.metadata?.uid !== a.id || c.metadata?.requestId !== b.id)
    errors.push('provider_evidence_mismatch');
  if (b.providerVerifiedPaid !== true || b.providerVerifiedChargeId !== c.id ||
      b.providerVerifiedAmountSatang !== c.amount || b.providerVerifiedLivemode !== false)
    errors.push('stored_paid_evidence_mismatch');
  if (a.openBillingRequestId !== b.id) errors.push('billing_lock_mismatch');
  if (!validInteger(a.billingVersion) || a.billingVersion !== b.baseBillingVersion) errors.push('billing_version_changed');
  if (!validInteger(a.used) || !validInteger(a.reserved) || !validInteger(a.creditWalletRemaining)) errors.push('unsafe_credit_counter');
  if (a.reserved !== 0) errors.push('inflight_recording');
  if (!['Free','Starter','Basic','Growth','Business','Pro'].includes(a.plan) ||
      (a.plan !== 'Free' && typeof a.planExpiresAt !== 'string')) errors.push('unknown_plan_or_expiry');
  // These are claims about privileged server-side work, NOT proof by themselves.
  if (checks.providerFetchedServerSide !== true || checks.authzVerifiedServerSide !== true ||
      checks.snapshotReadInTransaction !== true || checks.noPriorEntitlementGrant !== true ||
      checks.ledgerReviewed !== true || checks.billingEvidenceUnchanged !== true)
    errors.push('server_side_checks_missing');
  if (!validInteger(nowMs) || !validInteger(checks.providerCheckedAtMs) ||
      checks.providerCheckedAtMs > nowMs || nowMs-checks.providerCheckedAtMs > REVIEW_TTL_MS)
    errors.push('stale_provider_check');
  return [...new Set(errors)];
}

function createReviewCase({caseId,requesterId,account,bill,charge,checks,nowMs=Date.now()}) {
  const errors=checkEvidence({account,bill,charge,checks,nowMs});
  if (!validId(caseId) || !validId(requesterId) || requesterId===account?.id) errors.push('invalid_requester');
  if (errors.length) return {status:'BLOCKED',errors,action:'NONE'};
  return {status:'AWAITING_TWO_REVIEWERS',caseId,requesterId,accountId:account.id,
    requestId:bill.id,chargeId:bill.omiseChargeId,
    evidenceHash:evidenceFingerprint(account,bill,charge),
    createdAtMs:nowMs,revision:1,approvals:[],action:'NONE'};
}

function addReview(caseState, {reviewerId,role,authorizedByTrustedServer=false,
  evidenceHash,nowMs=Date.now()}={}) {
  if (!caseState || !['AWAITING_TWO_REVIEWERS','REVIEW_READY_ONLY'].includes(caseState.status))
    return {accepted:false,reason:'not_reviewable',state:caseState};
  if (!validId(reviewerId) || !VALID_ROLES.has(role) || authorizedByTrustedServer!==true)
    return {accepted:false,reason:'unauthorized_reviewer',state:caseState};
  if (reviewerId === caseState.requesterId || reviewerId === caseState.accountId)
    return {accepted:false,reason:'self_approval',state:caseState};
  if (!validInteger(nowMs) || nowMs < caseState.createdAtMs || nowMs-caseState.createdAtMs > REVIEW_TTL_MS)
    return {accepted:false,reason:'review_expired',state:caseState};
  if (evidenceHash !== caseState.evidenceHash)
    return {accepted:false,reason:'evidence_changed',state:caseState};
  if (caseState.approvals.some(a=>a.reviewerId===reviewerId || a.role===role))
    return {accepted:false,reason:'duplicate_reviewer_or_role',state:caseState};
  if (caseState.approvals.length >= 2)
    return {accepted:false,reason:'already_reviewed',state:caseState};
  const approvals=[...caseState.approvals,{reviewerId,role,evidenceHash,reviewedAtMs:nowMs}];
  return {accepted:true,reason:null,state:{...caseState,approvals,
    status:approvals.length===2?'REVIEW_READY_ONLY':'AWAITING_TWO_REVIEWERS',
    revision:caseState.revision+1,action:'NONE'}};
}

function assessReview(caseState,{account,bill,charge,checks,nowMs=Date.now()}={}) {
  if (!caseState || caseState.status!=='REVIEW_READY_ONLY' || caseState.approvals?.length!==2)
    return {status:'BLOCKED',reason:'two_reviews_missing',action:'NONE'};
  if (caseState.approvals[0].reviewerId===caseState.approvals[1].reviewerId ||
      new Set(caseState.approvals.map(a=>a.role)).size!==2 ||
      caseState.approvals.some(a=>a.reviewerId===caseState.requesterId || a.reviewerId===caseState.accountId))
    return {status:'BLOCKED',reason:'review_separation_failed',action:'NONE'};
  const errors=checkEvidence({account,bill,charge,checks,nowMs});
  if (errors.length) return {status:'BLOCKED',reason:errors.join(','),action:'NONE'};
  if (evidenceFingerprint(account,bill,charge)!==caseState.evidenceHash ||
      caseState.approvals.some(a=>a.evidenceHash!==caseState.evidenceHash))
    return {status:'BLOCKED',reason:'snapshot_drift',action:'NONE'};
  if (nowMs-caseState.createdAtMs > REVIEW_TTL_MS)
    return {status:'BLOCKED',reason:'review_expired',action:'NONE'};
  return {status:'REVIEW_READY_ONLY',reason:'dual_review_recorded_not_entitlement_authorized',action:'NONE'};
}
module.exports={evidenceFingerprint,checkEvidence,createReviewCase,addReview,assessReview,REVIEW_TTL_MS};
