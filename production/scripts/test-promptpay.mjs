// PACKTOOK V6.3 PromptPay-only Test Mode: mocked Firebase + Omise API regression.
// Does not connect to external network or modify Firebase.
import fs from "node:fs";
import crypto from "node:crypto";
const source=fs.readFileSync(new URL("../payment-functions/index.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const ui=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const bridge=fs.readFileSync(new URL("../app/firebase-packing-bridge.js",import.meta.url),"utf8");
const fail=msg=>{throw Error("V6.3 PromptPay regression: "+msg)};
const assert=(yes,msg)=>{if(!yes)fail(msg)};
assert(source.includes('PACKTOOK_OMISE_TEST_SECRET_KEY')&&source.includes('PACKTOOK_OMISE_TEST_WEBHOOK_SECRET'),"Secret Manager test-only names required");
assert(source.includes("skey_test_")&&!source.includes("skey_live_"),"Test mode hard gate missing");
assert(source.includes('method!=="promptpay"')&&source.includes('form["source[type]"]="promptpay"'),"Payment must only create PromptPay sources");
assert(source.includes('webhook_endpoints[]')&&source.includes('ref_id:"pt63-"'),"Production webhook routing/idempotent charge reference missing");
assert(source.includes('timingSafeEqual')&&source.includes('req.rawBody'),"Webhook signatures must be checked over the original body");
assert(source.includes('charge.source?.type!=="promptpay"'),"Reconciled charge must be verified as PromptPay");
assert(!/exports\.(?:.*Card|.*CreditCard|.*Visa|.*Mastercard)/.test(source),"Card payment API found");
assert(html.includes("OMISE PROMPTPAY QR TEST MODE")&&html.includes("app.js?v=6.4.2"),"Customer Test-only banner/cache version absent");
assert(bridge.includes('api("promptpayCreateCharge")')&&!bridge.includes('api("createOmisePayment")'),"Customer bridge must use QR-only endpoint");
const documents=new Map();
const deleted=Symbol("delete"),timestamp=()=>new Date();
const server={serverTimestamp:timestamp,increment:n=>({inc:n}),delete:()=>deleted};
let userId="testWalletUser";
documents.set("accounts/"+userId,{plan:"Free",period:new Date().toISOString().slice(0,7),used:0,reserved:0,billingVersion:0});
let ticketId="r6qrtest123456789012",chargeStatus="pending",currentMode="promptpay",currentLive=false,paid=false;
let chargeCreateCount=0,charge=null,apiGetCount=0;
function ref(path){
 return {id:path.split("/").at(-1),path,
  collection(name){return collection(path+"/"+name)},
  async create(data){if(documents.has(path))throw {code:6};documents.set(path,{...data})},
  async get(){return snapshot(path)},
  async set(data){documents.set(path,{...data})},
  async delete(){documents.delete(path)},
  async update(patch){merge(path,patch)}};
}
function snapshot(path){
 return {id:path.split("/").at(-1),exists:documents.has(path),
  data:()=>documents.get(path),ref:ref(path)};
}
function merge(path,patch){
 const next={...documents.get(path)};
 for(const [key,v] of Object.entries(patch)){
  if(v===deleted)delete next[key];
  else if(v&&typeof v==="object"&&Object.hasOwn(v,"inc"))next[key]=(next[key]||0)+v.inc;
  else next[key]=v;
 }
 documents.set(path,next);
}
function collection(path){
 const q={_limit:100,_filter:null,_sort:null,_after:null,
  doc(id){return ref(path+"/"+(id||ticketId))},
  where(field,op,value){this._filter={field,op,value};return this},
  orderBy(field,direction="asc"){this._sort={field,direction};return this},
  limit(n){this._limit=n;return this},
  startAfter(doc){this._after=doc;return this},
  async get(){
   let rows=[...documents.keys()].filter(k=>k.startsWith(path+"/")&&k.split("/").length===path.split("/").length+1).map(snapshot);
   if(this._filter)rows=rows.filter(d=>this._filter.op==="<="&&
     typeof d.data()?.[this._filter.field]==="string"&&d.data()[this._filter.field]<=this._filter.value);
   if(this._sort)rows.sort((a,b)=>{
    const x=a.data()?.[this._sort.field]||"",y=b.data()?.[this._sort.field]||"";
    const cmp=x.localeCompare(y)||a.id.localeCompare(b.id);
    return this._sort.direction==="desc"?-cmp:cmp;
   });
   else rows.sort((a,b)=>b.id.localeCompare(a.id));
   if(this._after){const pos=rows.findIndex(d=>d.id===this._after.id);rows=pos<0?[]:rows.slice(pos+1)}
   rows=rows.slice(0,this._limit);
   return {docs:rows,size:rows.length,empty:rows.length===0};
  }
 };
 return q;
}
const db={collection,async runTransaction(fn){
 const pending=[];
 const tx={get:async r=>snapshot(r.path),
  create(r,data){if(documents.has(r.path))throw Error("duplicate");pending.push(["create",r.path,data])},
  update(r,patch){pending.push(["update",r.path,patch])}};
 const result=await fn(tx);
 for(const [kind,path,data] of pending){if(kind==="create")documents.set(path,{...data});else merge(path,data)}
 return result;
}};
const firestore=Object.assign(()=>db,{FieldValue:server});
const admin={initializeApp(){},firestore};
class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details}}
const secretValue=new Map([["PACKTOOK_OMISE_TEST_SECRET_KEY","skey_test_mock_only"],["PACKTOOK_OMISE_TEST_WEBHOOK_SECRET",Buffer.from("webhook-mock-secret").toString("base64")]]);
const mockedRequire=name=>{
 if(name==="firebase-admin")return admin;
 if(name==="firebase-functions/v2/https")return {onCall:(_opt,fn)=>fn,onRequest:(_opt,fn)=>fn,HttpsError};
 if(name==="firebase-functions/v2/scheduler")return {onSchedule:(_opts,fn)=>fn};
 if(name==="firebase-functions/params")return {defineSecret:name=>({value:()=>secretValue.get(name)})};
 if(name==="node:crypto")return crypto;
 throw Error("Unexpected import "+name);
};
async function mockedFetch(url,options={}){
 if(!url.startsWith("https://api.omise.co/"))throw Error("Wrong Omise endpoint");
 if(options.method==="POST"){
  chargeCreateCount++;
  const form=new URLSearchParams(options.body);
  assert(form.get("source[type]")==="promptpay","A non-PromptPay charge was attempted");
  assert(form.get("webhook_endpoints[]")?.includes("packtook-prod-01"),"Production webhook route missing");
  assert(["19900","29900"].includes(form.get("amount")),"Unsupported mock plan amount");
  charge={id:form.get("amount")==="29900"?"chrg_test_basic123":"chrg_test_mockqr123",
   status:"pending",paid:false,livemode:false,
   amount:Number(form.get("amount")),currency:"thb",expires_at:form.get("expires_at"),
   metadata:{uid:userId,requestId:ticketId},
   source:{type:"promptpay",scannable_code:{image:{download_uri:"https://api.omise.co/mock-qr.svg"}}}};
  return {ok:true,status:200,json:async()=>charge};
 }
 apiGetCount++;
 return {ok:true,status:200,json:async()=>({...charge,status:chargeStatus,paid,livemode:currentLive,
  source:{...charge.source,type:currentMode}})};
}
function createService(enabled){
 const result={};
 new Function("require","exports","fetch","process",source)(
  mockedRequire,result,mockedFetch,{env:{PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
   PACKTOOK_PROMPTPAY_TEST_ENABLED:enabled?"true":"false"}});
 return result;
}
const request=data=>({auth:{uid:userId,token:{email_verified:true,packtookProductionBeta:true,packtookPaymentTester:true}},data});
async function rejects(op,code){
 let e;try{await op}catch(err){e=err}
 assert(e?.code===code,"Expected "+code+" but received "+(e?.code||"success"));
}
const disabled=createService(false);
const disabledConfig=await disabled.promptpayConfig(request({}));
assert(disabledConfig.enabled===false&&disabledConfig.reason==="feature_disabled","QR test flag must default disabled");
await rejects(disabled.promptpayRequestPlanChange(request({plan:"Starter"})),"failed-precondition");
const api=createService(true);
await rejects(api.promptpayRequestPlanChange({auth:{uid:userId,token:{email_verified:true,packtookProductionBeta:true}},data:{plan:"Starter"}}),"permission-denied");
const blockedConfig=await api.promptpayConfig({auth:{uid:userId,token:{email_verified:true,packtookProductionBeta:true}},data:{}});
assert(blockedConfig.enabled===false&&blockedConfig.reason==="tester_permission_missing","Unapproved Beta users must be told QR Tester permission is missing");
const readyConfig=await api.promptpayConfig(request({}));
assert(readyConfig.enabled===true&&readyConfig.reason==="ready"&&readyConfig.cardEnabled===false,"Explicit QR Tester should see ready and never cards");
const pending=await api.promptpayRequestPlanChange(request({plan:"Starter"}));
assert(pending.amountTHB===199&&pending.status==="pending_payment_setup","Unpaid request must not upgrade membership");
assert(documents.get("accounts/"+userId).plan==="Free","Plan changed before payment");
await rejects(api.promptpayCreateCharge(request({requestId:pending.requestId,method:"card"})),"invalid-argument");
const created=await api.promptpayCreateCharge(request({requestId:pending.requestId,method:"promptpay"}));
assert(created.qrImage?.startsWith("https://api.omise.co/"),"Missing provider QR image");
assert(created.qrExpiresAt&&Number.isFinite(Date.parse(created.qrExpiresAt)),"QR must return provider-confirmed expiration date");
const pendingDoc=documents.get("accounts/"+userId+"/billingRequests/"+pending.requestId);
assert(pendingDoc.qrExpiresAt===created.qrExpiresAt,"Provider expiry must persist with billing request");
const retryCharge=await api.promptpayCreateCharge(request({requestId:pending.requestId,method:"promptpay"}));
assert(retryCharge.status==="pending"&&retryCharge.qrImage===created.qrImage,"Repeat checkout must reuse existing pending provider QR");
assert(chargeCreateCount===1,"Charge must be created once");
const state1=await api.promptpayChargeStatus(request({requestId:pending.requestId}));
assert(state1.status==="pending"&&documents.get("accounts/"+userId).plan==="Free","Pending QR must never activate plan");
const webhookBody={key:"charge.complete",data:{id:"chrg_test_mockqr123",metadata:{uid:userId,requestId:ticketId}}};
const body=Buffer.from(JSON.stringify(webhookBody)),now=String(Math.floor(Date.now()/1000));
const signature=crypto.createHmac("sha256",Buffer.from(secretValue.get("PACKTOOK_OMISE_TEST_WEBHOOK_SECRET"),"base64")).update(now+"."+body.toString("utf8")).digest("hex");
async function webhook(sig){
 const result={code:0,message:"",status(code){this.code=code;return this},send(message){this.message=message;return this}};
 await api.promptpayWebhook({method:"POST",rawBody:body,headers:{"omise-signature-timestamp":now,"omise-signature":sig},body:webhookBody},result);
 return result;
}
const forged=await webhook("0".repeat(64));
assert(forged.code===401&&documents.get("accounts/"+userId).plan==="Free","Forged webhook must not activate");
chargeStatus="successful";paid=true;currentMode="card";
const badType=await webhook(signature);
assert(badType.code===500&&documents.get("accounts/"+userId).plan==="Free","Wrong source must be rejected");
currentMode="promptpay";currentLive=true;
const live=await webhook(signature);
assert(live.code===500&&documents.get("accounts/"+userId).plan==="Free","Live charge must be rejected");
currentLive=false;
const good=await webhook(signature);
assert(good.code===200&&documents.get("accounts/"+userId).plan==="Starter","Test-only verified charge must activate");
const balance=documents.get("accounts/"+userId).creditWalletRemaining;
assert(balance===70,"Starter 50 + remaining Free 20 credits should become a 70-credit wallet");
assert(documents.get("accounts/"+userId).planExpiresAt,"Paid expiry was not set");
const paidDoc=documents.get("accounts/"+userId+"/billingRequests/"+pending.requestId);
assert(paidDoc.paymentEvidenceVersion===1&&paidDoc.providerVerifiedStatus==="successful"&&
 paidDoc.providerVerifiedPaid===true&&paidDoc.providerVerifiedChargeId==="chrg_test_mockqr123"&&
 paidDoc.providerVerifiedAmountSatang===19900&&paidDoc.providerVerifiedCurrency==="thb"&&
 paidDoc.providerVerifiedSource==="promptpay"&&paidDoc.providerVerifiedLivemode===false,
 "Paid ledger must store trusted Omise TEST verification evidence");
