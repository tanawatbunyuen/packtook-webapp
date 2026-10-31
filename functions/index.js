"use strict";
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {onRequest}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const omiseKey=defineSecret("OMISE_SECRET_KEY");
const omisePublicKey=defineSecret("OMISE_PUBLIC_KEY");
const omiseWebhookKey=defineSecret("OMISE_WEBHOOK_SECRET");
const admin=require("firebase-admin");
const crypto=require("node:crypto");
admin.initializeApp();
const db=admin.firestore();
const {FieldValue}=admin.firestore;
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const pricesTHB={Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
const deviceLimits={Free:1,Starter:1,Basic:1,Growth:3,Business:5,Pro:10};
const region="asia-southeast1";
const options={region,maxInstances:20,timeoutSeconds:30}; // Enable enforceAppCheck:true after configuring web App Check.
function uid(req){if(!req.auth)throw new HttpsError("unauthenticated","Please sign in");if(req.auth.token.email_verified!==true)throw new HttpsError("permission-denied","Verify your email");return req.auth.uid}
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
 try{await ref.create({plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})}
 catch(e){if(e.code!==6&&e.code!=="already-exists")throw e}
 return ref;
}
exports.usageStatus=onCall(options,async req=>{
 const id=uid(req),ref=await ensureAccount(id),snap=await ref.get();
 if(!snap.exists)throw new HttpsError("failed-precondition","Account not provisioned");
 const a=snap.data(),limit=limits[a.plan];if(limit===undefined)throw new HttpsError("failed-precondition","Invalid plan");
 const current=periodId(Date.now()),used=a.period===current?a.used||0:0,reserved=pendingReservations(a);
 return {plan:a.plan,limit,used,reserved,remaining:creditAvailable(a),walletEnabled:walletEnabled(a),walletStartingCredits:walletEnabled(a)?a.walletStartingCredits??null:null,period:current,openBillingRequestId:a.openBillingRequestId||null,canBuyMore:purchaseDecision(a,a.plan).allowed,purchaseReason:purchaseDecision(a,a.plan).kind||null,planExpiresAt:typeof a.planExpiresAt==="string"?a.planExpiresAt:null,subscriptionStatus:subscriptionState(a)};
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


function publicBillingRequest(doc){
 const x=doc.data();
 return {id:doc.id,plan:x.plan||"—",amountTHB:x.amountTHB??null,
  transferredCredits:x.transferredCredits??null,creditsPurchased:x.creditsPurchased??null,
  balanceAfter:x.balanceAfter??null,activationExpiresAt:x.activationExpiresAt||null,
  purchaseKind:x.purchaseKind||"new",status:x.status||"unknown",
  createdAt:x.createdAt?.toDate?.()?.toISOString()||null};
}
exports.subscriptionOverview=onCall(options,async req=>{
 const id=uid(req),ref=await ensureAccount(id),input=data(req);
 // V5.3.1: reuse the established, callable subscriptionOverview endpoint for
 // paginated read-only billing history. New billingHistory may lack Cloud Run invoker IAM.
 if(input.historyOnly===true){
  const afterId=input.afterId;
  if(afterId!==undefined&&afterId!==null&&!validOp(afterId))
   throw new HttpsError("invalid-argument","Invalid history cursor");
  const collection=ref.collection("billingRequests");
  let query=collection.orderBy("createdAt","desc").limit(13);
  if(afterId){
   const cursor=await collection.doc(afterId).get();
   if(!cursor.exists||cursor.data().requestedBy!==id||!cursor.data().createdAt)
    throw new HttpsError("invalid-argument","History cursor not found for this account");
   query=query.startAfter(cursor);
  }
  try{
   const snap=await query.get(),page=snap.docs.slice(0,12);
   return {items:page.map(publicBillingRequest),
    nextCursor:snap.docs.length>12&&page.length?page[page.length-1].id:null};
  }catch(e){
   console.error("PACKTOOK billing history read failed",{code:e.code||"unknown",message:e.message});
   throw new HttpsError("unavailable","Unable to load billing history. Please try again.");
  }
 }
 const snap=await ref.get(),a=snap.data();
 const history=await ref.collection("billingRequests").orderBy("createdAt","desc").limit(20).get();
 const docs=[...history.docs];
 // The current unpaid request must remain actionable even after many later records.
 if(a.openBillingRequestId&&!docs.some(doc=>doc.id===a.openBillingRequestId)){
  const open=await ref.collection("billingRequests").doc(a.openBillingRequestId).get();
  if(open.exists&&open.data().requestedBy===id)docs.unshift(open);
 }
 const period=periodId(Date.now());
 return {plan:a.plan,status:subscriptionState(a),expiresAt:a.planExpiresAt||null,
  priceTHB:pricesTHB[a.plan]??null,remaining:creditAvailable(a),
  used:a.period===period?(a.used||0):0,reserved:pendingReservations(a),
  walletEnabled:walletEnabled(a),purchaseWindow:purchaseDecision(a,a.plan),
  openBillingRequestId:a.openBillingRequestId||null,requests:docs.map(publicBillingRequest)};
});
exports.billingHistory=onCall(options,async req=>{
 const id=uid(req),d=data(req),ref=await ensureAccount(id);
 if(d.afterId!==undefined&&d.afterId!==null&&!validOp(d.afterId))
  throw new HttpsError("invalid-argument","Invalid history cursor");
 const collection=ref.collection("billingRequests");
 let query=collection.orderBy("createdAt","desc").limit(13);
 if(d.afterId){
  const cursor=await collection.doc(d.afterId).get();
  if(!cursor.exists||cursor.data().requestedBy!==id||!cursor.data().createdAt)
   throw new HttpsError("invalid-argument","History cursor not found");
  query=query.startAfter(cursor);
 }
 const snap=await query.get(),items=snap.docs.slice(0,12);
 return {items:items.map(publicBillingRequest),
  nextCursor:snap.docs.length>12&&items.length?items[items.length-1].id:null};
});
exports.requestPlanChange=onCall(options,async req=>{
 const id=uid(req),plan=data(req).plan;
 const acc=await ensureAccount(id),ticket=acc.collection("billingRequests").doc();
 return db.runTransaction(async tx=>{
  const snap=await tx.get(acc),current=snap.data(),decision=purchaseDecision(current,plan);
  if(!decision.allowed)throw new HttpsError("failed-precondition",decision.reason);
  if(billingOpen(current))throw new HttpsError("failed-precondition","Another billing request is still open. Check or complete it before creating a new one.");
  tx.create(ticket,{plan,amountTHB:pricesTHB[plan],purchaseKind:decision.kind,baseBillingVersion:current.billingVersion||0,basePlan:current.plan,baseExpiresAt:current.planExpiresAt||null,status:"pending_payment_setup",createdAt:FieldValue.serverTimestamp(),requestedBy:id});
  tx.update(acc,{openBillingRequestId:ticket.id,updatedAt:FieldValue.serverTimestamp()});
  return {requestId:ticket.id,status:"pending_payment_setup",plan,amountTHB:pricesTHB[plan],purchaseKind:decision.kind,message:"Payment is required before any subscription changes."};
 });
});
exports.cancelUnpaidPlanRequest=onCall(options,async req=>{
 const uidValue=uid(req),id=data(req).requestId;
 if(!validOp(id))throw new HttpsError("invalid-argument","Invalid request ID");
 const acc=own(uidValue),ticket=acc.collection("billingRequests").doc(id);
 return db.runTransaction(async tx=>{
  const [a,t]=await Promise.all([tx.get(acc),tx.get(ticket)]);
  if(!t.exists||t.data().requestedBy!==uidValue)throw new HttpsError("not-found","Request not found");
  if(t.data().status!=="pending_payment_setup"||t.data().omiseChargeId)throw new HttpsError("failed-precondition","Only requests with no charge can be cancelled");
  tx.update(ticket,{status:"cancelled",cancelledAt:FieldValue.serverTimestamp()});
  if(a.data().openBillingRequestId===id)tx.update(acc,{openBillingRequestId:FieldValue.delete()});
  return {status:"cancelled"};
 });
});

const paymentSecrets={region,timeoutSeconds:30,secrets:[omiseKey]};
async function omiseAPI(path,method="GET",params=null){
 const key=omiseKey.value();
 if(!key||!key.startsWith("skey_test_"))throw new HttpsError("failed-precondition","Omise TEST secret key is required on Staging");
 const headers={Authorization:"Basic "+Buffer.from(key+":").toString("base64")};
 if(params)headers["Content-Type"]="application/x-www-form-urlencoded";
 const result=await fetch("https://api.omise.co"+path,{method,headers,...(params?{body:new URLSearchParams(params)}:{})});
 const payload=await result.json();
 if(!result.ok)throw new HttpsError("failed-precondition","Omise rejected request: "+(payload.code||result.status),{providerRejected:true});
 return payload;
}
async function reconcileCharge(accountId,requestId,chargeId){
 const acc=own(accountId),ref=acc.collection("billingRequests").doc(requestId);
 const charge=await omiseAPI("/charges/"+encodeURIComponent(chargeId));
 return db.runTransaction(async tx=>{
  const [tSnap,aSnap]=await Promise.all([tx.get(ref),tx.get(acc)]);
  if(!tSnap.exists||!aSnap.exists)throw Error("Billing record missing");
  const item=tSnap.data(),a=aSnap.data();
  if(item.omiseChargeId!==chargeId||item.requestedBy!==accountId||charge.id!==chargeId||charge.currency.toLowerCase()!=="thb"||charge.amount!==item.amountTHB*100||item.amountTHB!==pricesTHB[item.plan]||charge.metadata?.requestId!==requestId||charge.metadata?.uid!==accountId||charge.livemode!==false)throw Error("Charge mismatch");
  if(item.status==="paid")return {status:"paid",plan:item.plan,alreadyApplied:true};
  if(item.status==="payment_review")return {status:"payment_review",requiresSupport:true};
  if(charge.status==="successful"&&charge.paid===true){
   const legacy=!item.purchaseKind;
   const sameRevision=(a.billingVersion||0)===(item.baseBillingVersion||0);
   const lockOk=a.openBillingRequestId===requestId;
   const decision=purchaseDecision(a,item.plan);
   const upgradeStillValid=item.purchaseKind==="upgrade"&&decision.kind==="upgrade"&&a.plan===item.basePlan&&a.planExpiresAt===item.baseExpiresAt;
   const authorized=legacy?(!hasActivePaidPlan(a)&&!billingOpen(a)):lockOk&&sameRevision&&(item.purchaseKind==="upgrade"?upgradeStillValid:(decision.allowed||item.purchaseKind==="renewal"&&a.plan===item.plan));
   if(!authorized){
    if(item.status!=="payment_review"){
     tx.update(ref,{status:"payment_review",reviewReason:"active_or_changed_subscription",reviewedAgainstPlan:a.plan,reviewedAgainstExpiresAt:a.planExpiresAt||null,reviewRequiredAt:FieldValue.serverTimestamp()});
     tx.create(acc.collection("audit").doc(),{action:"payment_requires_manual_review",billingRequestId:requestId,omiseChargeId:chargeId,createdAt:FieldValue.serverTimestamp()});
    }
    return {status:"payment_review",requiresSupport:true,plan:a.plan,expiresAt:a.planExpiresAt||null};
   }
   const currentEnd=Date.parse(a.planExpiresAt);
   const base=Number.isFinite(currentEnd)&&currentEnd>Date.now()&&item.purchaseKind!=="new"?currentEnd:Date.now();
   const expiresAt=new Date(base+30*86400000).toISOString();
   // Reserve before settling must be zero, otherwise an in-flight recording may be lost.
   if(pendingReservations(a)>0){
    tx.update(ref,{status:"payment_review",reviewReason:"pending_recordings_prevent_credit_transfer",reviewRequiredAt:FieldValue.serverTimestamp()});
    tx.create(acc.collection("audit").doc(),{action:"payment_requires_manual_review",billingRequestId:requestId,omiseChargeId:chargeId,createdAt:FieldValue.serverTimestamp()});
    return {status:"payment_review",requiresSupport:true};
   }
   const credits=purchasedCreditBalance(a,item.plan);
   tx.update(acc,{plan:item.plan,planExpiresAt:expiresAt,lastPaidAt:FieldValue.serverTimestamp(),billingVersion:FieldValue.increment(1),
    creditWalletV1:true,creditWalletRemaining:credits.total,walletStartingCredits:credits.total,period:periodId(Date.now()),used:0,reserved:0,
    ...(lockOk?{openBillingRequestId:FieldValue.delete()}:{}),updatedAt:FieldValue.serverTimestamp()});
   tx.update(ref,{status:"paid",paidAt:FieldValue.serverTimestamp(),paymentProvider:"omise",activationExpiresAt:expiresAt,
    creditsPurchased:credits.purchased,transferredCredits:credits.transferred,balanceAfter:credits.total,expiryBefore:a.planExpiresAt||null});
   tx.create(acc.collection("audit").doc(),{action:"subscription_credits_merged",billingRequestId:requestId,omiseChargeId:chargeId,plan:item.plan,creditsPurchased:credits.purchased,transferredCredits:credits.transferred,balanceAfter:credits.total,createdAt:FieldValue.serverTimestamp()});
   return {status:"paid",plan:item.plan,expiresAt,creditsPurchased:credits.purchased,transferredCredits:credits.transferred,balanceAfter:credits.total};
  }
  if(["failed","expired"].includes(charge.status)&&!["failed","expired"].includes(item.status)){tx.update(ref,{status:charge.status});if(a.openBillingRequestId===requestId)tx.update(acc,{openBillingRequestId:FieldValue.delete()})}
  return {status:charge.status};
 });
}
exports.omisePaymentConfig=onCall({region,secrets:[omisePublicKey]},async req=>{
 uid(req);const key=omisePublicKey.value();
 if(!key?.startsWith("pkey_test_"))throw new HttpsError("failed-precondition","Omise test public key missing");
 return {publicKey:key,testMode:true};
});
exports.createOmisePayment=onCall(paymentSecrets,async req=>{
 const user=uid(req),d=data(req),id=d.requestId,method=d.method;
 // V4.8.9: PromptPay-only launch. Re-enable cards in a future reviewed release.
 if(!validOp(id)||method!=="promptpay")throw new HttpsError("invalid-argument","Only PromptPay QR payment is currently supported");
 const acc=await ensureAccount(user),ticket=acc.collection("billingRequests").doc(id);
 const claim=await db.runTransaction(async tx=>{
  const [snap,accountSnap]=await Promise.all([tx.get(ticket),tx.get(acc)]);
  if(!snap.exists||snap.data().requestedBy!==user)throw new HttpsError("not-found","Request not found");
  const item=snap.data();
  if(!item.purchaseKind)throw new HttpsError("failed-precondition","This billing request was created before V5.0. Create a new request to purchase.");
  if(!accountSnap.exists)throw new HttpsError("not-found","Account missing");
  const purchase=purchaseDecision(accountSnap.data(),item.plan);
  if(!purchase.allowed||item.purchaseKind&&(!billingOpen(accountSnap.data())||accountSnap.data().openBillingRequestId!==id||(accountSnap.data().billingVersion||0)!==(item.baseBillingVersion||0))||item.purchaseKind==="upgrade"&&(purchase.kind!=="upgrade"||item.basePlan!==accountSnap.data().plan||item.baseExpiresAt!==accountSnap.data().planExpiresAt))throw new HttpsError("failed-precondition",purchase.reason||"Billing request is no longer valid");
  if(!Object.hasOwn(pricesTHB,item.plan)||item.plan==="Free"||item.amountTHB!==pricesTHB[item.plan])throw new HttpsError("failed-precondition","Invalid price");
  if(item.status!=="pending_payment_setup")return {claimed:false,status:item.status,chargeId:item.omiseChargeId};
  tx.update(ticket,{status:"creating_charge",paymentMethod:method,paymentProvider:"omise",claimedAt:FieldValue.serverTimestamp()});
  return {claimed:true,amount:item.amountTHB,plan:item.plan};
 });
 if(!claim.claimed){
  if(claim.chargeId){const prev=await omiseAPI("/charges/"+encodeURIComponent(claim.chargeId));return {status:prev.status,chargeId:prev.id,authorizeUri:prev.authorize_uri||null,qrImage:prev.source?.scannable_code?.image?.download_uri||null};}
  throw new HttpsError("failed-precondition","Payment already started; contact support for reconciliation if stuck");
 }
 let charge;
 try{
  const form={amount:String(claim.amount*100),currency:"thb",description:"PACKTOOK "+claim.plan+" 30 days", "metadata[uid]":user,"metadata[requestId]":id};
  form["source[type]"]="promptpay";
  charge=await omiseAPI("/charges","POST",form);
  if(!charge.id||charge.livemode!==false)throw Error("Unexpected charge");
  await ticket.update({status:"payment_pending",omiseChargeId:charge.id,omiseStatus:charge.status,createdChargeAt:FieldValue.serverTimestamp()});
 }catch(e){
  if(e instanceof HttpsError&&e.details?.providerRejected===true){
   await db.runTransaction(async tx=>{const t=await tx.get(ticket);if(t.exists&&t.data().status==="creating_charge"&&!t.data().omiseChargeId)tx.update(ticket,{status:"pending_payment_setup",omiseErrorCode:String(e.message).slice(0,160)})});
   throw new HttpsError("failed-precondition",e.message+" (No charge created; you may retry this request)");
  }
  throw new HttpsError("unavailable","Charge creation outcome is uncertain. Check Omise Test Dashboard before submitting a new request.");
 }
 const status=await reconcileCharge(user,id,charge.id);
 return {status:status.status,chargeId:charge.id,authorizeUri:charge.authorize_uri||null,qrImage:charge.source?.scannable_code?.image?.download_uri||null};
});
exports.recoverOmiseCharge=onCall(paymentSecrets,async req=>{
 const user=uid(req),requestId=data(req).requestId;
 if(!validOp(requestId))throw new HttpsError("invalid-argument","Invalid request ID");
 const ref=own(user).collection("billingRequests").doc(requestId),snap=await ref.get();
 if(!snap.exists||snap.data().requestedBy!==user)throw new HttpsError("not-found","Billing request not found");
 const bill=snap.data();
 if(bill.omiseChargeId){const result=await reconcileCharge(user,requestId,bill.omiseChargeId);const current=await omiseAPI("/charges/"+encodeURIComponent(bill.omiseChargeId));return {...result,chargeId:bill.omiseChargeId,found:true,qrImage:current.source?.scannable_code?.image?.download_uri||null};}
 if(bill.status!=="creating_charge")return {status:bill.status,found:false};
 // List by charge creation time to avoid reusing an unrelated customer payment.
 const from=bill.claimedAt?.toDate?.()||bill.createdAt?.toDate?.();
 const params=new URLSearchParams({limit:"100",order:"reverse_chronological"});
 if(from)params.set("from",new Date(from.getTime()-120000).toISOString());
 const matches=[];
 for(let offset=0;offset<500;offset+=100){
  params.set("offset",String(offset));
  const page=await omiseAPI("/charges?"+params.toString());
  for(const ch of page.data||[]){
   if(ch.livemode===false&&ch.metadata?.uid===user&&ch.metadata?.requestId===requestId&&ch.amount===bill.amountTHB*100&&String(ch.currency).toLowerCase()==="thb")matches.push(ch);
  }
  if(!(page.data||[]).length||!(page.has_more||page.data?.length===100))break;
 }
 if(matches.length!==1)return {status:"creating_charge",found:false,matchCount:matches.length,action:matches.length>1?"manual_review":"check_omise_dashboard"};
 const charge=matches[0];
 await db.runTransaction(async tx=>{
  const t=await tx.get(ref);
  if(!t.exists)throw new HttpsError("not-found","Request missing");
  if(t.data().omiseChargeId&&t.data().omiseChargeId!==charge.id)throw new HttpsError("failed-precondition","Different charge already linked");
  if(!t.data().omiseChargeId&&t.data().status==="creating_charge")tx.update(ref,{omiseChargeId:charge.id,status:"payment_pending",recoveredAt:FieldValue.serverTimestamp()});
 });
 const verified=await reconcileCharge(user,requestId,charge.id);
 return {...verified,found:true,chargeId:charge.id,qrImage:charge.source?.scannable_code?.image?.download_uri||null};
});
exports.omisePaymentStatus=onCall(paymentSecrets,async req=>{
 const user=uid(req),id=data(req).requestId;
 if(!validOp(id))throw new HttpsError("invalid-argument","Invalid request");
 const snap=await own(user).collection("billingRequests").doc(id).get();
 if(!snap.exists||snap.data().requestedBy!==user)throw new HttpsError("not-found","Billing request not found");
 if(!snap.data().omiseChargeId)return {status:snap.data().status,needsReconciliation:snap.data().status==="creating_charge"};
 const result=await reconcileCharge(user,id,snap.data().omiseChargeId);
 if(result.status==="pending"){const charge=await omiseAPI("/charges/"+encodeURIComponent(snap.data().omiseChargeId));return {...result,qrImage:charge.source?.scannable_code?.image?.download_uri||null,chargeId:charge.id}}
 return result;
});
exports.omisePaymentWebhook=onRequest({region,secrets:[omiseKey,omiseWebhookKey],invoker:"public"},async(req,res)=>{
 if(req.method!=="POST"){res.status(405).send("Method not allowed");return}
 const ts=String(req.headers["omise-signature-timestamp"]||"");
 const sigs=String(req.headers["omise-signature"]||"").split(",");
 if(!req.rawBody||!/^\d{10}$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300){res.status(401).send("Invalid timestamp");return}
 const secret=omiseWebhookKey.value();
 if(!secret){res.status(503).send("Webhook secret missing");return}
 const expected=crypto.createHmac("sha256",Buffer.from(secret,"base64")).update(ts+"."+req.rawBody.toString("utf8")).digest();
 const valid=sigs.some(sig=>{if(!/^[a-f0-9]{64}$/i.test(sig.trim()))return false;return crypto.timingSafeEqual(Buffer.from(sig.trim(),"hex"),expected)});
 if(!valid){res.status(401).send("Invalid signature");return}
 // charge.update is useful for non-3DS cards where charge.complete may not arrive.
 // All notifications are independently verified with GET /charges/{id} before any activation.
 const event=req.body;
 if(!["charge.complete","charge.update","charge.create"].includes(event?.key)||!/^chrg_test_[a-zA-Z0-9]+$/.test(event?.data?.id||"")){res.status(200).send("ignored");return}
 const id=event.data.metadata?.requestId,user=event.data.metadata?.uid;
 if(!validOp(id)||!user){res.status(400).send("invalid metadata");return}
 try{await reconcileCharge(user,id,event.data.id);res.status(200).send("verified")}
 catch(e){res.status(500).send("reconciliation failed")}
});

exports.paymentAudit=onCall(paymentSecrets,async req=>{
 const user=uid(req),id=data(req).requestId;
 if(!validOp(id))throw new HttpsError("invalid-argument","Invalid billing request ID");
 const acc=own(user),ticket=acc.collection("billingRequests").doc(id),snap=await ticket.get();
 if(!snap.exists||snap.data().requestedBy!==user)throw new HttpsError("not-found","Billing request not found");
 const item=snap.data(),account=(await acc.get()).data();
 const result={requestId:id,status:item.status,plan:item.plan,amountTHB:item.amountTHB,
   provider:"omise",hasChargeId:!!item.omiseChargeId,paidAt:item.paidAt?.toDate?.()?.toISOString()||null,
   activationExpiresAt:item.activationExpiresAt||null,expiryBefore:item.expiryBefore||null,creditsPurchased:item.creditsPurchased??null,transferredCredits:item.transferredCredits??null,balanceAfter:item.balanceAfter??null,currentCreditBalance:account?creditAvailable(account):null,currentPlan:account?.plan||null,
   currentExpiresAt:account?.planExpiresAt||null};
 if(item.omiseChargeId){
   const charge=await omiseAPI("/charges/"+encodeURIComponent(item.omiseChargeId));
   result.providerStatus=charge.status;result.providerPaid=charge.paid===true;result.providerTest=charge.livemode===false;
   result.amountMatches=charge.amount===item.amountTHB*100&&String(charge.currency).toLowerCase()==="thb";
 }
 return result;
});


// V5.8: standalone PACKTOOK Owner App. This role is NEVER inferred from a
// customer's "admin" role, email/domain, account.plan or a client supplied field.
// Only a separately provisioned Firebase Authentication custom claim can authorize it.
function requirePlatformOwner(req){
 const id=uid(req);
 if(req.auth.token.packtookPlatformOwner!==true)
  throw new HttpsError("permission-denied","Platform owner access only");
 return id;
}
function ownerMonthTH(timestamp){
 return new Date(timestamp+7*3600000).toISOString().slice(0,7);
}
function ownerTimestamp(value){
 if(!value)return null;
 if(typeof value.toMillis==="function")return value.toMillis();
 if(typeof value==="number"&&Number.isFinite(value))return value;
 if(typeof value==="string"){const ms=Date.parse(value);return Number.isFinite(ms)?ms:null}
 return null;
}
const ownerOptions={region,maxInstances:2,timeoutSeconds:180,memory:"512MiB"};
const OWNER_MAX_ACCOUNTS=1200,OWNER_BATCH=100,OWNER_CONCURRENCY=12;
exports.ownerAnalyticsSummary=onCall(ownerOptions,async req=>{
 requirePlatformOwner(req);
 const now=Date.now(),plans=Object.keys(pricesTHB),currentMonth=ownerMonthTH(now);
 const [currentYear,currentMonthNumber]=currentMonth.split("-").map(Number);
 const months=Array.from({length:12},(_,i)=>
  new Date(Date.UTC(currentYear,currentMonthNumber-1-(11-i),1)).toISOString().slice(0,7));
 const byMonth=new Map(months.map(month=>[month,{month,newCustomers:0,testSalesTHB:0,testPayments:0,unknownPayments:0}]));
 const byPlan=new Map(plans.map(plan=>[plan,{plan,customers:0,active:0,expired:0,testSalesTHB:0,testPayments:0}]));
 const totals={customers:0,free:0,activePaid:0,expiredPaid:0,otherPaid:0,
  testSalesTHB:0,testPayments:0,unknownPayments:0,unknownSalesTHB:0,liveSalesTHB:0,livePayments:0};
 let cursor=null,scanned=0,truncated=false;
 while(scanned<OWNER_MAX_ACCOUNTS){
  let query=db.collection("accounts").orderBy(admin.firestore.FieldPath.documentId()).limit(Math.min(OWNER_BATCH,OWNER_MAX_ACCOUNTS-scanned));
  if(cursor)query=query.startAfter(cursor);
  const accounts=await query.get();
  if(accounts.empty)break;
  for(let offset=0;offset<accounts.docs.length;offset+=OWNER_CONCURRENCY){
   const part=accounts.docs.slice(offset,offset+OWNER_CONCURRENCY);
   const billing=await Promise.all(part.map(async doc=>{
    const paid=await doc.ref.collection("billingRequests").where("status","==","paid").get();
    return paid.docs.map(x=>x.data());
   }));
   part.forEach((doc,i)=>{
    const account=doc.data(),plan=typeof account.plan==="string"?account.plan:"Unknown";
    const tier=byPlan.get(plan),state=subscriptionState(account);
    totals.customers++;
    if(tier)tier.customers++;
    if(plan==="Free")totals.free++;
    else if(state==="active"){totals.activePaid++;if(tier)tier.active++}
    else if(state==="expired"){totals.expiredPaid++;if(tier)tier.expired++}
    else totals.otherPaid++;
    const joined=ownerTimestamp(account.createdAt);
    const joinedMonth=joined===null?null:byMonth.get(ownerMonthTH(joined));
    if(joinedMonth)joinedMonth.newCustomers++;
    for(const pay of billing[i]){
     if(!Number.isSafeInteger(pay.amountTHB)||pay.amountTHB<0||pay.paymentProvider!=="omise")continue;
     const monthMs=ownerTimestamp(pay.paidAt)||ownerTimestamp(pay.createdAt);
     const month=monthMs===null?null:byMonth.get(ownerMonthTH(monthMs));
     const chargeId=String(pay.omiseChargeId||"");
     const isTest=pay.omiseLivemode===false||chargeId.startsWith("chrg_test_");
     // Current Omise integration verifies ONLY test mode; do not treat an
     // unclassified legacy invoice as production revenue.
     const isLive=pay.omiseLivemode===true&&chargeId.length>8&&!chargeId.startsWith("chrg_test_");
     if(isTest){
      totals.testPayments++;totals.testSalesTHB+=pay.amountTHB;
      if(tier&&pay.plan===plan){tier.testPayments++;tier.testSalesTHB+=pay.amountTHB}
      else{const purchaseTier=byPlan.get(pay.plan);if(purchaseTier){purchaseTier.testPayments++;purchaseTier.testSalesTHB+=pay.amountTHB}}
      if(month){month.testPayments++;month.testSalesTHB+=pay.amountTHB}
     }else if(isLive){
      totals.livePayments++;totals.liveSalesTHB+=pay.amountTHB;
     }else{
      totals.unknownPayments++;totals.unknownSalesTHB+=pay.amountTHB;
      if(month)month.unknownPayments++;
     }
    }
   });
  }
  scanned+=accounts.size;cursor=accounts.docs[accounts.docs.length-1];
  if(accounts.size<OWNER_BATCH)break;
 }
 if(scanned>=OWNER_MAX_ACCOUNTS){
  const more=await db.collection("accounts").orderBy(admin.firestore.FieldPath.documentId()).startAfter(cursor).limit(1).get();
  truncated=!more.empty;
 }
 return {asOf:new Date(now).toISOString(),timezone:"Asia/Bangkok",mode:"staging", 
  truncated,scannedAccounts:scanned,maxScannedAccounts:OWNER_MAX_ACCOUNTS,
  totals,plans:[...byPlan.values()],months:[...byMonth.values()],
  caveat:"ยอดจากรายการ Firestore ที่บันทึกว่าชำระสำเร็จ ไม่ใช่การตรวจสถานะคืนเงินแบบ Real Time; Omise Test Mode ไม่ใช่ยอดเงินจริง"};
});
exports.ownerAnalyticsCustomers=onCall(ownerOptions,async req=>{
 requirePlatformOwner(req);
 const d=data(req),afterId=d.afterId;
 if(afterId!==undefined&&afterId!==null&&(typeof afterId!=="string"||afterId.length<1||afterId.length>128||afterId.includes("/")))
  throw new HttpsError("invalid-argument","Invalid customer cursor");
 const collection=db.collection("accounts");
 let query=collection.orderBy(admin.firestore.FieldPath.documentId()).limit(26);
 if(afterId)query=query.startAfter(afterId);
 const snap=await query.get(),items=snap.docs.slice(0,25);
 // Firebase Authentication is the canonical email directory. Only the server
 // can read these cross-tenant identities, after enforcing the platform-owner claim.
 let userByUid=new Map();
 if(items.length){
  try{
   const directory=await admin.auth().getUsers(items.map(doc=>({uid:doc.id})));
   userByUid=new Map(directory.users.map(user=>[user.uid,user]));
  }catch(e){
   console.error("Owner customer directory lookup failed",{code:e.code||"unknown"});
   throw new HttpsError("unavailable","Cannot load customer email directory. Retry later.");
  }
 }
 const customers=items.map(doc=>{
  const a=doc.data(),state=subscriptionState(a),joined=ownerTimestamp(a.createdAt);
  const paidExpired=state==="expired",unlimited=limits[a.plan]===null&&!paidExpired;
  let remainingCredits=null,creditsStatus="review";
  if(paidExpired){
   // An expired paid plan cannot start new recordings, even if its stored
   // wallet balance has not been transferred or reset yet.
   remainingCredits=0;creditsStatus="expired";
  }else if(state==="free"||state==="active"){
   try{
    remainingCredits=unlimited?null:creditAvailable(a);
    creditsStatus=unlimited?"unlimited":"available";
   }catch(e){
    // Corrupt wallet/quota fields must not hide other customer records or
    // misrepresent uncertain balances as zero.
    console.warn("Owner analytics credit calculation requires review",{accountId:doc.id,code:e.code||"unknown"});
   }
  }else creditsStatus="inactive";
  return {accountId:doc.id,email:userByUid.get(doc.id)?.email||null,
   plan:a.plan||"Unknown",status:state,
   creditsRemaining:remainingCredits,creditsUnlimited:unlimited,
   creditsStatus,reservedCredits:pendingReservations(a),
   joinedAt:joined?new Date(joined).toISOString():null,
   expiresAt:typeof a.planExpiresAt==="string"?a.planExpiresAt:null,
   hasBilling:!!a.lastPaidAt};
 });
 return {customers,nextCursor:snap.docs.length>25&&items.length?items[items.length-1].id:null};
});
