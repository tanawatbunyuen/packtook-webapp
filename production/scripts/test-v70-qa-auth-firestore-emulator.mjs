// PACKTOOK V7.0 — REAL Firebase Auth + Firestore demo integration.
// Production backend source, only callable HTTP/App Check attestation is stubbed.
// DEMO ONLY. No live Auth users, Firestore data, email, browser or deployment.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {createRequire} from "node:module";

const DEMO="demo-packtook-v70";
const validHost=v=>/^(?:127[.]0[.]0[.]1|localhost):[0-9]{2,5}$/.test(v||"");
if(process.env.PACKTOOK_QA_DEMO_PROJECT!==DEMO||
 !validHost(process.env.FIREBASE_AUTH_EMULATOR_HOST)||
 !validHost(process.env.FIRESTORE_EMULATOR_HOST)||
 ["GCLOUD_PROJECT","GCP_PROJECT","GOOGLE_CLOUD_PROJECT","FIREBASE_PROJECT_ID"]
  .some(k=>process.env[k]==="packtook-prod-01"))
 throw Error("SAFETY BLOCK: V7 demo requires demo-packtook-v70 and loopback Auth + Firestore emulators");
process.env.GCLOUD_PROJECT=DEMO;
process.env.GCP_PROJECT=DEMO;
process.env.GOOGLE_CLOUD_PROJECT=DEMO;
const backendRequire=createRequire(new URL("../functions/index.js",import.meta.url));
const admin=backendRequire("firebase-admin");
if(admin.apps.length)throw Error("Unexpected initialized Firebase Admin app");
admin.initializeApp({projectId:DEMO});
const auth=admin.auth(),db=admin.firestore();
if(admin.app().options.projectId!==DEMO)throw Error("SAFETY BLOCK: actual SDK project must be demo");
class HttpsError extends Error{
 constructor(code,message){super(message);this.code=code}
}
const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const uid="qa-v70-"+crypto.randomUUID().replaceAll("-","").slice(0,24);
const email=uid+"@example.test";
const appId="1:123456789:web:controlledqa00001";
const device1="qa-v70-primary-device01",device2="qa-v70-second-device02";
const op="qa-v70-operation-"+crypto.randomUUID().replaceAll("-","");
const barcode="QA-V7-"+crypto.randomUUID();
const policy="2026-11-v1";
const ref=db.collection("accounts").doc(uid);
const consent={acceptTestTerms:true,policyVersion:policy};

