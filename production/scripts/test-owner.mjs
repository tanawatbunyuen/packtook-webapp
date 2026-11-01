// PACKTOOK V6.2 owner unit/smoke test. No network, no Firebase project changes.
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const backend=fs.readFileSync(new URL("../owner-functions/index.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../owner/index.html",import.meta.url),"utf8");
const client=fs.readFileSync(new URL("../owner/app.js",import.meta.url),"utf8");
const config=JSON.parse(fs.readFileSync(new URL("../firebase.json",import.meta.url),"utf8"));
function assert(ok,msg){if(!ok)throw Error("V6.2 Owner test: "+msg)}
assert(html.includes('noindex,nofollow')&&html.includes("OWNER BETA"),"Owner portal must not be indexable");
assert(html.includes("mascot-eagle.svg")&&html.includes("logo.svg"),"Branding missing");
assert(!/packtook-staging|firebase-staging|skey_live_/.test(html+client),"Staging references forbidden");
assert(client.includes('firebaseConfig.projectId!=="packtook-prod-01"'),"Client Production guard missing");
assert(!client.includes('api("ownerAdjustCredits")')&&!client.includes('api("requestPlanChange")'),"No Owner writes in Beta");
const ownerConfig=config.functions.find(x=>x.codebase==="owner");
assert(ownerConfig?.source==="owner-functions","Owner Functions codebase is not isolated");
const exportsObj={};
const accounts=[
 {id:"cust1",data:()=>({plan:"Free",period:new Date().toISOString().slice(0,7),used:2,reserved:1,createdAt:new Date("2026-11-01T08:00:00Z")})},
 {id:"cust2",data:()=>({plan:"Starter",planExpiresAt:"2099-12-31T23:59:59Z",creditWalletV1:true,creditWalletRemaining:42,reserved:0,createdAt:new Date("2026-11-01T08:00:00Z")})},
 {id:"cust3",data:()=>({plan:"Starter",planExpiresAt:"2026-01-01T00:00:00Z",creditWalletV1:true,creditWalletRemaining:10,reserved:0,createdAt:new Date("2026-09-10T02:00:00Z")})}
];
// Paid records are reporting fixtures only; no payment processor or charge is called.
const billing=new Map([
 ["cust1",[
  {status:"paid",paymentProvider:"omise",omiseLivemode:true,omiseChargeId:"chrg_ABC123",
   plan:"Starter",amountTHB:199,paidAt:new Date().toISOString()},
  {status:"paid",paymentProvider:"omise",omiseLivemode:false,omiseChargeId:"chrg_test_ABC123",
   plan:"Basic",amountTHB:299,paidAt:new Date().toISOString(),
   paymentEvidenceVersion:1,providerVerifiedChargeId:"chrg_test_ABC123",
   providerVerifiedAmountSatang:29900,providerVerifiedStatus:"successful",providerVerifiedPaid:true,
   providerVerifiedSource:"promptpay",providerVerifiedCurrency:"thb",providerVerifiedLivemode:false},
  {status:"paid",paymentProvider:"omise",omiseChargeId:"chrg_test_LEGACY123",
   plan:"Basic",amountTHB:99,paidAt:new Date().toISOString()},
  {status:"paid",paymentProvider:"omise",omiseChargeId:"chrg_old_ABC123",
   plan:"Starter",amountTHB:199,paidAt:new Date().toISOString()},
  {status:"failed",paymentProvider:"omise",omiseLivemode:true,omiseChargeId:"chrg_fail_ABC123",
   plan:"Starter",amountTHB:599,paidAt:new Date().toISOString()},
  {status:"payment_pending",plan:"Starter",amountTHB:199,
   createdAt:new Date(Date.now()-55*60000),qrExpiresAt:new Date(Date.now()-10*60000).toISOString()},
  {status:"creating_charge",plan:"Starter",amountTHB:199,
   claimedAt:new Date(Date.now()-11*60000)},
  {status:"payment_review",plan:"Starter",amountTHB:199,
   createdAt:new Date(Date.now()-15*60000)}
 ]],
 ["cust2",[]],["cust3",[]]
]);
for(const account of accounts){
 account.ref={collection(name){
  assert(name==="billingRequests","Unexpected financial collection");
  let n=101,paidOnly=false;
  return {where(field,op,value){
   assert(field==="status"&&op==="=="&&value==="paid","Unexpected ledger filter");
   paidOnly=true;return this;
  },orderBy(field,direction){assert(field==="createdAt"&&direction==="desc","Expected recent payment health scan");return this},
  limit(value){n=value;return this},
  async get(){
   const raw=(billing.get(account.id)||[]).filter(x=>!paidOnly||x.status==="paid").slice(0,n);
   return {docs:raw.map((x,i)=>({id:account.id+"_bill_"+i,data:()=>x}))};
  }};
 }};
}
const query=(after=null,count=100)=>({
 orderBy(){return this},
 limit(n){return query(after,n)},
 startAfter(doc){return query(typeof doc==="string"?doc:doc.id,count)},
 async get(){
  const selected=accounts.filter(x=>!after||x.id>after).slice(0,count);
  return {docs:selected,size:selected.length,empty:selected.length===0};
 }
});
let ownerClaimActive=true;
const admin={
 initializeApp(){},
 firestore:Object.assign(()=>({collection:name=>{assert(name==="accounts","Unexpected collection "+name);return query()}}),{FieldPath:{documentId:()=>".documentId"}}),
 auth:()=>({
  getUser:async uid=>({uid,emailVerified:true,disabled:false,customClaims:{packtookPlatformOwner:ownerClaimActive}}),
  getUsers:async list=>({users:list.map(x=>({uid:x.uid,email:x.uid+"@example.test"}))})
 })
};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const fakeRequire=id=>{
 if(id==="firebase-admin")return admin;
 if(id==="node:crypto")return crypto;
 if(id==="firebase-functions/v2/https")return {onCall:(_,fn)=>fn,HttpsError};
 throw Error("Unexpected dependency "+id);
};
vm.runInNewContext(backend,{exports:exportsObj,require:fakeRequire,process:{env:{PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",GCLOUD_PROJECT:"packtook-prod-01"}},console,Date,Map,Set,Object,Number,Math,Promise,Array,String,RegExp}, {filename:"owner-functions/index.js"});
const exported=Object.keys(exportsObj).sort();
assert(exported.join(",")==="ownerAnalyticsCustomers,ownerAnalyticsRevenue,ownerAnalyticsSummary,ownerCustomerManagementHistory,ownerManageCustomer,ownerManagementStatus,ownerPaymentHealth","Only seven reviewed Owner endpoints allowed");
const valid={auth:{uid:"owner-test",token:{email_verified:true,packtookPlatformOwner:true}},data:{}};
async function rejected(request,expected){
 let error;try{await exportsObj.ownerAnalyticsSummary(request)}catch(e){error=e}
 assert(error?.code===expected,"Unexpected permission response for "+expected+": "+(error?.code||"none"));
}
await rejected({}, "unauthenticated");
await rejected({auth:{uid:"customer",token:{email_verified:true,packtookProductionBeta:true}}},"permission-denied");
await rejected({auth:{uid:"owner",token:{email_verified:false,packtookPlatformOwner:true}}},"permission-denied");
const sum=await exportsObj.ownerAnalyticsSummary(valid);
assert(sum.mode==="production-beta"&&sum.billingEnabled===false,"No payment-enabled state may be reported");
assert(sum.totals.customers===3&&sum.totals.free===1&&sum.totals.activePaid===1&&sum.totals.expiredPaid===1,"Summary counts incorrect");
const customers=await exportsObj.ownerAnalyticsCustomers(valid);
assert(customers.customers.length===3&&customers.customers[0].email==="cust1@example.test","Customer Auth emails missing");
assert(customers.customers[0].creditsRemaining===17,"Free credits must account for used and reserved");
assert(customers.customers[0].expiryState==="no_expiry"&&customers.customers[0].expiresAt===null,"Free plan has no expiry, not missing data");
assert(customers.customers[1].expiryState==="active"&&customers.customers[1].daysRemaining>0,"Paid expiry must be visible");
assert(customers.customers[2].expiryState==="expired"&&customers.customers[2].daysRemaining===0,"Expired plan must show expired state");
assert(customers.customers[1].creditsRemaining===42,"Wallet credit remaining incorrect");
assert(customers.customers[2].creditsRemaining===0&&customers.customers[2].creditsStatus==="expired","Expired membership should not show usable credits");
const revenue=await exportsObj.ownerAnalyticsRevenue(valid);
assert(revenue.billingEnabled===false&&revenue.reconciliation==="NOT_RECONCILED","Production payment must remain closed");
assert(revenue.totals.liveSalesTHB===199&&revenue.totals.livePayments===1,"Explicit live ledger amount counted");
assert(revenue.totals.testSalesTHB===398&&revenue.totals.testPayments===2,"Test transaction separated");
assert(revenue.totals.unclassifiedSalesTHB===199&&revenue.totals.unclassifiedPayments===1,"Unclassified transaction not mislabeled live");
assert(revenue.totals.liveSalesTHB!==199+398+199,"Live revenue must not include Test or unclassified records");
assert(revenue.months.some(x=>x.liveSalesTHB===199&&x.testSalesTHB===398),"Monthly categories must be populated");
const health=await exportsObj.ownerPaymentHealth(valid);
assert(health.testModeOnly===true&&health.providerReconciliation==="NOT_RECONCILED","Payment health must be read-only Test ledger");
assert(health.totals.requestsScanned===8,"All billing statuses must be scanned");
assert(health.totals.paymentPending===1&&health.totals.qrPastExpiryCheckProvider===1,"QR past requested expiry needs provider recheck");
assert(health.totals.creatingCharge===1&&health.totals.stuckChargeCreation===1,"Stuck charge creation must be flagged");
assert(health.totals.reviewRequired===1,"Payment review cases must be visible to Owner");
assert(health.totals.paidEvidenceVerified===1&&health.totals.legacyPaidEvidenceMissing===3,
 "Verified evidence versus legacy paid records should be distinguished");
assert(health.issues.every(x=>x.accountId&&x.requestId&&x.issue),"Issues must provide bounded account and request IDs");
let healthDenied=false;
try{await exportsObj.ownerPaymentHealth({auth:{uid:"not-owner",token:{email_verified:true,packtookProductionBeta:true}}})}
catch(e){healthDenied=e.code==="permission-denied"}
assert(healthDenied,"Health report must reject non-Owner users");
let denied=false;try{await exportsObj.ownerAnalyticsCustomers({...valid,data:{afterId:"../../other"}})}catch(e){denied=e.code==="invalid-argument"}
assert(denied,"Invalid pagination cursor should be rejected");
ownerClaimActive=false;
await rejected(valid,"permission-denied");
ownerClaimActive=true;
console.log("PASS: V6.4 Owner analytics, QR health, payment review, evidence and permission isolation");
