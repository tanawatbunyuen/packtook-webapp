// PACKTOOK V6.5 — isolated signup/Free provisioning tests using the real
// Production Functions source. No Firebase SDK, network, credentials, or writes.
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
class HttpsError extends Error{
 constructor(code,message){super(message);this.code=code}
}
const context=(env)=>{
 const records=new Map(),guards=new Map(),users=new Map(),callOptions={};
 const store=ref=>ref.collection==="accounts"?records:guards;
 const db={
  collection(name){
   assert(["accounts","publicSignupGuards"].includes(name),"Unexpected collection "+name);
   return {doc(id){
    const ref={id,key:id,collection:name};
    return {...ref,
     async get(){const data=store(ref);return {exists:data.has(id),data:()=>data.get(id)}},
     async create(value){const data=store(ref);if(data.has(id)){const e=new Error("Already exists");e.code=6;throw e}
      data.set(id,value)}
    };
   }};
  },
  async runTransaction(callback){
   const writes=[];
   const tx={
    async get(ref){const data=store(ref);return {exists:data.has(ref.key),
     data:()=>data.get(ref.key)}},
    create(ref,value){
     if(store(ref).has(ref.key))throw Error("Already exists");
     writes.push(()=>store(ref).set(ref.key,value));
    },
    update(ref,patch){
     if(!store(ref).has(ref.key))throw Error("Document missing");
     writes.push(()=>store(ref).set(ref.key,{...store(ref).get(ref.key),...patch}));
    }
   };
   const result=await callback(tx);
   for(const write of writes)write();
   return result;
  }
 };
 function firestore(){return db}
 firestore.FieldValue={serverTimestamp:()=>({serverTime:true})};
 const authService={
  async getUser(id){const u=users.get(id);
   if(!u)throw Error("auth/user-not-found");return {...u,customClaims:{...u.customClaims}};
  },
  async setCustomUserClaims(id,claims){
   const u=users.get(id);
   if(u.failClaimOnce){u.failClaimOnce=false;throw Error("Simulated Auth claim failure")}
   u.customClaims={...claims};
  }
 };
 const admin={initializeApp(){},firestore,auth:()=>authService};
 const sandbox={
  exports:{},process:{env},
  require(name){
   if(name==="firebase-admin")return admin;
   if(name==="node:crypto")return crypto;
   if(name==="firebase-functions/v2/https")return {
    HttpsError,onCall(options,handler){
     const name=handler.toString().includes("Public registration is not available")?"completeFreeSignup":"other";
     if(name==="completeFreeSignup")callOptions.signup=options;
     return handler;
    }
   };
   throw Error("Unexpected module: "+name);
  },
  console:{log(){},warn(){},error(){}}
 };
 vm.runInNewContext(source,sandbox,{timeout:3000,filename:"functions/index.js"});
 return {fn:sandbox.exports,records,guards,users,callOptions};
};
const env=(more={})=>({
 PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
 PACKTOOK_PUBLIC_SIGNUP_ENABLED:"true",
 PACKTOOK_PUBLIC_ACCESS_ENABLED:"true",
 PACKTOOK_PUBLIC_POLICIES_APPROVED:"true",
 PACKTOOK_PUBLIC_CUSTOMER_APP_ID:"1:123456789:web:approvedCustomerApp",
 PACKTOOK_PUBLIC_FREE_NEW_DAY_CAP:"2",
 PACKTOOK_PUBLIC_FREE_NEW_15M_CAP:"2",
 PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX:"a".repeat(64),
 ...more
});
const policy="2026-11-v1";
const validData={acceptTerms:true,termsVersion:policy,privacyVersion:policy};
const input=(id,data=validData,options={})=>({
 auth:{uid:id,token:{email_verified:true,...options.claims}},
 app:{appId:"1:123456789:web:approvedCustomerApp"},
 data
});
const rejected=async(call,code)=>{
 await assert.rejects(call,error=>error instanceof Error&&error.code===code);
};

