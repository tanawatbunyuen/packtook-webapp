'use strict';
/**
 * P54 — BACKEND CANDIDATE (DEMO EMULATOR ONLY). NOT IMPORTED BY index.js.
 * Produces audit-only recovery cases, Finance+Technical approvals, Owner decision.
 * Absolutely no account/billing/wallet/entitlement/refund writes.
 *
 * Future production integration is NOT authorized by this module.
 */
const {createHash}=require('node:crypto');
const PLAN_PRICES={Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
const ROLE_CLAIMS={
  maker:'packtookRecoveryMaker',
  finance:'packtookRecoveryFinance',
  technical:'packtookRecoveryTechnical',
  owner:'packtookRecoveryOwner'
};
const TTL=15*60*1000;
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{6,128}$/.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const knownResolution=new Set(['ENTITLEMENT_RECONCILIATION_PROPOSAL',
  'MANUAL_PROMPTPAY_REFUND_ESCALATION','FRAUD_OR_DISPUTE_ESCALATION','NO_ACTION']);
const deny=(reason)=>{const e=Error('P54_DENIED:'+reason);e.code='failed-precondition';throw e};
function assertDemoOnly(env=process.env){
  if(env.GCLOUD_PROJECT!=='demo-packtook-v72'||
    env.GOOGLE_CLOUD_PROJECT!=='demo-packtook-v72'||
    env.GCP_PROJECT!=='demo-packtook-v72'||
    env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080'||
    env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||
    env.GOOGLE_APPLICATION_CREDENTIALS||env.FIREBASE_TOKEN||
    env.PACKTOOK_PRODUCTION_PROJECT_ID||env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE)
    deny('demo_emulator_only');
}
function chargeEvidence(accountId,requestId,account,bill,charge) {
  if(!account||!bill||!charge)deny('missing_record');
  if(bill.status!=='payment_review')deny('not_payment_review');
  if(account.openBillingRequestId!==requestId)deny('billing_lock_changed');
  if(!validId(bill.omiseChargeId)||bill.requestedBy!==accountId||
    bill.paymentMethod!=='promptpay'||bill.paymentProvider!=='omise')
    deny('billing_evidence_mismatch');
  if(!Object.hasOwn(PLAN_PRICES,bill.plan)||bill.amountTHB!==PLAN_PRICES[bill.plan])
    deny('plan_or_price_mismatch');
  if(charge.id!==bill.omiseChargeId||charge.status!=='successful'||
    charge.paid!==true||charge.livemode!==false||
    String(charge.currency||'').toLowerCase()!=='thb'||
    charge.source?.type!=='promptpay'||charge.amount!==bill.amountTHB*100||
    charge.metadata?.uid!==accountId||charge.metadata?.requestId!==requestId)
    deny('provider_evidence_mismatch');
  if(bill.providerVerifiedPaid!==true||bill.providerVerifiedChargeId!==charge.id||
    bill.providerVerifiedAmountSatang!==charge.amount||
    bill.providerVerifiedCurrency!=='thb'||bill.providerVerifiedLivemode!==false)
    deny('stored_provider_evidence_mismatch');
  if(!safe(account.used)||!safe(account.reserved)||!safe(account.billingVersion)||
    !safe(account.creditWalletRemaining)||account.reserved!==0)
    deny('account_unsafe');
  if(!Object.hasOwn(PLAN_PRICES,account.plan)&&account.plan!=='Free')
    deny('unknown_account_plan');
  if(bill.baseBillingVersion!==account.billingVersion)
    deny('billing_revision_changed');
  const accountHash=digest({
    plan:account.plan,expiresAt:account.planExpiresAt||null,
    period:account.period||null,used:account.used,reserved:account.reserved,
    wallet:account.creditWalletRemaining,version:account.billingVersion,
    lock:account.openBillingRequestId
  });
  const billingHash=digest({
    id:requestId,status:bill.status,plan:bill.plan,amount:bill.amountTHB,
    purchaseKind:bill.purchaseKind||null,baseBillingVersion:bill.baseBillingVersion,
    chargeId:bill.omiseChargeId,reviewReason:bill.reviewReason||null,
    verifiedPaid:bill.providerVerifiedPaid,verifiedAmount:bill.providerVerifiedAmountSatang
  });
  const providerHash=digest({
    id:charge.id,status:charge.status,paid:charge.paid,
    amount:charge.amount,currency:charge.currency,livemode:charge.livemode,
    method:charge.source.type,uid:charge.metadata.uid,request:charge.metadata.requestId,
    refundedAmount:charge.refunded_amount||0
  });
  if((charge.refunded_amount||0)!==0||charge.reversed===true)
    deny('refunded_or_reversed_provider_charge');
  return {accountHash,billingHash,providerHash,
    evidenceHash:digest({accountHash,billingHash,providerHash})};
}
function createOmiseTestAdapter({fetchImpl,readSecret}={}){
  if(typeof fetchImpl!=='function'||typeof readSecret!=='function')deny('provider_adapter_required');
  return {async getCharge(chargeId){
    if(typeof chargeId!=='string'||!/^chrg_test_[a-zA-Z0-9]+$/.test(chargeId))
      deny('test_charge_id_only');
    const key=await readSecret();
    if(typeof key!=='string'||!key.startsWith('skey_test_'))
      deny('omise_test_key_only');
    const response=await fetchImpl('https://api.omise.co/charges/'+encodeURIComponent(chargeId),{
      method:'GET',headers:{Authorization:'Basic '+Buffer.from(key+':').toString('base64')}
    });
    if(!response?.ok)deny('omise_unavailable');
    const charge=await response.json();
    if(!charge||charge.id!==chargeId||charge.livemode!==false)
      deny('omise_charge_not_test');
    return charge;
  }};
}
function buildDemoRecoveryBackend({db,auth,appCheck,provider,env=process.env,now=Date.now}={}){
  assertDemoOnly(env);
  if(!db?.runTransaction||!auth?.verifyIdToken||!auth?.getUser||
    !appCheck?.verifyToken||!provider?.getCharge||typeof now!=='function')
    deny('trusted_dependencies_required');
  const accounts=db.collection('accounts');
  const docs=(accountId,requestId)=>{
    if(!validId(accountId)||!validId(requestId))deny('invalid_ids');
    const account=accounts.doc(accountId);
    return {account,bill:account.collection('billingRequests').doc(requestId),
      recovery:account.collection('p54DemoRecoveryCases').doc(requestId),
      grant:account.collection('entitlementGrants').doc(requestId)};
  };
  async function authenticate(input,role){
    if(!input||typeof input.idToken!=='string'||typeof input.appCheckToken!=='string')
      deny('identity_and_appcheck_required');
    // Mandatory consume for each operation; emulator test uses synthetic App Check verifier.
    const app=await appCheck.verifyToken(input.appCheckToken,{consume:true});
    if(!app||app.alreadyConsumed===true)deny('appcheck_invalid_or_replayed');
    const decoded=await auth.verifyIdToken(input.idToken,true);
    if(!decoded?.uid||decoded.email_verified!==true)deny('unverified_identity');
    const live=await auth.getUser(decoded.uid);
    if(live.disabled||live.emailVerified!==true||
      live.customClaims?.[ROLE_CLAIMS[role]]!==true)
      deny('role_or_user_not_authorized');
    return live.uid;
  }
  async function currentEvidence(accountId,requestId,refs){
    // Omise GET is ALWAYS outside the Firestore transaction.
    const [billSnapshot,accountSnapshot]=await Promise.all([refs.bill.get(),refs.account.get()]);
    if(!billSnapshot.exists||!accountSnapshot.exists)deny('account_or_bill_missing');
    const bill=billSnapshot.data();
    if(!validId(bill.omiseChargeId))deny('charge_missing');
    const charge=await provider.getCharge(bill.omiseChargeId);
    const fingerprints=chargeEvidence(accountId,requestId,accountSnapshot.data(),bill,charge);
    return {charge,fingerprints};
  }
  function guardSnapshot(accountId,requestId,accountSnap,billSnap,charge,expected){
    if(!accountSnap.exists||!billSnap.exists)deny('missing_transaction_records');
    const fingerprints=chargeEvidence(accountId,requestId,accountSnap.data(),billSnap.data(),charge);
    if(expected&&fingerprints.evidenceHash!==expected)deny('evidence_changed_refresh_required');
    return fingerprints;
  }
  function view(c){
    return {status:c.state,caseRevision:c.revision,
      financeApproved:!!c.finance,technicalApproved:!!c.technical,
      ownerDecided:!!c.ownerDecision,action:'NONE'};
  }
  async function openCase(input){
    const actorId=await authenticate(input,'maker');
    const {accountId,requestId}=input;
    if(actorId===accountId)deny('self_beneficiary');
    const refs=docs(accountId,requestId),observed=await currentEvidence(accountId,requestId,refs);
    return db.runTransaction(async tx=>{
      // Read ALL docs (including deterministic future-grant guard) before any writes.
      const [a,b,c,g]=await Promise.all([
        tx.get(refs.account),tx.get(refs.bill),tx.get(refs.recovery),tx.get(refs.grant)]);
      if(g.exists)deny('prior_entitlement_grant');
      guardSnapshot(accountId,requestId,a,b,observed.charge,observed.fingerprints.evidenceHash);
      if(c.exists)return view(c.data()); // idempotent, no new audit or credit.
      const ts=now(),rec={schemaVersion:1,state:'AWAITING_FINANCE',revision:1,
        accountId,requestId,makerId:actorId,createdAtMs:ts,verifiedAtMs:ts,
        evidenceHash:observed.fingerprints.evidenceHash,
        accountHash:observed.fingerprints.accountHash,
        billingHash:observed.fingerprints.billingHash,
        providerHash:observed.fingerprints.providerHash,
        finance:null,technical:null,ownerDecision:null};
      tx.create(refs.recovery,rec);
      tx.create(refs.recovery.collection('events').doc('case_opened'),{
        type:'case_opened',actorId,atMs:ts,caseRevision:1,evidenceHash:rec.evidenceHash});
      return view(rec);
    });
  }
  async function review(input,role){
    if(!['finance','technical'].includes(role))deny('invalid_review_role');
    const actorId=await authenticate(input,role),{accountId,requestId}=input;
    const refs=docs(accountId,requestId),observed=await currentEvidence(accountId,requestId,refs);
    return db.runTransaction(async tx=>{
      const [a,b,c,g]=await Promise.all([
        tx.get(refs.account),tx.get(refs.bill),tx.get(refs.recovery),tx.get(refs.grant)]);
      if(!c.exists||g.exists)deny('case_missing_or_prior_grant');
      const rec=c.data(),ts=now();
      if(rec.state!==(role==='finance'?'AWAITING_FINANCE':'AWAITING_TECHNICAL'))
        deny('wrong_review_state');
      if(ts<rec.verifiedAtMs||ts-rec.verifiedAtMs>TTL)deny('review_evidence_expired');
      if(actorId===accountId||actorId===rec.makerId||
        actorId===rec.finance?.actorId||actorId===rec.technical?.actorId)
        deny('separation_of_duties');
      guardSnapshot(accountId,requestId,a,b,observed.charge,rec.evidenceHash);
      const next={...rec,revision:rec.revision+1,
        state:role==='finance'?'AWAITING_TECHNICAL':'AWAITING_OWNER',
        [role]:{actorId,atMs:ts,evidenceHash:rec.evidenceHash}};
      tx.update(refs.recovery,next);
      tx.create(refs.recovery.collection('events').doc('review_'+role),{
        type:'review_'+role,actorId,atMs:ts,caseRevision:next.revision,
        evidenceHash:rec.evidenceHash});
      return view(next);
    });
  }
  async function ownerDecision(input){
    const actorId=await authenticate(input,'owner'),{accountId,requestId,resolutionType}=input;
    if(!knownResolution.has(resolutionType))deny('resolution_not_supported');
    const refs=docs(accountId,requestId),observed=await currentEvidence(accountId,requestId,refs);
    // Refresh other reviewers' live role grants (no role claim from request body).
    return db.runTransaction(async tx=>{
      const [a,b,c,g]=await Promise.all([
        tx.get(refs.account),tx.get(refs.bill),tx.get(refs.recovery),tx.get(refs.grant)]);
      if(!c.exists||g.exists)deny('case_missing_or_prior_grant');
      const rec=c.data(),ts=now();
      if(rec.state!=='AWAITING_OWNER'||!rec.finance||!rec.technical)
        deny('dual_review_not_complete');
      if(ts<rec.verifiedAtMs||ts-rec.verifiedAtMs>TTL)deny('owner_evidence_expired');
      const people=new Set([accountId,rec.makerId,rec.finance.actorId,rec.technical.actorId]);
      if(people.has(actorId)||rec.finance.actorId===rec.technical.actorId)
        deny('owner_must_be_distinct');
      guardSnapshot(accountId,requestId,a,b,observed.charge,rec.evidenceHash);
      // No credit grant, no account/bill write, no lock release, no refund.
      const next={...rec,state:'OWNER_DECISION_RECORDED',revision:rec.revision+1,
        ownerDecision:{actorId,resolutionType,atMs:ts,evidenceHash:rec.evidenceHash}};
      tx.update(refs.recovery,next);
      tx.create(refs.recovery.collection('events').doc('owner_decision'),{
        type:'owner_decision',actorId,atMs:ts,
        resolutionType,evidenceHash:rec.evidenceHash,caseRevision:next.revision});
      return view(next);
    });
  }
  async function status(input){
    const actorId=await authenticate(input,'owner');
    const refs=docs(input.accountId,input.requestId);
    const c=await refs.recovery.get();
    if(!c.exists)deny('case_not_found');
    return {...view(c.data()),actorId};
  }
  // There is intentionally no execute(), grant(), refund(), unlock() or deploy path.
  return Object.freeze({openCase,reviewFinance:i=>review(i,'finance'),
    reviewTechnical:i=>review(i,'technical'),ownerDecision,status});
}
module.exports={assertDemoOnly,createOmiseTestAdapter,buildDemoRecoveryBackend,
  chargeEvidence,REVIEW_TTL_MS:TTL};
