"use strict";
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {onRequest}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const stripeKey=defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookKey=defineSecret("STRIPE_WEBHOOK_SECRET");
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
 return {plan:a.plan,status:subscriptionState(a),expiresAt:a.planExpiresAt||null,priceTHB:pricesTHB[a.plan]??null,requests:hist.docs.map(x=>({id:x.id,plan:x.data().plan,status:x.data().status,createdAt:x.data().createdAt?.toDate()?.toISOString()||null}))};
});
exports.requestPlanChange=onCall(options,async req=>{
 const id=uid(req),d=data(req),plan=d.plan;
 if(!Object.hasOwn(pricesTHB,plan)||plan==="Free")throw new HttpsError("invalid-argument","Select a paid plan");
 const acc=await ensureAccount(id),ticket=acc.collection("billingRequests").doc();
 await ticket.create({plan,amountTHB:pricesTHB[plan],status:"pending_payment_setup",createdAt:FieldValue.serverTimestamp(),requestedBy:id});
 return {requestId:ticket.id,status:"pending_payment_setup",plan,amountTHB:pricesTHB[plan],message:"No payment has been collected. Plan remains unchanged."};
});

const stripeOptions={region,timeoutSeconds:30,secrets:[stripeKey]};
const paymentReturnBase="https://packtook-staging.web.app/";
exports.createPaymentCheckout=onCall(stripeOptions,async req=>{
 const user=uid(req),d=data(req),id=d.requestId;
 if(!validOp(id))throw new HttpsError("invalid-argument","Invalid billing request ID");
 const acc=await ensureAccount(user),ticket=acc.collection("billingRequests").doc(id),snap=await ticket.get();
 if(!snap.exists||snap.data().requestedBy!==user)throw new HttpsError("not-found","Billing request not found");
 const item=snap.data();
 if(!Object.hasOwn(pricesTHB,item.plan)||item.plan==="Free"||item.amountTHB!==pricesTHB[item.plan])throw new HttpsError("failed-precondition","Invalid server-side price");
 if(item.status!=="pending_payment_setup"&&item.status!=="checkout_created")throw new HttpsError("failed-precondition","Billing request already processed");
 if(item.checkoutUrl&&item.status==="checkout_created")return {url:item.checkoutUrl,status:"checkout_created"};
 const key=stripeKey.value();
 if(!key)throw new HttpsError("failed-precondition","Payment gateway not configured");
 const form=new URLSearchParams({
  mode:"payment",success_url:paymentReturnBase+"?payment=return",cancel_url:paymentReturnBase+"?payment=cancel",
  "line_items[0][price_data][currency]":"thb",
  "line_items[0][price_data][product_data][name]":"PACKTOOK "+item.plan+" - 30 days",
  "line_items[0][price_data][unit_amount]":String(item.amountTHB*100),
  "line_items[0][quantity]":"1",
  "metadata[uid]":user,"metadata[requestId]":id,
  "payment_method_types[0]":"card","payment_method_types[1]":"promptpay"
 });
 const response=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded","Idempotency-Key":"packtook-"+user+"-"+id},body:form});
 const session=await response.json();
 if(!response.ok||!session.id||!session.url)throw new HttpsError("unavailable","Stripe Checkout unavailable");
 await ticket.update({status:"checkout_created",stripeSessionId:session.id,checkoutUrl:session.url,checkoutCreatedAt:FieldValue.serverTimestamp()});
 return {url:session.url,status:"checkout_created"};
});
exports.stripePaymentWebhook=onRequest({region,secrets:[stripeWebhookKey],invoker:"public"},async(req,res)=>{
 if(req.method!=="POST"){res.status(405).send("Method not allowed");return}
 const header=req.headers["stripe-signature"],secret=stripeWebhookKey.value();
 if(!header||!secret||!req.rawBody){res.status(400).send("Missing signature");return}
 const parts=Object.fromEntries(String(header).split(",").map(v=>v.split("=",2)));
 const ts=Number(parts.t),signature=parts.v1;
 if(!Number.isFinite(ts)||Math.abs(Date.now()/1000-ts)>300||!signature){res.status(400).send("Invalid signature");return}
 const expected=crypto.createHmac("sha256",secret).update(ts+"."+req.rawBody.toString("utf8")).digest("hex");
 if(signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))){res.status(400).send("Invalid signature");return}
 let event;try{event=JSON.parse(req.rawBody.toString("utf8"))}catch{res.status(400).send("Invalid payload");return}
 if(event.type!=="checkout.session.completed"&&event.type!=="checkout.session.async_payment_succeeded"){res.status(200).send("ignored");return}
 const session=event.data?.object||{};
 if(session.payment_status!=="paid"){res.status(200).send("awaiting payment");return}
 const id=session.metadata?.requestId,user=session.metadata?.uid;
 if(!validOp(id)||typeof user!=="string"||!user){res.status(400).send("Invalid metadata");return}
 const acc=own(user),ticket=acc.collection("billingRequests").doc(id);
 try{await db.runTransaction(async tx=>{
  const [tSnap,aSnap]=await Promise.all([tx.get(ticket),tx.get(acc)]);
  if(!tSnap.exists||!aSnap.exists)throw Error("Missing billing record");
  const t=tSnap.data(),a=aSnap.data();
  if(t.status==="paid")return;
  if(t.status!=="checkout_created"||t.stripeSessionId!==session.id||t.requestedBy!==user||session.currency!=="thb"||session.amount_total!==t.amountTHB*100||t.amountTHB!==pricesTHB[t.plan])throw Error("Payment verification mismatch");
  const base=a.plan===t.plan&&Date.parse(a.planExpiresAt)>Date.now()?Date.parse(a.planExpiresAt):Date.now();
  const expiresAt=new Date(base+30*86400000).toISOString();
  tx.update(acc,{plan:t.plan,planExpiresAt:expiresAt,updatedAt:FieldValue.serverTimestamp()});
  tx.update(ticket,{status:"paid",paidAt:FieldValue.serverTimestamp(),stripePaymentIntentId:session.payment_intent||null});
  tx.create(acc.collection("audit").doc(),{action:"subscription_paid",billingRequestId:id,stripeSessionId:session.id,plan:t.plan,createdAt:FieldValue.serverTimestamp()});
 });res.status(200).send("ok")}catch(e){res.status(500).send("Verification failed")}
});
