// PACKTOOK V6.2.3: simulated Firestore transaction test for gated Owner mutations.
// All data is in-memory. No Firebase credentials, changes or payment calls.
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
const source=fs.readFileSync(new URL("../owner-functions/index.js",import.meta.url),"utf8");
const assert=(v,msg)=>{if(!v)throw Error("Owner management regression: "+msg)};
const accounts=new Map([
 ["paidWallet",{plan:"Starter",planExpiresAt:"2099-12-31T23:59:59Z",
  creditWalletV1:true,creditWalletRemaining:42,reserved:0,createdAt:Date.now()}],
 ["legacyFree",{plan:"Free",period:new Date().toISOString().slice(0,7),used:2,reserved:0,createdAt:Date.now()}],
 ["unconfiguredPaid",{plan:"Starter",creditWalletV1:true,creditWalletRemaining:9,reserved:0,createdAt:Date.now()}],
 ["reservedPaid",{plan:"Starter",planExpiresAt:"2099-12-31T23:59:59Z",
  creditWalletV1:true,creditWalletRemaining:10,reserved:2,createdAt:Date.now()}]
]);
const docs=new Map([...accounts.entries()].map(([id,data])=>["accounts/"+id,{...data}]));
let ownerManager=true;
const owners={
 owner:{uid:"owner",email:"owner@example.test",disabled:false,emailVerified:true,
  customClaims:{packtookPlatformOwner:true,get packtookOwnerManager(){return ownerManager}}},
 paidWallet:{uid:"paidWallet",email:"paid@example.test",disabled:false},
 legacyFree:{uid:"legacyFree",email:"free@example.test",disabled:false},
 unconfiguredPaid:{uid:"unconfiguredPaid",email:"unset@example.test",disabled:false},
 reservedPaid:{uid:"reservedPaid",email:"recording@example.test",disabled:false}
};
const auth=()=>({
 async getUser(id){if(!owners[id])throw Object.assign(Error("Not found"),{code:"auth/user-not-found"});return owners[id]},
 async getUsers(ids){return {users:ids.map(x=>owners[x.uid]).filter(Boolean)}}
});
function snapshot(path){return {exists:docs.has(path),data:()=>docs.get(path),id:path.split("/").at(-1)}}
const ref=path=>({
 path,id:path.split("/").at(-1),
 collection(name){return collection(path+"/"+name)},
 async get(){return snapshot(path)}
});
const collection=path=>({
 doc(id){return ref(path+"/"+id)},
 orderBy(){return this},limit(){return this},
 async get(){return {docs:[...docs.entries()].filter(([k])=>k.startsWith(path+"/")).map(([k,v])=>({...snapshot(k),data:()=>v})),size:0,empty:true}}
});
const db={
 collection,async runTransaction(fn){
  const writes=[],tx={
   async get(r){return snapshot(r.path)},
   update(r,patch){writes.push({kind:"update",path:r.path,patch})},
   create(r,data){if(docs.has(r.path))throw Error("duplicate document");writes.push({kind:"create",path:r.path,data})}
  };
  const result=await fn(tx);
  for(const w of writes){if(w.kind==="create")docs.set(w.path,{...w.data});
   else docs.set(w.path,{...docs.get(w.path),...w.patch});}
  return result;
 }
};
const firestore=Object.assign(()=>db,{FieldPath:{documentId:()=>"_id"},FieldValue:{serverTimestamp:()=>new Date().toISOString()}});
const admin={initializeApp(){},firestore,auth};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
function initialize(enabled){
 const exportsObj={};
 const fakeRequire=id=>{
  if(id==="firebase-admin")return admin;
  if(id==="firebase-functions/v2/https")return {onCall:(_opts,fn)=>fn,HttpsError};
  if(id==="node:crypto")return crypto;
  throw Error("Unexpected dependency "+id);
 };
 vm.runInNewContext(source,{
  exports:exportsObj,require:fakeRequire,process:{env:{PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
   GCLOUD_PROJECT:"packtook-prod-01",PACKTOOK_OWNER_MANAGEMENT_ENABLED:enabled?"true":"false"}},
  console,Date,Math,Number,Object,Array,String,Map,Set,RegExp,Promise
 },{filename:"owner-functions/index.js"});
 return exportsObj;
}
function req(data={},manager=true){return {auth:{uid:"owner",token:{
 email_verified:true,packtookPlatformOwner:true,packtookOwnerManager:manager}},data}}