const off=context(env({PACKTOOK_PUBLIC_SIGNUP_ENABLED:"false"}));
assert.equal((await off.fn.publicSignupStatus()).enabled,false);
off.users.set("off",{email:"off@example.test",emailVerified:true,disabled:false,customClaims:{}});
await rejected(()=>off.fn.completeFreeSignup(input("off")),"failed-precondition");
assert.equal(off.records.size,0);
console.log("PASS: public signup disabled by default; no account or credits created");

const noLegal=context(env({PACKTOOK_PUBLIC_POLICIES_APPROVED:"false"}));
assert.equal((await noLegal.fn.publicSignupStatus()).enabled,false);
console.log("PASS: policy approval flag required");

const noCustomerApp=context(env({PACKTOOK_PUBLIC_CUSTOMER_APP_ID:""}));
assert.equal((await noCustomerApp.fn.publicSignupStatus()).enabled,false);
noCustomerApp.users.set("noAppKey",{email:"noapp@example.test",emailVerified:true,disabled:false,customClaims:{}});
await rejected(()=>noCustomerApp.fn.completeFreeSignup(input("noAppKey")),"failed-precondition");
const noAbuseKey=context(env({PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX:""}));
assert.equal((await noAbuseKey.fn.publicSignupStatus()).enabled,false);
const noDailyCap=context(env({PACKTOOK_PUBLIC_FREE_NEW_DAY_CAP:"0"}));
assert.equal((await noDailyCap.fn.publicSignupStatus()).enabled,false);
const noShortCap=context(env({PACKTOOK_PUBLIC_FREE_NEW_15M_CAP:"0"}));
assert.equal((await noShortCap.fn.publicSignupStatus()).enabled,false);
console.log("PASS: missing HMAC secret or admission cap blocks Public Free before credits");
const c=context(env());
assert.equal(c.callOptions.signup.enforceAppCheck,true);
assert.equal((await c.fn.publicSignupStatus()).enabled,true);
assert.equal((await c.fn.publicSignupStatus()).freeVideosPerMonth,20);
c.users.set("alice",{email:"alice@example.test",emailVerified:true,disabled:false,
 customClaims:{someOtherClaim:"preserved"}});
await rejected(()=>c.fn.completeFreeSignup({...input("alice"),app:null}),"permission-denied");
await rejected(()=>c.fn.completeFreeSignup({...input("alice"),app:{appId:"1:999:web:anotherApp"}}),"permission-denied");
await rejected(()=>c.fn.completeFreeSignup(input("alice",{
 acceptTerms:false,termsVersion:policy,privacyVersion:policy
})),"invalid-argument");
await rejected(()=>c.fn.completeFreeSignup(input("alice",{
 acceptTerms:true,termsVersion:"wrong",privacyVersion:policy
})),"invalid-argument");
assert.equal(c.records.size,0);
const first=await c.fn.completeFreeSignup(input("alice"));
assert.equal(first.activated,true);assert.equal(first.created,true);
assert.equal(first.plan,"Free");
const a=c.records.get("alice");
assert.equal(a.plan,"Free");assert.equal(a.used,0);assert.equal(a.reserved,0);
assert.equal(a.period,new Date().toISOString().slice(0,7));
assert.equal(a.registrationSource,"self_service_v65");
assert.equal(a.creditWalletV1,false);
assert.equal(a.devices.length,0);
assert.equal(a.acceptedTermsVersion,policy);
assert.equal(a.acceptedPrivacyVersion,policy);
assert.equal(c.users.get("alice").customClaims.someOtherClaim,"preserved");
assert.equal(c.users.get("alice").customClaims.packtookPublicCustomer,true);
const usage=await c.fn.usageStatus({auth:{uid:"alice",
 token:{email_verified:true,packtookPublicCustomer:true}},app:{appId:"1:123456789:web:approvedCustomerApp"}});
assert.equal(usage.remaining,20);
console.log("PASS: verified customer + consent + App Check creates 20/month, one-device Free account");