function harness({enabled=true,allowedUid=uid,qaAppId=appId,expiry=Date.now()+60*60*1000,
  publicFlags=false}={}){
 const callOpts=new Map();
 const onCall=(options,handler)=>{
  const text=handler.toString();
  if(text.includes("Controlled QA invitation is not active")){
   callOpts.set(text.includes("acceptTestTerms")?"activate":"status",options);
  }
  return handler;
 };
 function firestore(){return db}
 firestore.FieldValue=admin.firestore.FieldValue;
 const fakeAdmin={initializeApp(){},firestore,auth:()=>auth};
 const env={
  PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
  GCLOUD_PROJECT:"packtook-prod-01",GCP_PROJECT:"packtook-prod-01",
  PACKTOOK_PUBLIC_SIGNUP_ENABLED:publicFlags?"true":"false",
  PACKTOOK_PUBLIC_ACCESS_ENABLED:"false",
  PACKTOOK_PUBLIC_POLICIES_APPROVED:"false",
  PACKTOOK_V7_QA_ENABLED:enabled?"true":"false",
  PACKTOOK_V7_QA_UID:allowedUid,
  PACKTOOK_V7_QA_APP_ID:qaAppId,
  PACKTOOK_V7_QA_EXPIRES_AT:new Date(expiry).toISOString()
 };
 const fakeRequire=id=>{
  if(id==="firebase-functions/v2/https")return {onCall,HttpsError};
  if(id==="firebase-admin")return fakeAdmin;
  if(id==="node:crypto")return crypto;
  throw Error("Unexpected Backend import: "+id);
 };
 const exports={};
 new Function("exports","process","require","console",source)(
  exports,{env},fakeRequire,{log(){},warn(){},error(){}});
 return {fn:exports,callOpts};
}
const request=(payload={},overrides={})=>({
 data:payload,
 auth:{uid:overrides.uid||uid,token:{
  email_verified:overrides.tokenVerified??true,
  packtookControlledQa:overrides.claim??false}},
 app:overrides.appNull?null:{appId:overrides.appId||appId}
});
const reject=async(promise,code)=>assert.rejects(promise,e=>e?.code===code);
let created=false,stage="startup";
try{
 const off=harness({enabled:false}).fn;
 const on=harness();
 const f=on.fn;
 assert.equal(on.callOpts.get("status")?.enforceAppCheck,true);
 assert.equal(on.callOpts.get("activate")?.enforceAppCheck,true);
 assert.equal((await f.publicSignupStatus()).enabled,false);
 assert.equal((await f.publicSignupStatus()).accessEnabled,false);
 await auth.createUser({uid,email,emailVerified:false,disabled:false});created=true;
 stage="QA default OFF, allowlist and App Check boundary";
 await reject(()=>off.qaFreeStatus(request()),"permission-denied");
 await reject(()=>off.completeQaFreeSignup(request(consent)),"permission-denied");
 await reject(()=>off.usageStatus(request({}, {claim:true})),"permission-denied");
 await reject(()=>f.qaFreeStatus(request({}, {appId:"1:999:web:wrongapp000000"})),"permission-denied");
 await reject(()=>f.qaFreeStatus(request({}, {uid:"unlisted-qa-user-123456"})),"permission-denied");
 await reject(()=>f.qaFreeStatus(request({}, {appNull:true})),"permission-denied");
 await reject(()=>harness({expiry:Date.now()-1000}).fn.qaFreeStatus(request()),"permission-denied");
 await reject(()=>harness({expiry:Date.now()+72*60*60*1000}).fn.qaFreeStatus(request()),"permission-denied");
 await reject(()=>harness({publicFlags:true}).fn.qaFreeStatus(request()),"permission-denied");
 console.log("PASS: QA disabled, wrong UID/App Check, expired/too-long lease and Public flag ON all blocked");

 stage="Auth email verification and consent";
 const unverified=await f.qaFreeStatus(request());
 assert.equal(unverified.verified,false);
 await reject(()=>f.completeQaFreeSignup(request(consent)),"permission-denied");
 assert.equal((await ref.get()).exists,false);
 await auth.updateUser(uid,{emailVerified:true});
 assert.equal((await f.qaFreeStatus(request())).verified,true);
 await reject(()=>f.completeQaFreeSignup(request({acceptTestTerms:false,policyVersion:policy})),"invalid-argument");
 await reject(()=>f.completeQaFreeSignup(request({acceptTestTerms:true,policyVersion:"wrong"})),"invalid-argument");
 assert.equal((await ref.get()).exists,false);
 console.log("PASS: real Auth emulator unverified email and missing/wrong consent cannot claim 20 credits");

 stage="Once-only QA account transaction";
 const grant=await f.completeQaFreeSignup(request(consent));
 assert.equal(grant.activated,true);assert.equal(grant.created,true);
 assert.equal(grant.freeVideosPerMonth,20);assert.equal(grant.freeDevices,1);
 const a=(await ref.get()).data();
 assert.equal(a.registrationSource,"controlled_qa_v70");
 assert.equal(a.ownerUid,uid);assert.equal(a.plan,"Free");
 assert.equal(a.used,0);assert.equal(a.reserved,0);assert.equal(a.devices.length,0);
 assert.equal(a.acceptedTestOnly,true);
 assert.equal((await auth.getUser(uid)).customClaims.packtookControlledQa,true);
 const qaRequest=(payload={})=>request(payload,{claim:true});
 assert.equal((await f.usageStatus(qaRequest())).remaining,20);
 console.log("PASS: real Auth claim + Firestore transaction grants Free 20/month exactly once");

 stage="One device and recording lifecycle";
 assert.equal((await f.registerDevice(qaRequest({deviceId:device1,name:"QA device"}))).limit,1);
 await reject(()=>f.registerDevice(qaRequest({deviceId:device2,name:"2nd device"})),"resource-exhausted");
 const reserved=await f.reserveCredit(qaRequest({deviceId:device1,barcode,operationId:op}));
 assert.equal(reserved.remaining,19);
 assert.equal((await f.usageStatus(qaRequest())).reserved,1);
 const finish=await f.finalizeCredit(qaRequest({
  operationId:op,success:true,bytes:12000,filename:"qa-test.webm"
 }));
 assert.equal(finish.status,"completed");
 const usage=await f.usageStatus(qaRequest());
 assert.equal(usage.remaining,19);assert.equal(usage.used,1);assert.equal(usage.reserved,0);
 const retry=await f.finalizeCredit(qaRequest({
  operationId:op,success:true,bytes:12000,filename:"qa-test.webm"
 }));
 assert.equal(retry.idempotent,true);
 assert.equal((await f.usageStatus(qaRequest())).remaining,19);
 console.log("PASS: 1 device, reserve → finalize 20→19, duplicate finalize consumes no extra credit");

 stage="Idempotency and QA shutdown";
 const another=await f.completeQaFreeSignup(request(consent));
 assert.equal(another.created,false);
 assert.equal((await f.usageStatus(qaRequest())).remaining,19);
 assert.equal((await (await ref.get()).data()).used,1);
 await reject(()=>off.usageStatus(qaRequest()),"permission-denied");
 await reject(()=>off.completeQaFreeSignup(request(consent)),"permission-denied");
 console.log("PASS: repeat activation preserves usage; disabling QA revokes access even with existing claim");
 console.log("RESULT: V7.0 REAL DEMO Auth/Firestore Controlled Free Signup QA INTEGRATION PASS");
}catch(error){
 console.error("V7.0 EMULATOR QA FAILED at stage: "+stage);
 console.error(error?.stack||error);
 throw error;
}finally{
 try{await db.recursiveDelete(ref)}catch(e){console.warn("Demo cleanup Firestore:",e.message)}
 if(created)try{await auth.deleteUser(uid)}catch(e){console.warn("Demo cleanup Auth:",e.message)}
 await admin.app().delete();
}
