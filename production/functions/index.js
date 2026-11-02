"use strict";
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const crypto=require("node:crypto");
admin.initializeApp();
const db=admin.firestore();
const {FieldValue}=admin.firestore;
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const pricesTHB={Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
const deviceLimits={Free:1,Starter:1,Basic:1,Growth:3,Business:5,Pro:10};
const region="asia-southeast1";
const options={region,maxInstances:5,timeoutSeconds:30}; // Existing Beta functions retain their current App Check policy.
const PUBLIC_SIGNUP_ENABLED=process.env.PACKTOOK_PUBLIC_SIGNUP_ENABLED==="true";
const PUBLIC_ACCESS_ENABLED=process.env.PACKTOOK_PUBLIC_ACCESS_ENABLED==="true";
const PUBLIC_POLICIES_APPROVED=process.env.PACKTOOK_PUBLIC_POLICIES_APPROVED==="true";
const PUBLIC_POLICY_VERSION="2026-11-v1";
const PUBLIC_GATE=PUBLIC_SIGNUP_ENABLED&&PUBLIC_ACCESS_ENABLED&&PUBLIC_POLICIES_APPROVED;
function isPublicMember(auth){return PUBLIC_ACCESS_ENABLED&&auth?.token?.packtookPublicCustomer===true}
function productionProjectReady(){return process.env.PACKTOOK_PRODUCTION_PROJECT_ID==="packtook-prod-01" &&
 (!process.env.GCLOUD_PROJECT||process.env.GCLOUD_PROJECT==="packtook-prod-01") &&
 (!process.env.GCP_PROJECT||process.env.GCP_PROJECT==="packtook-prod-01")}
// Production Beta: all callables are restricted to explicitly approved Auth UIDs.
function uid(req){
 if(process.env.PACKTOOK_PRODUCTION_PROJECT_ID!=="packtook-prod-01")throw new HttpsError("failed-precondition","Production project environment is not configured");
 if(!req.auth?.uid)throw new HttpsError("unauthenticated","Please sign in");
 if(req.auth.token.email_verified!==true)throw new HttpsError("permission-denied","Verify your email");
 if(req.auth.token.packtookProductionBeta!==true&&!isPublicMember(req.auth))throw new HttpsError("permission-denied","Account is not authorized for PACKTOOK");
 return req.auth.uid;
}
function data(req){return req.data&&typeof req.data==="object"?req.data:{}}
function validOp(id){return typeof id==="string"&&/^[a-zA-Z0-9_-]{16,100}$/.test(id)}
function own(uid){return db.collection("accounts").doc(uid)}
async function accountIdFor(uidValue){return uidValue}
async function ownerRef(uidValue){return own(await accountIdFor(uidValue))}
async function assertAdmin(uidValue){const accountId=await accountIdFor(uidValue);if(accountId!==uidValue)throw new HttpsError("permission-denied","Admin only");return accountId}

function barcodeKey(value){return crypto.createHash("sha256").update(value.trim()).digest("hex")}
function periodId(at){return new Date(at).toISOString().slice(0,7)}
function subscriptionState(a){if(a.plan==="Free")return "free";if(!a.planExpiresAt)return "unconfigured";const expires=Date.parse(a.planExpiresAt);if(!Number.isFinite(expires))return "invalid";return expires<=Date.now()?"expired":"active"}
function hasActivePaidPlan(a){return a.plan!=="Free"&&subscriptionState(a)==="active"}

// V5.0: A paid account may renew the same tier in its final 7 days, or
// buy the same/higher tier when video quota is exhausted (not downgraded).
// V5.1 credit wallet: balance represents credits immediately available for new reservations.
// Reservations debit the wallet and failures credit it back. No calendar-month reset.
function walletEnabled(a){return a.creditWalletV1===true}
function pendingReservations(a,now=Date.now()){return walletEnabled(a)?Math.max(0,a.reserved||0):a.period===periodId(now)?Math.max(0,a.reserved||0):0}
function creditAvailable(a,now=Date.now()){
 const limit=limits[a.plan];
 if(limit===null)return null;
 if(limit===undefined)throw new HttpsError("failed-precondition","Unknown plan");
 if(walletEnabled(a)){
  if(!Number.isSafeInteger(a.creditWalletRemaining)||a.creditWalletRemaining<0)throw new HttpsError("failed-precondition","Credit balance needs review");
  return a.creditWalletRemaining;
 }
 const same=a.period===periodId(now);
 return Math.max(0,limit-(same?(a.used||0)+(a.reserved||0):0));
}
function purchasedCreditBalance(a,nextPlan,now=Date.now()){
 const purchased=limits[nextPlan],current=creditAvailable(a,now);
 if(purchased===undefined)throw new HttpsError("invalid-argument","Unknown plan");
 const eligible=hasActivePaidPlan(a)||a.plan==="Free";
 const transferred=eligible&&current!==null?current:0;
 if(purchased===null)return {purchased:null,transferred:0,total:null};
 const total=purchased+transferred;
 if(!Number.isSafeInteger(total)||total<0)throw new HttpsError("failed-precondition","Credit total exceeds supported range");
 return {purchased,transferred,total};
}
function purchaseDecision(a,target,now=Date.now()){
 if(!Object.hasOwn(pricesTHB,target)||target==="Free")return {allowed:false,reason:"Invalid paid plan"};
 const state=subscriptionState(a),active=hasActivePaidPlan(a),limit=limits[a.plan];
 if(a.plan!=="Free"&&["unconfigured","invalid"].includes(state))return {allowed:false,reason:"Subscription data needs administrator review before any new payment"};
 if(pendingReservations(a,now)>0)return {allowed:false,reason:"Finish outstanding recordings before purchasing or renewing"};
 if(!active)return {allowed:true,kind:"new",resetQuota:false};
 const tiers=Object.keys(pricesTHB),remaining=creditAvailable(a,now);
 const reserved=pendingReservations(a,now);
 if(reserved>0)return {allowed:false,reason:"Finish outstanding recordings before purchasing or renewing"};
 const exhausted=remaining===0;
 const exp=Date.parse(a.planExpiresAt),nearExpiry=Number.isFinite(exp)&&exp>now&&exp-now<=7*86400000;
 // Upgrading to a higher-priced tier is permitted immediately, including when credits remain.
 // Keep all unused credits and add the new tier allowance only after Omise confirms payment.
 if(tiers.indexOf(target)>tiers.indexOf(a.plan))return {allowed:true,kind:"upgrade",resetQuota:false};
 if(exhausted&&target===a.plan)return {allowed:true,kind:"exhausted_topup",resetQuota:false};
 if(nearExpiry&&target===a.plan)return {allowed:true,kind:"renewal",resetQuota:false};
 return {allowed:false,reason:"Active subscriptions cannot downgrade. Same-tier purchases require exhausted credits or at most 7 days until expiry; upgrades to higher tiers are allowed now."};
}
function billingOpen(a){return typeof a.openBillingRequestId==="string"&&a.openBillingRequestId.length>0}

async function ensureAccount(id){
 const ref=await ownerRef(id);
 if(ref.id!==id)return ref;
 const current=await ref.get();
 if(current.exists)return ref;
 // Legacy Beta users may still be auto-provisioned. Public users MUST finish
 // verified, consented self-signup; ordinary callables never grant free credits.
 const live=await admin.auth().getUser(id);
 if(live.disabled||live.customClaims?.packtookProductionBeta!==true)
  throw new HttpsError("failed-precondition","Free activation required before using PACKTOOK");
 try{await ref.create({plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})}
 catch(e){if(e.code!==6&&e.code!=="already-exists")throw e}
 return ref;
}

// V6.5: self-registration stays completely disabled until THREE independent
// server-side production rollout flags are enabled after legal/App Check QA.
// This read-only status API does not grant entitlements or create Auth users.
exports.publicSignupStatus=onCall(options,async()=>{
 return {enabled:productionProjectReady()&&PUBLIC_GATE,
  accessEnabled:productionProjectReady()&&PUBLIC_ACCESS_ENABLED,
  policyVersion:PUBLIC_POLICY_VERSION,freeVideosPerMonth:20,freeDevices:1};
});
// Only the verified Auth user can create their own once-only Free account.
// The callable enforces Firebase App Check before this handler runs.
// This function never grants extra credits, never changes paid accounts,
// and never downgrades a preexisting account.
exports.completeFreeSignup=onCall({...options,enforceAppCheck:true},async req=>{
 if(!productionProjectReady()||!PUBLIC_GATE)
  throw new HttpsError("failed-precondition","Public registration is not available");
 if(!req.app?.appId)throw new HttpsError("permission-denied","App verification is required");
 if(!req.auth?.uid)throw new HttpsError("unauthenticated","Please sign in");
 const d=data(req);
 if(d.acceptTerms!==true||d.termsVersion!==PUBLIC_POLICY_VERSION||
    d.privacyVersion!==PUBLIC_POLICY_VERSION)
  throw new HttpsError("invalid-argument","Accept the current Terms and Privacy Policy");
 const id=req.auth.uid;
 // Never trust emailVerified or email supplied by the browser.
 const live=await admin.auth().getUser(id);
 if(live.disabled||live.emailVerified!==true||!live.email)
  throw new HttpsError("permission-denied","Verify your email address before activating Free");
 if(live.customClaims?.packtookProductionBeta===true)
  throw new HttpsError("already-exists","This account already belongs to Production Beta");
 const ref=own(id);
 const result=await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists&&live.customClaims?.packtookPublicCustomer===true)
   throw new HttpsError("failed-precondition","Account requires manual recovery; Free credits cannot be granted again");
  if(snap.exists){
   const a=snap.data();
   // A retry after a successful Firestore creation must NOT grant Free again.
   if(a.registrationSource!=="self_service_v65"||a.ownerUid!==id)
    throw new HttpsError("already-exists","This account is already registered");
   return {created:false,plan:a.plan};
  }
  tx.create(ref,{ownerUid:id,registrationSource:"self_service_v65",
   registeredEmail:live.email,plan:"Free",period:periodId(Date.now()),
   used:0,reserved:0,devices:[],creditWalletV1:false,
   acceptedTermsVersion:PUBLIC_POLICY_VERSION,
   acceptedPrivacyVersion:PUBLIC_POLICY_VERSION,
   consentAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()});
  return {created:true,plan:"Free"};
 });
 // If Auth claim update fails after DB commit, retry is safe/idempotent.
 const fresh=await admin.auth().getUser(id);
 if(fresh.disabled||fresh.emailVerified!==true)
  throw new HttpsError("permission-denied","Account authorization changed");
 await admin.auth().setCustomUserClaims(id,{
  ...(fresh.customClaims||{}),packtookPublicCustomer:true
 });
 return {activated:true,created:result.created,plan:result.plan,
  freeVideosPerMonth:20,freeDevices:1,refreshToken:true};
});
exports.usageStatus=onCall(options,async req=>{
 const id=uid(req),ref=await ensureAccount(id),snap=await ref.get();
 if(!snap.exists)throw new HttpsError("failed-precondition","Account not provisioned");
 const a=snap.data(),limit=limits[a.plan];if(limit===undefined)throw new HttpsError("failed-precondition","Invalid plan");
 const current=periodId(Date.now()),used=a.period===current?a.used||0:0,reserved=pendingReservations(a);
 return {plan:a.plan,limit,used,reserved,remaining:creditAvailable(a),walletEnabled:walletEnabled(a),walletStartingCredits:walletEnabled(a)?a.walletStartingCredits??null:null,period:current,openBillingRequestId:a.openBillingRequestId||null,canBuyMore:false,purchaseReason:null,planExpiresAt:typeof a.planExpiresAt==="string"?a.planExpiresAt:null,subscriptionStatus:subscriptionState(a)};
});
exports.reserveCredit=onCall(options,async req=>{
 const id=uid(req),body=data(req),op=body.operationId,barcode=body.barcode;
 if(!validDevice(body.deviceId))throw new HttpsError("permission-denied","Device registration required");
 if(!validOp(op)||typeof barcode!=="string"||!barcode.trim()||barcode.length>160)throw new HttpsError("invalid-argument","Invalid operation or barcode");
 const ref=await ensureAccount(id),rec=ref.collection("recordings").doc(op),period=periodId(Date.now()),code=barcode.trim(),key=ref.collection("barcodeLocks").doc(barcodeKey(code));
 return db.runTransaction(async tx=>{
  // All reads before any transaction writes.
  const approvalId=body.approvalId;const approvalRef=typeof approvalId==="string"&&validOp(approvalId)?ref.collection("duplicateApprovals").doc(approvalId):null;
  const [aSnap,rSnap,kSnap,approvalSnap]=await Promise.all([tx.get(ref),tx.get(rec),tx.get(key),approvalRef?tx.get(approvalRef):Promise.resolve(null)]);
  if(!aSnap.exists)throw new HttpsError("failed-precondition","Account not provisioned");
  const a=aSnap.data(),limit=limits[a.plan];if(limit===undefined)throw new HttpsError("failed-precondition","Invalid plan");
  if(!(a.devices||[]).some(d=>d.id===body.deviceId))throw new HttpsError("permission-denied","Device not registered");
  const sub=subscriptionState(a);if(sub==="expired"||sub==="invalid"||sub==="unconfigured")throw new HttpsError("permission-denied","Subscription expired or invalid");
  if(rSnap.exists){const old=rSnap.data();if(old.barcode!==barcode.trim())throw new HttpsError("already-exists","Operation ID previously used");return {recordingId:op,status:old.status,idempotent:true}}
  const override=kSnap.exists&&kSnap.data().operationId!==op;
  if(override){const approved=approvalSnap?.exists?approvalSnap.data():null;if(!approved||approved.barcode!==code||approved.status!=="approved"||approved.expiresAtMs<=Date.now()||(approved.requestedBy&&approved.requestedBy!==id))throw new HttpsError("already-exists","Barcode already scanned or recorded");if(kSnap.data().status!=="completed")throw new HttpsError("failed-precondition","Previous recording is not completed")}
  if(!override&&approvalId)throw new HttpsError("failed-precondition","Override is not required");
  const samePeriod=a.period===period,used=samePeriod?(a.used||0):0,reserved=pendingReservations(a),available=creditAvailable(a);
  if(limit!==null&&available<=0)throw new HttpsError("resource-exhausted","Video credit balance exhausted");
  tx.set(rec,{barcode:code,status:"reserved",period,createdAt:FieldValue.serverTimestamp(),file:null,overrideOf:override?kSnap.data().operationId:null,approvalId:override?approvalId:null});
  if(override){tx.update(approvalRef,{status:"consumed",consumedBy:op,consumedAt:FieldValue.serverTimestamp()});if(approvalSnap.data().requestId)tx.update(ref.collection("duplicateRequests").doc(approvalSnap.data().requestId),{status:"consumed",consumedBy:op})}
  tx.set(key,{operationId:op,barcode:code,status:"reserved",previousOperationId:override?kSnap.data().operationId:null,createdAt:FieldValue.serverTimestamp()});
  tx.update(ref,{period,used,reserved:reserved+1,...(walletEnabled(a)&&limit!==null?{creditWalletRemaining:available-1}:{}),updatedAt:FieldValue.serverTimestamp()});
  tx.create(ref.collection("audit").doc(),{action:"reserve",recordingId:op,createdAt:FieldValue.serverTimestamp()});
  return {recordingId:op,status:"reserved",remaining:limit===null?null:Math.max(0,available-1)};
 })
});
exports.finalizeCredit=onCall(options,async req=>{
 const id=uid(req),d=data(req),op=d.operationId,success=d.success;
 if(!validOp(op)||typeof success!=="boolean")throw new HttpsError("invalid-argument","Invalid finalization");
 if(success&&(!Number.isSafeInteger(d.bytes)||d.bytes<1000||typeof d.filename!=="string"||d.filename.length>255||!d.filename.trim()))throw new HttpsError("invalid-argument","Invalid file metadata");
 const acc=await ownerRef(id),rec=acc.collection("recordings").doc(op);
 return db.runTransaction(async tx=>{
  const [aSnap,rSnap]=await Promise.all([tx.get(acc),tx.get(rec)]);
  if(!aSnap.exists||!rSnap.exists)throw new HttpsError("not-found","Reservation not found");
  const a=aSnap.data(),r=rSnap.data(),key=acc.collection("barcodeLocks").doc(barcodeKey(r.barcode));
  const kSnap=await tx.get(key);
  if(r.status!=="reserved"){
   if(r.status===(success?"completed":"failed"))return {status:r.status,idempotent:true};
   throw new HttpsError("failed-precondition","Reservation already finalized");
  }
  const next=success?"completed":"failed";
  tx.update(rec,{status:next,finalizedAt:FieldValue.serverTimestamp(),file:success?{filename:d.filename,bytes:d.bytes}:null});
  if(kSnap.exists&&kSnap.data().operationId===op){if(success)tx.update(key,{status:"completed",finalizedAt:FieldValue.serverTimestamp()});else if(r.overrideOf)tx.set(key,{operationId:r.overrideOf,barcode:r.barcode,status:"completed",restoredAt:FieldValue.serverTimestamp()});else tx.delete(key)}
  // Wallet reservations span month boundaries; a failed recording always returns its reserved credit.
  if(walletEnabled(a)){
   if(!Number.isSafeInteger(a.reserved)||a.reserved<1)throw new HttpsError("failed-precondition","Wallet reservation count mismatch");
   tx.update(acc,{reserved:FieldValue.increment(-1),...(success&&a.period===r.period?{used:FieldValue.increment(1)}:{}),...(!success&&limits[a.plan]!==null?{creditWalletRemaining:FieldValue.increment(1)}:{}),updatedAt:FieldValue.serverTimestamp()});
  }else if(a.period===r.period)tx.update(acc,{reserved:FieldValue.increment(-1),...(success?{used:FieldValue.increment(1)}:{}),updatedAt:FieldValue.serverTimestamp()});
  tx.create(acc.collection("audit").doc(),{action:next,recordingId:op,createdAt:FieldValue.serverTimestamp()});
  return {status:next};
 })
});