assert(paidDoc.qrExpiresAt===created.qrExpiresAt,"Paid settlement must preserve original QR expiry");
const repeated=await webhook(signature);
assert(repeated.code===200&&documents.get("accounts/"+userId).creditWalletRemaining===70,"Webhook replay must not grant credits twice");
const status=await api.promptpayChargeStatus(request({requestId:pending.requestId}));
assert(status.status==="paid"&&documents.get("accounts/"+userId).creditWalletRemaining===70,"Polling must be idempotent");
const retryPaidCheckout=await api.promptpayCreateCharge(request({requestId:pending.requestId,method:"promptpay"}));
assert(retryPaidCheckout.status==="paid"&&!retryPaidCheckout.qrImage,
 "Reopening paid checkout must return Paid, never show QR or create another Charge");
assert(chargeCreateCount===1&&apiGetCount>=4,"Provider status must be checked independently");
chargeStatus="failed";paid=false;
const anomaly=await api.promptpayChargeStatus(request({requestId:pending.requestId}));
assert(anomaly.status==="payment_review"&&anomaly.alreadyApplied===true,
 "Paid charge with changed provider status must require manual review rather than ungrant credits");
assert(documents.get("accounts/"+userId).creditWalletRemaining===70,
 "Provider discrepancy must not automatically deduct previously granted credits");
