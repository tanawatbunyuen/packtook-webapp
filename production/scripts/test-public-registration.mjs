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
 const records=new Map(),users=new Map(),callOptions={};
 const db={
  collection(name){
   assert.equal(name,"accounts");
   return {doc(id){return {id,key:id,
    async get(){return {exists:records.has(id),data:()=>records.get(id)}},
    async create(value){if(records.has(id)){const e=new Error("Already exists");e.code=6;throw e}
     records.set(id,value)}
   }}};
  },
  async runTransaction(callback){
   const writes=[];
   const tx={
    async get(ref){return {exists:records.has(ref.key),
     data:()=>records.get(ref.key)}},
    create(ref,value){
     if(records.has(ref.key))throw Error("Already exists");
     writes.push([ref.key,value]);
    }
   };
   const result=await callback(tx);
   for(const [key,value] of writes)records.set(key,value);
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
 return {fn:sandbox.exports,records,users,callOptions};
};
const env=(more={})=>({
 PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
 PACKTOOK_PUBLIC_SIGNUP_ENABLED:"true",
 PACKTOOK_PUBLIC_ACCESS_ENABLED:"true",
 PACKTOOK_PUBLIC_POLICIES_APPROVED:"true",
 ...more
});
const policy="2026-11-v1";
const validData={acceptTerms:true,termsVersion:policy,privacyVersion:policy};
const input=(id,data=validData,options={})=>({
 auth:{uid:id,token:{email_verified:true,...options.claims}},
 app:{appId:"approved-app-check-token"},
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

const c=context(env());
assert.equal(c.callOptions.signup.enforceAppCheck,true);
assert.equal((await c.fn.publicSignupStatus()).enabled,true);
assert.equal((await c.fn.publicSignupStatus()).freeVideosPerMonth,20);
c.users.set("alice",{email:"alice@example.test",emailVerified:true,disabled:false,
 customClaims:{someOtherClaim:"preserved"}});
await rejected(()=>c.fn.completeFreeSignup({...input("alice"),app:null}),"permission-denied");
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
 token:{email_verified:true,packtookPublicCustomer:true}}});
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
 token:{email_verified:true,packtookPublicCustomer:true}}}),"failed-precondition");
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

const badProject=context(env({PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-staging"}));
assert.equal((await badProject.fn.publicSignupStatus()).enabled,false);
badProject.users.set("bob",{email:"bob@example.test",emailVerified:true,disabled:false,customClaims:{}});
await rejected(()=>badProject.fn.completeFreeSignup(input("bob")),"failed-precondition");
console.log("PASS: wrong Firebase project fails closed");

console.log("RESULT: PACKTOOK V6.5 public signup and idempotent Free onboarding mock tests PASS.");
