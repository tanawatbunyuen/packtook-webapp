// PACKTOOK V6.7 — ACTUAL Firebase Auth + Firestore emulator integration.
// Uses production backend FUNCTION BODY with real Admin SDK transactions.
// Important: callable transport/App Check cryptographic attestation, email delivery,
// client browser, and live hosting are NOT emulated/certified by this test.
// NEVER run against real Firebase. Invoked only by scripts/run-v67-emulators.sh.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const DEMO="demo-packtook-v67";
const hostOK=v=>/^(?:127[.]0[.]0[.]1|localhost|\[::1\]):[0-9]{2,5}$/.test(v||"");
if(process.env.PACKTOOK_QA_DEMO_PROJECT!==DEMO||
   !hostOK(process.env.FIREBASE_AUTH_EMULATOR_HOST)||
   !hostOK(process.env.FIRESTORE_EMULATOR_HOST)||
   ["GCLOUD_PROJECT","GCP_PROJECT","GOOGLE_CLOUD_PROJECT","FIREBASE_PROJECT_ID"]
    .some(k=>process.env[k]==="packtook-prod-01")){
 throw Error("SAFETY BLOCK: requires demo-packtook-v67 and loopback Auth + Firestore emulator endpoints; NEVER live Firebase");
}
process.env.GCLOUD_PROJECT=DEMO;
process.env.GCP_PROJECT=DEMO;
process.env.GOOGLE_CLOUD_PROJECT=DEMO;

const requireBackend=createRequire(new URL("../functions/index.js",import.meta.url));
const admin=requireBackend("firebase-admin");
if(admin.apps.length)throw Error("Unexpected Firebase app in this test process");
admin.initializeApp({projectId:DEMO});
const auth=admin.auth(),db=admin.firestore();
if(admin.app().options.projectId!==DEMO)throw Error("Wrong Admin SDK project");

class HttpsError extends Error{
 constructor(code,message){super(message);this.name="HttpsError";this.code=code}
}
const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
assert(source.includes("exports.completeFreeSignup=onCall({...options,enforceAppCheck:true}"),
 "Backend must enforce App Check on real callable requests");