assert(documents.get("accounts/"+userId+"/billingRequests/"+pending.requestId).postSettlementAlert==="provider_status_changed",
 "Provider discrepancy must be reported in paid ledger");
await rejects(api.promptpayRequestPlanChange(request({plan:"Free"})),"failed-precondition");
for(const terminal of ["expired","failed"]){
 userId="testWalletUser_"+terminal;
 ticketId="r6qr"+terminal+"123456789012";
 documents.set("accounts/"+userId,{
  plan:"Free",period:new Date().toISOString().slice(0,7),used:0,reserved:0,billingVersion:0
 });
 chargeStatus="pending";paid=false;currentMode="promptpay";currentLive=false;
 const next=await api.promptpayRequestPlanChange(request({plan:"Starter"}));
 const newQr=await api.promptpayCreateCharge(request({requestId:next.requestId,method:"promptpay"}));
 assert(newQr.status==="pending"&&newQr.qrImage,"Terminal test scenario should start as pending QR");
 chargeStatus=terminal;
 if(terminal==="failed"){charge.failure_code="payment_cancelled";charge.failure_message="Mock customer cancelled";}
 const closed=await api.promptpayChargeStatus(request({requestId:next.requestId}));
 const account=documents.get("accounts/"+userId);
 const bill=documents.get("accounts/"+userId+"/billingRequests/"+next.requestId);
 const retryTerminal=await api.promptpayCreateCharge(request({requestId:next.requestId,method:"promptpay"}));
 assert(retryTerminal.status===terminal&&!retryTerminal.qrImage,
  "Terminal "+terminal+" retry must not create new Charge");
 assert(closed.status===terminal&&bill.status===terminal&&bill.closedAt,
  "Provider "+terminal+" must close billing request only after Omise GET");
 assert(bill.providerVerifiedStatus===terminal&&bill.providerVerifiedAt,
  "Provider terminal status "+terminal+" requires evidence of independent check");
 assert(!account.openBillingRequestId&&account.plan==="Free"&&account.creditWalletV1!==true,
  "Provider "+terminal+" must release billing lock without granting credits or changing plan");
 if(terminal==="failed")assert(bill.providerFailureCode==="payment_cancelled","Omise failure code must be captured");
 const repeatedStatus=await api.promptpayChargeStatus(request({requestId:next.requestId}));
 assert(repeatedStatus.status===terminal&&documents.get("accounts/"+userId).plan==="Free",
  "Repeated terminal check must not grant credits");
}