// V5.2.1: account-owned reservation review across devices (no automatic refunds).
const STALE_RESERVATION_MS=30*60*1000;
exports.pendingVideoReservations=onCall(options,async req=>{
 const id=uid(req),acc=await ensureAccount(id),a=(await acc.get()).data();
 const snapshot=await acc.collection("recordings").where("status","==","reserved").limit(100).get();
 const now=Date.now();
 const items=snapshot.docs.map(d=>{
  const record=d.data(),at=record.createdAt?.toMillis?.()||null;
  return {id:d.id,barcode:record.barcode||"—",createdAt:at?new Date(at).toISOString():null,period:record.period||null,
   ageMinutes:at?Math.max(0,Math.floor((now-at)/60000)):null,
   canRecover:!!at&&now-at>=STALE_RESERVATION_MS};
 }).sort((x,y)=>(x.createdAt||"").localeCompare(y.createdAt||""));
 return {reservedCount:pendingReservations(a),items,minimumAgeMinutes:30,truncated:snapshot.size===100};
});
exports.recoverStaleVideoReservation=onCall(options,async req=>{
 const user=uid(req),d=data(req),id=d.operationId;
 if(!validOp(id)||d.confirmNoVideo!==true)throw new HttpsError("invalid-argument","Confirm that no usable recording exists and that no device is actively recording.");
 const acc=await ensureAccount(user),rec=acc.collection("recordings").doc(id);
 return db.runTransaction(async tx=>{
  const [aSnap,rSnap]=await Promise.all([tx.get(acc),tx.get(rec)]);
  if(!aSnap.exists||!rSnap.exists)throw new HttpsError("not-found","Recording reservation not found");
  const a=aSnap.data(),r=rSnap.data();
  if(r.status==="failed"&&r.recoveryReason==="manual_stale_recovery")return {status:"failed",idempotent:true};
  if(r.status!=="reserved")throw new HttpsError("failed-precondition","Recording has already been finalized; it cannot be recovered.");
  const createdAt=r.createdAt?.toMillis?.();
  if(!createdAt||Date.now()-createdAt<STALE_RESERVATION_MS)throw new HttpsError("failed-precondition","The recording reservation must be at least 30 minutes old before manual recovery.");
  const lock=acc.collection("barcodeLocks").doc(barcodeKey(r.barcode)),lockSnap=await tx.get(lock);
  tx.update(rec,{status:"failed",file:null,recoveryReason:"manual_stale_recovery",finalizedAt:FieldValue.serverTimestamp()});
  if(lockSnap.exists&&lockSnap.data().operationId===id){
   if(r.overrideOf)tx.set(lock,{operationId:r.overrideOf,barcode:r.barcode,status:"completed",restoredAt:FieldValue.serverTimestamp()});
   else tx.delete(lock);
  }
  const counted=walletEnabled(a)||a.period===r.period;
  if(counted){
   if(!Number.isSafeInteger(a.reserved)||a.reserved<1)throw new HttpsError("failed-precondition","Reserved credit count is inconsistent; contact support.");
   const patch={reserved:a.reserved-1,updatedAt:FieldValue.serverTimestamp()};
   if(walletEnabled(a)&&limits[a.plan]!==null)patch.creditWalletRemaining=FieldValue.increment(1);
   tx.update(acc,patch);
  }
  tx.create(acc.collection("audit").doc(),{action:"manual_stale_reservation_recovery",recordingId:id,createdAt:FieldValue.serverTimestamp()});
  return {status:"failed",creditReturned:counted,period:r.period};
 });
});
exports.recordingStatus=onCall(options,async req=>{
 const id=uid(req),op=data(req).operationId;
 if(!validOp(op))throw new HttpsError("invalid-argument","Invalid operation ID");
 const snap=await (await ownerRef(id)).collection("recordings").doc(op).get();
 if(!snap.exists)throw new HttpsError("not-found","Recording reservation not found");
 const r=snap.data();
 return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file||null};
});

