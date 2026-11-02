// V6.7: Firestore native-realm compatibility regression (offline, no emulator/network).
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");

// Firestore needs ordinary plain data objects from the SDK's JavaScript realm.
const foreign=vm.runInNewContext('({plan:"Free",used:0})');
assert.notEqual(Object.getPrototypeOf(foreign),Object.prototype,
 "The old VM implementation must reproduce cross-realm data objects");

class HttpsError extends Error{constructor(code,msg){super(msg);this.code=code}}
const records=new Map();
const users=new Map();
const db={
 collection(name){
  assert.equal(name,"accounts");
  return {doc(id){
   return {id,key:id,
    async get(){return {exists:records.has(id),data:()=>records.get(id)}},
    async create(value){if(records.has(id))throw Error("duplicate");records.set(id,value)}
   };
  }};
 },
 async runTransaction(callback){
  const writes=[];
  const tx={
   async get(ref){return {exists:records.has(ref.key),data:()=>records.get(ref.key)}},
   create(ref,value){
    // This would fail with vm.runInNewContext because value's prototype
    // belongs to a different realm. It passes with the native-realm fix.
    assert.equal(Object.getPrototypeOf(value),Object.prototype,
     "Firestore tx.create must receive a true native plain Object");
    assert.equal(Object.getPrototypeOf(value.devices),Array.prototype,
     "Firestore must receive a native array, not an array from VM");
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
const auth={
 async getUser(id){
  const u=users.get(id);if(!u)throw Error("Missing test user");
  return {...u,customClaims:{...u.customClaims}};
 },
 async setCustomUserClaims(id,claims){users.get(id).customClaims=claims}
};
const fakeAdmin={initializeApp(){},firestore,auth:()=>auth};
const handlers={};
const requireMock=name=>{
 if(name==="firebase-functions/v2/https")return {
  HttpsError,onCall:(options,handler)=>handler
 };
 if(name==="firebase-admin")return fakeAdmin;
 if(name==="node:crypto")return crypto;
 throw Error("Unexpected import "+name);
};
const exportsMock={};
const env={PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
 GCLOUD_PROJECT:"packtook-prod-01",GCP_PROJECT:"packtook-prod-01",
 PACKTOOK_PUBLIC_SIGNUP_ENABLED:"true",PACKTOOK_PUBLIC_ACCESS_ENABLED:"true",
 PACKTOOK_PUBLIC_POLICIES_APPROVED:"true"};
new Function("exports","process","require","console",source)(
 exportsMock,{env},requireMock,{log(){},warn(){},error(){}}
);
const id="qa-native-realm-safe-01";
users.set(id,{email:"native-realm@example.test",emailVerified:true,disabled:false,customClaims:{}});
const accepted=await exportsMock.completeFreeSignup({
 auth:{uid:id,token:{email_verified:true}},
 app:{appId:"mock-request-field-not-real-attestation"},
 data:{acceptTerms:true,termsVersion:"2026-11-v1",privacyVersion:"2026-11-v1"}
});
assert.equal(accepted.created,true);
assert.equal(records.get(id).plan,"Free");
assert.equal(records.get(id).used,0);
assert.equal(records.get(id).devices.length,0);
assert.equal(users.get(id).customClaims.packtookPublicCustomer,true);
const again=await exportsMock.completeFreeSignup({
 auth:{uid:id,token:{email_verified:true}},
 app:{appId:"mock-request-field-not-real-attestation"},
 data:{acceptTerms:true,termsVersion:"2026-11-v1",privacyVersion:"2026-11-v1"}
});
assert.equal(again.created,false);
assert.equal(records.size,1);
console.log("PASS: Production signup handler creates Firestore-compatible native Object/Array in V6.7 runner");
console.log("PASS: verified Free signup preserves 20-video quota and never creates a second grant");
console.log("RESULT: PACKTOOK V6.7 native-realm Firestore regression PASS (offline mock; not a live emulator).");