// Integration: active Starter -> Basic upgrade must preserve the 120-credit wallet.
for(const scenario of [
 {name:"active",expires:new Date(Date.now()+15*86400000).toISOString(),old:120,expected:420},
 {name:"grace9",expires:new Date(Date.now()-9*86400000).toISOString(),old:45,expected:345},
 {name:"after11",expires:new Date(Date.now()-11*86400000).toISOString(),old:45,expected:300}
]){
 userId="upgradeCredit_"+scenario.name;
 ticketId="request_"+scenario.name+"_123456789012345";
 documents.set("accounts/"+userId,{
  plan:"Starter",planExpiresAt:scenario.expires,
  creditWalletV1:true,creditWalletRemaining:scenario.old,
  used:0,reserved:0,billingVersion:0
 });
 paid=false;chargeStatus="pending";currentMode="promptpay";currentLive=false;
 const req=await api.promptpayRequestPlanChange(request({plan:"Basic"}));
 assert(req.purchaseKind==="upgrade","Existing Starter to Basic must be an Upgrade even when expired");
 const createdUpgrade=await api.promptpayCreateCharge(
  request({requestId:req.requestId,method:"promptpay"}));
 assert(createdUpgrade.status==="pending"&&charge.amount===29900,
  "Basic Upgrade must create a pending THB299 test Charge");
 chargeStatus="successful";paid=true;
 const verified=await api.promptpayChargeStatus(request({requestId:req.requestId}));
 assert(verified.status==="paid","Basic upgrade must settle only after Omise confirms Paid");
 const a=documents.get("accounts/"+userId),bill=documents.get("accounts/"+userId+"/billingRequests/"+req.requestId);
 assert(a.plan==="Basic"&&a.creditWalletRemaining===scenario.expected&&
  bill.balanceAfter===scenario.expected&&bill.transferredCredits===scenario.expected-300&&
  bill.creditsPurchased===300,
  "Upgrade "+scenario.name+" must be 300 + eligible prior credits, without silently resetting wallet");
 if(scenario.name==="active")
  assert(Date.parse(a.planExpiresAt)>Date.parse(scenario.expires)+29*86400000,
   "Active upgrade must extend existing expiry 30 days");
 if(scenario.name!=="active")
  assert(Date.parse(a.planExpiresAt)>Date.now()+29*86400000,
   "Expired upgrade must start a new 30-day validity period");
 const repeated=await api.promptpayChargeStatus(request({requestId:req.requestId}));
 assert(repeated.status==="paid"&&documents.get("accounts/"+userId).creditWalletRemaining===scenario.expected,
  "Upgrade Payment status repetition must not credit twice");
 await rejects(api.promptpayRequestPlanChange(request({plan:"Starter"})),"failed-precondition");
}
// V6.4.2: purchase the SAME tier at any point in the term, even when credits remain.
for(const scenario of [
 {name:"early",daysLeft:21,old:120,expected:170},
 {name:"reminder",daysLeft:6,old:40,expected:90},
 {name:"grace",daysLeft:-9,old:45,expected:95}
]){
 userId="samePlanRenew_"+scenario.name;
 ticketId="req_selfrenew_"+scenario.name+"_1234567890123";
 const oldExpiry=new Date(Date.now()+scenario.daysLeft*86400000).toISOString();
 documents.set("accounts/"+userId,{
  plan:"Starter",planExpiresAt:oldExpiry,creditWalletV1:true,
  creditWalletRemaining:scenario.old,used:0,reserved:0,billingVersion:0
 });
 paid=false;chargeStatus="pending";currentMode="promptpay";currentLive=false;
 const requestRow=await api.promptpayRequestPlanChange(request({plan:"Starter"}));
 assert(requestRow.purchaseKind==="renewal","Active/expired same-tier request must be a renewal");
 const pendingQr=await api.promptpayCreateCharge(request({requestId:requestRow.requestId,method:"promptpay"}));
 assert(pendingQr.status==="pending"&&charge.amount===19900,
  "Same-tier Starter renewal must create only one THB199 Test Charge");
 assert(documents.get("accounts/"+userId).creditWalletRemaining===scenario.old,
  "Pending QR must not reset/add credit before verified Paid");
 chargeStatus="successful";paid=true;
 const settled=await api.promptpayChargeStatus(request({requestId:requestRow.requestId}));
 const acc=documents.get("accounts/"+userId);
 const receipt=documents.get("accounts/"+userId+"/billingRequests/"+requestRow.requestId);
 assert(settled.status==="paid"&&acc.plan==="Starter"&&acc.creditWalletRemaining===scenario.expected&&
  receipt.transferredCredits===scenario.old&&receipt.creditsPurchased===50,
  "Same-tier "+scenario.name+" renewal must retain original wallet plus 50 new credits");
 const expectedExpiry=new Date(Math.max(Date.now(),Date.parse(oldExpiry))+30*86400000);
 assert(Math.abs(Date.parse(acc.planExpiresAt)-expectedExpiry.getTime())<15000,
  "Same-plan "+scenario.name+" must extend original active expiry or start 30 days after payment");
 const retry=await api.promptpayChargeStatus(request({requestId:requestRow.requestId}));
 assert(retry.status==="paid"&&documents.get("accounts/"+userId).creditWalletRemaining===scenario.expected,
  "Same-tier repeated payment status cannot grant credit twice");
}
// After expiry, lower-tier packages are still prohibited.
userId="expiredProNoDowngrade";ticketId="r6qrexpro12345678901234";
documents.set("accounts/"+userId,{
 plan:"Pro",planExpiresAt:new Date(Date.now()-20*86400000).toISOString(),
 creditWalletV1:true,creditWalletRemaining:null,used:0,reserved:0,billingVersion:0
});
await rejects(api.promptpayRequestPlanChange(request({plan:"Business"})),"failed-precondition");