async function rejects(promise,code){
 let err;try{await promise}catch(e){err=e}
 assert(err?.code===code,"Expected "+code+", got "+(err?.code||"success"));
}
const disabled=initialize(false);
const status=await disabled.ownerManagementStatus(req());
assert(status.enabled===false&&status.canManage===false,"Management must default disabled");
await rejects(disabled.ownerManageCustomer(req()),"failed-precondition");
const on=initialize(true);
assert((await on.ownerManagementStatus(req())).canManage===true,"Explicit manager rights should activate panel");
const grant={
 requestId:"123e4567-e89b-42d3-a456-426614174000",accountId:"paidWallet",
 confirmAccountId:"paidWallet",confirmEmail:"paid@example.test",action:"grant_credits",
 reason:"Test authorized complimentary credit top up",
 creditAmount:10,expectedPlan:"Starter",expectedExpiresAt:"2099-12-31T23:59:59.000Z",
 expectedCreditsRemaining:42,expectedReservedCredits:0
};
await rejects(on.ownerManageCustomer(req(grant,false)),"permission-denied");
ownerManager=false;
await rejects(on.ownerManageCustomer(req(grant)),"permission-denied");
ownerManager=true;
await rejects(on.ownerManageCustomer(req({...grant,confirmEmail:"wrong@example.test"})),"failed-precondition");
const first=await on.ownerManageCustomer(req(grant));
assert(first.ok&&!first.idempotent&&first.newBalance===52,"Grant must add ten credits once");
assert(docs.get("accounts/paidWallet").creditWalletRemaining===52,"Wallet must be updated");
const saved=docs.get("accounts/paidWallet/ownerChanges/"+grant.requestId);
assert(saved&&saved.beforeBalance===42&&saved.afterBalance===52&&saved.ownerId==="owner"&&saved.reason===grant.reason,"Audit log missing");
assert(docs.has("accounts/paidWallet/audit/owner_"+grant.requestId),"Customer audit entry not written");
const replay=await on.ownerManageCustomer(req(grant));
assert(replay.idempotent&&replay.newBalance===52&&docs.get("accounts/paidWallet").creditWalletRemaining===52,"Retry must not add credits again");
await rejects(on.ownerManageCustomer(req({...grant,creditAmount:11})),"already-exists");
await rejects(on.ownerManageCustomer(req({...grant,requestId:"123e4567-e89b-42d3-a456-426614174001"})),"failed-precondition");
const freeGrant={...grant,requestId:"123e4567-e89b-42d3-a456-426614174002",accountId:"legacyFree",confirmAccountId:"legacyFree",
 confirmEmail:"free@example.test",expectedPlan:"Free",expectedExpiresAt:null,expectedCreditsRemaining:18};
await rejects(on.ownerManageCustomer(req(freeGrant)),"failed-precondition");
assert(docs.get("accounts/legacyFree").creditWalletV1!==true,"Free monthly quota must not silently convert to Wallet");
const reservedGrant={...grant,requestId:"123e4567-e89b-42d3-a456-426614174003",accountId:"reservedPaid",confirmAccountId:"reservedPaid",
 confirmEmail:"recording@example.test",expectedCreditsRemaining:10,expectedReservedCredits:2};
await rejects(on.ownerManageCustomer(req(reservedGrant)),"failed-precondition");
const future=new Date(Date.now()+35*86400000).toISOString();
const change={
 requestId:"123e4567-e89b-42d3-a456-426614174004",accountId:"unconfiguredPaid",
 confirmAccountId:"unconfiguredPaid",confirmEmail:"unset@example.test",action:"set_expiry",
 reason:"Approve a temporary subscription extension for test",newExpiresAt:future,
 expectedPlan:"Starter",expectedExpiresAt:null,expectedCreditsRemaining:null,expectedReservedCredits:0
};
const changed=await on.ownerManageCustomer(req(change));
assert(changed.ok&&!changed.idempotent&&changed.newExpiresAt===future,"Paid expiry can be set on unconfigured account");
assert(docs.get("accounts/unconfiguredPaid").creditWalletRemaining===9,"Setting expiry must not alter wallet");
assert(!docs.has("accounts/unconfiguredPaid/billingRequests/"+change.requestId),"Manual expiry must not create billing");
await rejects(on.ownerManageCustomer(req({...change,requestId:"123e4567-e89b-42d3-a456-426614174005",newExpiresAt:new Date(Date.now()-86400000).toISOString()})),"invalid-argument");
const history=await on.ownerCustomerManagementHistory(req({accountId:"paidWallet"}));
assert(history.items.some(x=>x.action==="grant_credits"&&x.creditDelta===10),"Owner history must include the adjustment");
console.log("PASS: V6.2.3 owner access, credit idempotency, Free quota safety, expiry, and transaction audit");