function handlers(flags){
 // The real Firebase Admin SDK is locked to DEMO. The VM presents the existing
 // Production guard as satisfied, without modifying or deploying production code.
 // Only onCall transport is stubbed; real Auth/Firestore emulator are used.
 function firestore(){return db}
 firestore.FieldValue=admin.firestore.FieldValue;
 const fakeAdmin={initializeApp(){},firestore,auth:()=>auth};
 const optionsByName=new Map();
 const api={
  onCall(options,handler){
   const label=handler.toString().includes("Public registration is not available")?"completeFreeSignup":"other";
   if(label==="completeFreeSignup")optionsByName.set(label,options);
   return handler;
  },HttpsError
 };
 const env={
  PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
  GCLOUD_PROJECT:"packtook-prod-01",GCP_PROJECT:"packtook-prod-01",
  PACKTOOK_PUBLIC_SIGNUP_ENABLED:flags.signup?"true":"false",
  PACKTOOK_PUBLIC_ACCESS_ENABLED:flags.access?"true":"false",
  PACKTOOK_PUBLIC_POLICIES_APPROVED:flags.policy?"true":"false"
 };
 const sandbox={exports:{},process:{env},require(module){
  if(module==="firebase-functions/v2/https")return api;
  if(module==="firebase-admin")return fakeAdmin;
  if(module==="node:crypto")return crypto;
  throw Error("Unexpected module in Backend: "+module);
 },console:{log(){},warn(){},error(){}}};
 // Compile approved production handler source in the main JavaScript realm.
 // vm.runInNewContext() made tx.create/tx.set records in a different realm;
 // Firestore rejects those objects as having custom prototypes.
 // This does NOT connect Production: require/process/Admin are replaced with
 // whitelisted stubs and Admin SDK itself is initialized for DEMO emulators.
 const compile=new Function("exports","process","require","console",source);
 compile(sandbox.exports,sandbox.process,sandbox.require,sandbox.console);
 return {fn:sandbox.exports,optionsByName};
}
const off=handlers({signup:false,access:false,policy:false}).fn;
const on=handlers({signup:true,access:true,policy:true});
const policy="2026-11-v1",uid="qa-v67-"+crypto.randomUUID().replaceAll("-","").slice(0,25);
const email=uid+"@example.test";
const device="qa-primary-device-0001",secondDevice="qa-other-device-0002";
const op="qa-v67-op-"+crypto.randomUUID().replaceAll("-","");
const barcode="PACKTOOK-QA-"+crypto.randomUUID().slice(0,18);
const ref=db.collection("accounts").doc(uid);
const data={acceptTerms:true,termsVersion:policy,privacyVersion:policy};
const request=(payload={},app={appId:"emulated-attestation-NOT-verified"})=>({
 data:payload,app,auth:{uid,token:{email_verified:true,packtookPublicCustomer:true}}
});
const rejected=async(fn,code)=>assert.rejects(fn,e=>e?.code===code);
let created=false;
let currentStage="startup";
try{
 assert.equal((await off.publicSignupStatus()).enabled,false);
 assert.equal((await on.fn.publicSignupStatus()).enabled,true);
 assert.equal(on.optionsByName.get("completeFreeSignup")?.enforceAppCheck,true);
 currentStage="create Auth demo user";
 await auth.createUser({uid,email,emailVerified:false,disabled:false});created=true;
 await rejected(()=>off.completeFreeSignup(request(data)),"failed-precondition");
 assert.equal((await ref.get()).exists,false);
 console.log("PASS: disabled rollout creates no account in REAL Firestore emulator");

 await rejected(()=>on.fn.completeFreeSignup(request(data,null)),"permission-denied");
 await rejected(()=>on.fn.completeFreeSignup(request(data)),"permission-denied");
 await rejected(()=>on.fn.completeFreeSignup(request({
  acceptTerms:false,termsVersion:policy,privacyVersion:policy
 })),"invalid-argument");
 assert.equal((await ref.get()).exists,false);
 console.log("PASS: App Check presence, verified email and consent preconditions are enforced");

 currentStage="verify demo user and grant Free via Firestore transaction";
 await auth.updateUser(uid,{emailVerified:true});
 const first=await on.fn.completeFreeSignup(request(data));
 assert.equal(first.created,true);
 const snapshot=await ref.get();
 assert.equal(snapshot.exists,true);
 assert.equal(snapshot.data().registrationSource,"self_service_v65");
 assert.equal(snapshot.data().plan,"Free");
 assert.equal(snapshot.data().used,0);
 assert.equal(snapshot.data().reserved,0);
 assert.equal(snapshot.data().devices.length,0);
 assert.equal((await auth.getUser(uid)).customClaims.packtookPublicCustomer,true);
 assert.equal((await on.fn.usageStatus(request())).remaining,20);
 console.log("PASS: actual Auth emulator claim + Firestore transaction provisions exactly 20 Free videos");

 currentStage="register and enforce one device";
 const deviceResult=await on.fn.registerDevice(request({deviceId:device,name:"QA workbench"}));
 assert.equal(deviceResult.registered,true);
 assert.equal(deviceResult.limit,1);
 await rejected(()=>on.fn.registerDevice(request({deviceId:secondDevice,name:"2nd device"})),"resource-exhausted");
 console.log("PASS: actual Firestore device registration allows 1 and blocks second device");

 currentStage="reserve recording credit";
 const reserve=await on.fn.reserveCredit(request({deviceId:device,operationId:op,barcode}));
 assert.equal(reserve.status,"reserved");
 assert.equal(reserve.remaining,19);
 const beforeStop=await on.fn.usageStatus(request());
 assert.equal(beforeStop.remaining,19);assert.equal(beforeStop.reserved,1);
 currentStage="finalize credit";
 const finalize=await on.fn.finalizeCredit(request({
  operationId:op,success:true,bytes:14000,filename:"qa-emulator.webm"
 }));
 assert.equal(finalize.status,"completed");
 const afterStop=await on.fn.usageStatus(request());
 assert.equal(afterStop.remaining,19);assert.equal(afterStop.used,1);assert.equal(afterStop.reserved,0);
 const again=await on.fn.finalizeCredit(request({
  operationId:op,success:true,bytes:14000,filename:"qa-emulator.webm"
 }));
 assert.equal(again.idempotent,true);
 assert.equal((await on.fn.usageStatus(request())).remaining,19);
 console.log("PASS: real Firestore reserve → finalize → 19 credits; duplicate finalize never charges twice");

 currentStage="idempotent repeated signup";
 const repeat=await on.fn.completeFreeSignup(request(data));
 assert.equal(repeat.created,false);
 assert.equal((await on.fn.usageStatus(request())).remaining,19);
 const record=(await ref.get()).data();
 assert.equal(record.used,1);
 console.log("PASS: reactivation/relogin cannot grant more credits or overwrite used count");

 await auth.updateUser(uid,{disabled:true});
 await rejected(()=>on.fn.completeFreeSignup(request(data)),"permission-denied");
 console.log("PASS: disabled Auth account cannot reactivate Free");
 console.log("RESULT: V6.7 REAL Auth/Firestore EMULATOR INTEGRATION PASS (not App Check attestation, browser or live Firebase)");
}catch(error){
 console.error("V6.7 EMULATOR INTEGRATION FAILED at stage: "+currentStage);
 console.error(error?.stack||error);
 throw error;
}finally{
 // The demo namespace cannot reach live resources; cleanup is still useful.
 try{await db.recursiveDelete(ref)}catch(e){console.warn("Emulator Firestore cleanup:",e.message)}
 if(created)try{await auth.deleteUser(uid)}catch(e){console.warn("Emulator Auth cleanup:",e.message)}
 await admin.app().delete();
}
