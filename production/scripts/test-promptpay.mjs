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
assert(html.includes("OMISE PROMPTPAY QR TEST MODE")&&html.includes("app.js?v=6.3.0"),"Customer Test-only banner/cache version absent");
assert(bridge.includes('api("promptpayCreateCharge")')&&!bridge.includes('api("createOmisePayment")'),"Customer bridge must use QR-only endpoint");
const documents=new Map();
const deleted=Symbol("delete"),timestamp=()=>new Date();
const server={serverTimestamp:timestamp,increment:n=>({inc:n}),delete:()=>deleted};
const userId="testWalletUser";
documents.set("accounts/"+userId,{plan:"Free",period:new Date().toISOString().slice(0,7),used:0,reserved:0,billingVersion:0});
let ticketId="r6qrtest123456789012",chargeStatus="pending",currentMode="promptpay",currentLive=false,paid=false;
let chargeCreateCount=0,charge=null,apiGetCount=0;
function ref(path){
 return {id:path.split("/").at(-1),path,
  collection(name){return collection(path+"/"+name)},
  async create(data){if(documents.has(path))throw {code:6};documents.set(path,{...data})},
  async get(){return snapshot(path)},
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
 return {doc(id){return ref(path+"/"+(id||ticketId))},
  orderBy(){return this},limit(n){this._limit=n;return this},
  startAfter(){return this},
  async get(){let docs=[...documents.keys()].filter(k=>k.startsWith(path+"/")&&k.split("/").length===path.split("/").length+1).map(snapshot);
   docs.sort((a,b)=>b.id.localeCompare(a.id));return {docs:docs.slice(0,this._limit||100),size:docs.length,empty:docs.length===0}}};
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
  assert(form.get("amount")==="19900","Starter price mismatch");
  charge={id:"chrg_test_mockqr123",status:"pending",paid:false,livemode:false,
   amount:19900,currency:"thb",metadata:{uid:userId,requestId:ticketId},
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
const request=data=>({auth:{uid:userId,token:{email_verified:true,packtookProductionBeta:true}},data});
async function rejects(op,code){
 let e;try{await op}catch(err){e=err}
 assert(e?.code===code,"Expected "+code+" but received "+(e?.code||"success"));
}
const disabled=createService(false);
assert((await disabled.promptpayConfig(request({}))).enabled===false,"QR test flag must default disabled");
await rejects(disabled.promptpayRequestPlanChange(request({plan:"Starter"})),"failed-precondition");
const api=createService(true);
await rejects(api.promptpayRequestPlanChange({auth:{uid:userId,token:{email_verified:true}},data:{plan:"Starter"}}),"permission-denied");
assert((await api.promptpayConfig(request({}))).cardEnabled===false,"Credit card must never be enabled");
const pending=await api.promptpayRequestPlanChange(request({plan:"Starter"}));
assert(pending.amountTHB===199&&pending.status==="pending_payment_setup","Unpaid request must not upgrade membership");
assert(documents.get("accounts/"+userId).plan==="Free","Plan changed before payment");
await rejects(api.promptpayCreateCharge(request({requestId:pending.requestId,method:"card"})),"invalid-argument");
const created=await api.promptpayCreateCharge(request({requestId:pending.requestId,method:"promptpay"}));
assert(created.qrImage?.startsWith("https://api.omise.co/"),"Missing provider QR image");
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
const repeated=await webhook(signature);
assert(repeated.code===200&&documents.get("accounts/"+userId).creditWalletRemaining===70,"Webhook replay must not grant credits twice");
const status=await api.promptpayChargeStatus(request({requestId:pending.requestId}));
assert(status.status==="paid"&&documents.get("accounts/"+userId).creditWalletRemaining===70,"Polling must be idempotent");
assert(chargeCreateCount===1&&apiGetCount>=4,"Provider status must be checked independently");
await rejects(api.promptpayRequestPlanChange(request({plan:"Free"})),"failed-precondition");
console.log("PASS: V6.3 PromptPay QR Test-only, unsigned webhook rejection, independent provider verification, 70 credits and replay idempotency");