function validDevice(id){return typeof id==="string"&&/^[a-zA-Z0-9_-]{16,100}$/.test(id)}
exports.registerDevice=onCall(options,async req=>{
 const user=uid(req),d=data(req),id=d.deviceId;
 if(!validDevice(id))throw new HttpsError("invalid-argument","Invalid device identifier");
 const name=typeof d.name==="string"?d.name.trim().slice(0,60):"Browser device";
 const ref=await ensureAccount(user);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref),a=snap.data(),max=deviceLimits[a.plan];
  if(!max)throw new HttpsError("failed-precondition","Invalid plan");
  const devices=Array.isArray(a.devices)?a.devices:[];
  if(devices.some(x=>x.id===id))return {registered:true,devices:devices.map(x=>({name:x.name,isCurrent:x.id===id})),limit:max};
  if(devices.length>=max)throw new HttpsError("resource-exhausted","Device limit reached");
  const next=[...devices,{id,name,addedAt:new Date().toISOString()}];
  tx.update(ref,{devices:next,updatedAt:FieldValue.serverTimestamp()});
  return {registered:true,devices:next.map(x=>({name:x.name,isCurrent:x.id===id})),limit:max};
 });
});
exports.deviceStatus=onCall(options,async req=>{
 const user=uid(req),d=data(req),ref=await ensureAccount(user),snap=await ref.get(),a=snap.data();
 const devices=Array.isArray(a.devices)?a.devices:[];
 return {limit:deviceLimits[a.plan],registered:devices.some(x=>x.id===d.deviceId),devices:devices.map(x=>({id:x.id,name:x.name,isCurrent:x.id===d.deviceId,addedAt:x.addedAt}))};
});
exports.removeDevice=onCall(options,async req=>{
 const user=uid(req),d=data(req);if(!validDevice(d.deviceId)||!validDevice(d.targetId))throw new HttpsError("invalid-argument","Invalid device");
 const ref=await ownerRef(user);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError("not-found","Account missing");
  const a=snap.data(),devices=Array.isArray(a.devices)?a.devices:[];
  // Verified account owner may retire a lost device from a new browser.
  if(!devices.some(x=>x.id===d.targetId))throw new HttpsError("not-found","Device not found");
  tx.update(ref,{devices:devices.filter(x=>x.id!==d.targetId),updatedAt:FieldValue.serverTimestamp()});
  return {removed:true};
 });
});