a.used=6;
const second=await c.fn.completeFreeSignup(input("alice"));
assert.equal(second.created,false);assert.equal(c.records.get("alice").used,6);
a.plan="Basic";a.creditWalletV1=true;a.creditWalletRemaining=245;
const third=await c.fn.completeFreeSignup(input("alice"));
assert.equal(third.created,false);
assert.equal(c.records.get("alice").plan,"Basic");
assert.equal(c.records.get("alice").creditWalletRemaining,245);
console.log("PASS: repeated activation cannot reset credits, used count, or a paid plan");
// Existing public claim must not recreate a deleted account or grant a second Free.
c.records.delete("alice");
await rejected(()=>c.fn.completeFreeSignup(input("alice")),"failed-precondition");
await rejected(()=>c.fn.usageStatus({auth:{uid:"alice",
 token:{email_verified:true,packtookPublicCustomer:true}},app:{appId:"1:123456789:web:approvedCustomerApp"}}),"failed-precondition");
console.log("PASS: public account deletion cannot be exploited to replenish Free quota");

c.users.set("noEmail",{email:"no@example.test",emailVerified:false,disabled:false,customClaims:{}});
await rejected(()=>c.fn.completeFreeSignup(input("noEmail")),"permission-denied");
c.users.set("disabled",{email:"disabled@example.test",emailVerified:true,disabled:true,customClaims:{}});
await rejected(()=>c.fn.completeFreeSignup(input("disabled")),"permission-denied");
c.users.set("beta",{email:"beta@example.test",emailVerified:true,disabled:false,
 customClaims:{packtookProductionBeta:true}});
await rejected(()=>c.fn.completeFreeSignup(input("beta")),"already-exists");
const betaQuota=await c.fn.usageStatus({auth:{uid:"beta",
 token:{email_verified:true,packtookProductionBeta:true}}});
assert.equal(betaQuota.remaining,20,"Legacy Beta first-use provisioning must still work");
c.users.set("legacy",{email:"legacy@example.test",emailVerified:true,disabled:false,customClaims:{}});
c.records.set("legacy",{plan:"Starter",used:1});
await rejected(()=>c.fn.completeFreeSignup(input("legacy")),"already-exists");
console.log("PASS: verified-email, disabled-user, Beta and existing-account protections");

c.users.set("recovery",{email:"recovery@example.test",emailVerified:true,disabled:false,
 customClaims:{},failClaimOnce:true});
await assert.rejects(()=>c.fn.completeFreeSignup(input("recovery")),/Simulated Auth/);
assert.equal(c.records.get("recovery").plan,"Free");
const recovered=await c.fn.completeFreeSignup(input("recovery"));
assert.equal(recovered.created,false);
assert.equal(c.users.get("recovery").customClaims.packtookPublicCustomer,true);
console.log("PASS: Auth claim failure can retry without creating a second Free grant");
assert.equal(c.guards.size,4,"2 distinct email locks + day + window counters");
const daily=[...c.guards.entries()].find(([key])=>key.startsWith("day_"));
const short=[...c.guards.entries()].find(([key])=>key.startsWith("window15_"));
assert.equal(daily?.[1].count,2);
assert.equal(short?.[1].count,2);
c.users.set("sameEmailNewUid",{email:"alice@example.test",emailVerified:true,disabled:false,customClaims:{}});
await rejected(()=>c.fn.completeFreeSignup(input("sameEmailNewUid")),"already-exists");
c.users.set("dailyCapHit",{email:"newthird@example.test",emailVerified:true,disabled:false,customClaims:{}});
await rejected(()=>c.fn.completeFreeSignup(input("dailyCapHit")),"resource-exhausted");
assert.equal(c.guards.size,4);
assert.equal(c.records.has("dailyCapHit"),false);
console.log("PASS: email HMAC prevents regrant to different UID; atomic short/daily caps reject new Free");

const badProject=context(env({PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-staging"}));
assert.equal((await badProject.fn.publicSignupStatus()).enabled,false);
badProject.users.set("bob",{email:"bob@example.test",emailVerified:true,disabled:false,customClaims:{}});
await rejected(()=>badProject.fn.completeFreeSignup(input("bob")),"failed-precondition");
console.log("PASS: wrong Firebase project fails closed");

console.log("RESULT: PACKTOOK V6.5 public signup and idempotent Free onboarding mock tests PASS.");
