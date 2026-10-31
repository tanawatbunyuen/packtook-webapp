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
 const current=periodId(Date.now()),used=a.period===current?a.used||0:0,reserved=a.period===current?a.reserved||0:0;
 return {plan:a.plan,limit,used,reserved,remaining:limit===null?null:Math.max(0,limit-used-reserved),period:current,planExpiresAt:typeof a.planExpiresAt==="string"?a.planExpiresAt:null,subscriptionStatus:subscriptionState(a)};
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
  const samePeriod=a.period===period,used=samePeriod?(a.used||0):0,reserved=samePeriod?(a.reserved||0):0;
  if(limit!==null&&used+reserved>=limit)throw new HttpsError("resource-exhausted","Monthly video quota exceeded");
  tx.set(rec,{barcode:code,status:"reserved",period,createdAt:FieldValue.serverTimestamp(),file:null,overrideOf:override?kSnap.data().operationId:null,approvalId:override?approvalId:null});
  if(override){tx.update(approvalRef,{status:"consumed",consumedBy:op,consumedAt:FieldValue.serverTimestamp()});if(approvalSnap.data().requestId)tx.update(ref.collection("duplicateRequests").doc(approvalSnap.data().requestId),{status:"consumed",consumedBy:op})}
  tx.set(key,{operationId:op,barcode:code,status:"reserved",previousOperationId:override?kSnap.data().operationId:null,createdAt:FieldValue.serverTimestamp()});
  tx.update(ref,{period,used,reserved:reserved+1,updatedAt:FieldValue.serverTimestamp()});
  tx.create(ref.collection("audit").doc(),{action:"reserve",recordingId:op,createdAt:FieldValue.serverTimestamp()});
  return {recordingId:op,status:"reserved",remaining:limit===null?null:Math.max(0,limit-used-reserved-1)};
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
  // Credit count of a previous period stays in its own period; never deduct it from the current month.
  if(a.period===r.period)tx.update(acc,{reserved:FieldValue.increment(-1),...(success?{used:FieldValue.increment(1)}:{}),updatedAt:FieldValue.serverTimestamp()});
  tx.create(acc.collection("audit").doc(),{action:next,recordingId:op,createdAt:FieldValue.serverTimestamp()});
  return {status:next};
 })
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


exports.subscriptionOverview=onCall(options,async req=>{
 const id=uid(req),ref=await ensureAccount(id),snap=await ref.get(),a=snap.data();
 const hist=await ref.collection("billingRequests").orderBy("createdAt","desc").limit(20).get();
 return {plan:a.plan,status:subscriptionState(a),expiresAt:a.planExpiresAt||null,priceTHB:pricesTHB[a.plan]??null,requests:hist.docs.map(x=>({id:x.id,plan:x.data().plan,amountTHB:x.data().amountTHB,status:x.data().status,createdAt:x.data().createdAt?.toDate()?.toISOString()||null}))};
});
exports.requestPlanChange=onCall(options,async req=>{
 const id=uid(req),d=data(req),plan=d.plan;
 if(!Object.hasOwn(pricesTHB,plan)||plan==="Free")throw new HttpsError("invalid-argument","Select a paid plan");
 const acc=await ensureAccount(id),ticket=acc.collection("billingRequests").doc();
 return db.runTransaction(async tx=>{
  const snap=await tx.get(acc);
  const current=snap.data();
  if(hasActivePaidPlan(current))throw new HttpsError("failed-precondition","Your "+current.plan+" plan is still active until "+current.planExpiresAt+". New purchases and downgrades are disabled until expiration.");
  tx.create(ticket,{plan,amountTHB:pricesTHB[plan],status:"pending_payment_setup",createdAt:FieldValue.serverTimestamp(),requestedBy:id});
  return {requestId:ticket.id,status:"pending_payment_setup",plan,amountTHB:pricesTHB[plan],message:"No payment has been collected. Plan remains unchanged."};
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
  // Another payment may have activated a paid plan after this QR was issued.
  // Do not overwrite that plan or silently consume the customer's remaining entitlement.
  if(charge.status==="successful"&&charge.paid===true&&hasActivePaidPlan(a)){
   if(item.status!=="payment_review"){
    tx.update(ref,{status:"payment_review",reviewReason:"active_paid_plan",reviewedAgainstPlan:a.plan,reviewedAgainstExpiresAt:a.planExpiresAt,reviewRequiredAt:FieldValue.serverTimestamp()});
    tx.create(acc.collection("audit").doc(),{action:"payment_requires_manual_review",billingRequestId:requestId,omiseChargeId:chargeId,createdAt:FieldValue.serverTimestamp()});
   }
   return {status:"payment_review",requiresSupport:true,plan:a.plan,expiresAt:a.planExpiresAt};
  }
  if(charge.status==="successful"&&charge.paid===true){
   const currentEnd=Date.parse(a.planExpiresAt);
   const base=a.plan===item.plan&&Number.isFinite(currentEnd)&&currentEnd>Date.now()?currentEnd:Date.now();
   const expiresAt=new Date(base+30*86400000).toISOString();
   tx.update(acc,{plan:item.plan,planExpiresAt:expiresAt,lastPaidAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
   tx.update(ref,{status:"paid",paidAt:FieldValue.serverTimestamp(),paymentProvider:"omise",activationExpiresAt:expiresAt});
   tx.create(acc.collection("audit").doc(),{action:"subscription_paid",billingRequestId:requestId,omiseChargeId:chargeId,plan:item.plan,createdAt:FieldValue.serverTimestamp()});
   return {status:"paid",plan:item.plan,expiresAt};
  }
  if(["failed","expired"].includes(charge.status)&&!["failed","expired"].includes(item.status))tx.update(ref,{status:charge.status});
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
  if(!accountSnap.exists)throw new HttpsError("not-found","Account missing");
  if(hasActivePaidPlan(accountSnap.data()))throw new HttpsError("failed-precondition","Current paid plan is still active until "+accountSnap.data().planExpiresAt+". New payments are not allowed.");
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
   activationExpiresAt:item.activationExpiresAt||null,currentPlan:account?.plan||null,
   currentExpiresAt:account?.planExpiresAt||null};
 if(item.omiseChargeId){
   const charge=await omiseAPI("/charges/"+encodeURIComponent(item.omiseChargeId));
   result.providerStatus=charge.status;result.providerPaid=charge.paid===true;result.providerTest=charge.livemode===false;
   result.amountMatches=charge.amount===item.amountTHB*100&&String(charge.currency).toLowerCase()==="thb";
 }
 return result;
});