// Scheduled credit forfeiture is verified against live-shaped Firestore mock.
const cutoff=new Date(Date.now()-11*86400000).toISOString();
const withinGrace=new Date(Date.now()-5*86400000).toISOString();
documents.set("accounts/expiredWalletForfeit",{
 plan:"Starter",planExpiresAt:cutoff,creditWalletV1:true,
 creditWalletRemaining:23,used:0,reserved:0
});
documents.set("accounts/expiredWalletRetain",{
 plan:"Starter",planExpiresAt:withinGrace,creditWalletV1:true,
 creditWalletRemaining:47,used:0,reserved:0
});
documents.set("accounts/expiredWalletReserved",{
 plan:"Starter",planExpiresAt:cutoff,creditWalletV1:true,
 creditWalletRemaining:55,used:0,reserved:1
});
await api.promptpayExpireUnusedCredits();
assert(documents.get("accounts/expiredWalletForfeit").creditWalletRemaining===0&&
 documents.get("accounts/expiredWalletForfeit").expiredCreditsForfeited===23,
 "Daily expiry job must reset unused paid wallet after ten days");
assert(documents.get("accounts/expiredWalletRetain").creditWalletRemaining===47,
 "Wallet within 10-day grace must remain intact");
assert(documents.get("accounts/expiredWalletReserved").creditWalletRemaining===55,
 "Expiry sweep must never clear wallet while a reservation is outstanding");
const forfeitureLogs=[...documents.keys()].filter(k=>k.startsWith("accounts/expiredWalletForfeit/audit/"));
assert(forfeitureLogs.length===1&&documents.get(forfeitureLogs[0]).action==="expired_wallet_10_day_forfeiture",
 "Credit forfeiture must have an audit record");
await api.promptpayExpireUnusedCredits();
assert([...documents.keys()].filter(k=>k.startsWith("accounts/expiredWalletForfeit/audit/")).length===1,
 "Repeated daily expiry job must not reset or audit twice");
console.log("PASS: V6.4.2 same-plan early renewals 120+50, pre-expiry notice window, grace carryover, no downgrades, QR idempotency");
