"use strict";
const {onCall,onRequest,HttpsError}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const omiseKey=defineSecret("PACKTOOK_OMISE_TEST_SECRET_KEY");
const omiseWebhookKey=defineSecret("PACKTOOK_OMISE_TEST_WEBHOOK_SECRET");
const admin=require("firebase-admin");
const crypto=require("node:crypto");
admin.initializeApp();
const db=admin.firestore();
const {FieldValue}=admin.firestore;
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const pricesTHB={Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
const deviceLimits={Free:1,Starter:1,Basic:1,Growth:3,Business:5,Pro:10};
const region="asia-southeast1";
const options={region,maxInstances:5,timeoutSeconds:30};
const PROMPTPAY_TEST_ENABLED=process.env.PACKTOOK_PROMPTPAY_TEST_ENABLED==="true";
function requireTest(){if(process.env.PACKTOOK_PRODUCTION_PROJECT_ID!=="packtook-prod-01"||!PROMPTPAY_TEST_ENABLED)
 throw new HttpsError("failed-precondition","PromptPay Test Mode is disabled");}
function uid(req){
 if(process.env.PACKTOOK_PRODUCTION_PROJECT_ID!=="packtook-prod-01")
  throw new HttpsError("failed-precondition","Production project guard missing");
 if(!req.auth?.uid)throw new HttpsError("unauthenticated","Sign in");
 if(req.auth.token?.email_verified!==true||req.auth.token?.packtookProductionBeta!==true)
  throw new HttpsError("permission-denied","Verified Production Beta account required");
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
 try{await ref.create({plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})}
 catch(e){if(e.code!==6&&e.code!=="already-exists")throw e}
 return ref;
}

function publicBillingRequest(doc){
 const x=doc.data();
 return {id:doc.id,plan:x.plan||"—",amountTHB:x.amountTHB??null,
  transferredCredits:x.transferredCredits??null,creditsPurchased:x.creditsPurchased??null,
  balanceAfter:x.balanceAfter??null,activationExpiresAt:x.activationExpiresAt||null,
  purchaseKind:x.purchaseKind||"new",status:x.status||"unknown",
  createdAt:x.createdAt?.toDate?.()?.toISOString()||null};
}
exports.promptpaySubscriptionOverview=onCall(options,async req=>{
 const id=uid(req);const ref=await ensureAccount(id),input=data(req);
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
exports.promptpayBillingHistory=onCall(options,async req=>{
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
exports.promptpayRequestPlanChange=onCall(options,async req=>{
 const id=uid(req);requireTest();const plan=data(req).plan;
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
exports.promptpayCancelRequest=onCall(options,async req=>{
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

const paymentSecrets={region,timeoutSeconds:45,maxInstances:5,secrets:[omiseKey]};
async function omiseAPI(path,method="GET",params=null){
 requireTest();
 const key=omiseKey.value();
 if(!key||!key.startsWith("skey_test_"))throw new HttpsError("failed-precondition","Production PromptPay Test requires skey_test_");
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
  if(item.omiseChargeId!==chargeId||item.requestedBy!==accountId||charge.id!==chargeId||charge.currency.toLowerCase()!=="thb"||charge.amount!==item.amountTHB*100||item.amountTHB!==pricesTHB[item.plan]||charge.metadata?.requestId!==requestId||charge.metadata?.uid!==accountId||charge.livemode!==false||charge.source?.type!=="promptpay"||item.paymentMethod!=="promptpay"||item.paymentProvider!=="omise")throw Error("Charge mismatch");
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
exports.promptpayConfig=onCall(options,async req=>{
 uid(req);
 return {enabled:PROMPTPAY_TEST_ENABLED,testMode:true,method:"promptpay",cardEnabled:false};
});
exports.promptpayCreateCharge=onCall(paymentSecrets,async req=>{
 const user=uid(req);requireTest();const d=data(req),id=d.requestId,method=d.method;
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
  if(!charge.id||charge.livemode!==false||charge.source?.type!=="promptpay")throw Error("Unexpected charge");
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
exports.promptpayRecoverCharge=onCall(paymentSecrets,async req=>{
 const user=uid(req);requireTest(),requestId=data(req).requestId;
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
   if(ch.livemode===false&&ch.source?.type==="promptpay"&&ch.metadata?.uid===user&&ch.metadata?.requestId===requestId&&ch.amount===bill.amountTHB*100&&String(ch.currency).toLowerCase()==="thb")matches.push(ch);
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
exports.promptpayChargeStatus=onCall(paymentSecrets,async req=>{
 const user=uid(req);requireTest(),id=data(req).requestId;
 if(!validOp(id))throw new HttpsError("invalid-argument","Invalid request");
 const snap=await own(user).collection("billingRequests").doc(id).get();
 if(!snap.exists||snap.data().requestedBy!==user)throw new HttpsError("not-found","Billing request not found");
 if(!snap.data().omiseChargeId)return {status:snap.data().status,needsReconciliation:snap.data().status==="creating_charge"};
 const result=await reconcileCharge(user,id,snap.data().omiseChargeId);
 if(result.status==="pending"){const charge=await omiseAPI("/charges/"+encodeURIComponent(snap.data().omiseChargeId));return {...result,qrImage:charge.source?.scannable_code?.image?.download_uri||null,chargeId:charge.id}}
 return result;
});
exports.promptpayWebhook=onRequest({region,maxInstances:3,timeoutSeconds:45,secrets:[omiseKey,omiseWebhookKey],invoker:"public"},async(req,res)=>{
 try{requireTest()}catch{res.status(503).send("disabled");return}
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
 if(!["charge.complete","charge.update"].includes(event?.key)||!/^chrg_[a-zA-Z0-9_]+$/.test(event?.data?.id||"")){res.status(200).send("ignored");return}
 const id=event.data.metadata?.requestId,user=event.data.metadata?.uid;
 if(!validOp(id)||!user){res.status(400).send("invalid metadata");return}
 try{await reconcileCharge(user,id,event.data.id);res.status(200).send("verified")}
 catch(e){res.status(500).send("reconciliation failed")}
});

exports.promptpayAudit=onCall(paymentSecrets,async req=>{
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