exports.authorizeDuplicate=onCall(options,async req=>{
 const accountId=uid(req),d=data(req),barcode=typeof d.barcode==="string"?d.barcode.trim():"",reason=typeof d.reason==="string"?d.reason.trim():"";
 if(!barcode||barcode.length>160||reason.length<10||reason.length>500)throw new HttpsError("invalid-argument","Barcode and reason (10-500 characters) required");
 const acc=await ensureAccount(accountId),lock=acc.collection("barcodeLocks").doc(barcodeKey(barcode));
 const approval=acc.collection("duplicateApprovals").doc(),now=Date.now();
 return db.runTransaction(async tx=>{
  const [aSnap,lSnap]=await Promise.all([tx.get(acc),tx.get(lock)]);
  if(!lSnap.exists||lSnap.data().status!=="completed")throw new HttpsError("failed-precondition","No completed video for barcode");
  const a=aSnap.data();
  // Account currently has a single Firebase user; separate employee roles are not yet implemented.
  if(acc.id!==accountId||a.ownerUid&&a.ownerUid!==accountId)throw new HttpsError("permission-denied","Owner approval required");
  if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});
  tx.create(approval,{barcode,reason,status:"approved",approvedBy:accountId,approvedAt:FieldValue.serverTimestamp(),expiresAtMs:now+5*60*1000,originalOperationId:lSnap.data().operationId});
  tx.create(acc.collection("audit").doc(),{action:"duplicate_approved",barcode,reason,approvalId:approval.id,approvedBy:accountId,createdAt:FieldValue.serverTimestamp()});
  return {approvalId:approval.id,expiresAtMs:now+5*60*1000};
 });
});

exports.accountRole=onCall(options,async req=>{
 const id=uid(req),ref=await ensureAccount(id),snap=await ref.get(),a=snap.data();
 const role=ref.id===id?"admin":"operator";
 return {role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false};
});



// V6.1 Beta: retain the Staging Packages & Users read-only view, without any paid billing.
// No Omise secrets, webhook, create charge or paid subscription functions are exported.
exports.subscriptionOverview=onCall(options,async req=>{
 const id=uid(req),ref=await ensureAccount(id),input=data(req);
 if(input.historyOnly===true)return {items:[],nextCursor:null};
 const snap=await ref.get(),a=snap.data(),period=periodId(Date.now());
 return {plan:a.plan,status:subscriptionState(a),expiresAt:a.planExpiresAt||null,
  priceTHB:pricesTHB[a.plan]??null,remaining:creditAvailable(a),
  used:a.period===period?(a.used||0):0,reserved:pendingReservations(a),
  walletEnabled:walletEnabled(a),purchaseWindow:{allowed:false,reason:"Production Beta — payments disabled"},
  openBillingRequestId:null,requests:[]};
});
