// PACKTOOK V7.1 — REAL DEMO Auth + Firestore public Free lifecycle test.
// Public flags ON only in isolated in-memory FUNCTION HARNESS, NEVER in Firebase.
// Requires the exact demo project and loopback Auth/Firestore emulator endpoints.
// Tests real Firebase Auth user lifecycle and Firestore transactions with source
// handlers from functions/index.js; transport-level App Check is STUBBED here.
// NO Production services, cloud accounts, billing, deployed flags or emails.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {createRequire} from "node:module";
import {assertV70DemoEnvironment} from "./v70-emulator-guard.mjs";

const DEMO="demo-packtook-v70";
assertV70DemoEnvironment(process.env);
process.env.GCLOUD_PROJECT=DEMO;
process.env.GCP_PROJECT=DEMO;
process.env.GOOGLE_CLOUD_PROJECT=DEMO;
const backendRequire=createRequire(new URL("../functions/index.js",import.meta.url));
const admin=backendRequire("firebase-admin");
if(admin.apps.length)throw Error("SAFETY BLOCK: unexpected initialized Firebase Admin instance");
admin.initializeApp({projectId:DEMO});
const auth=admin.auth(),db=admin.firestore();
if(admin.app().options.projectId!==DEMO)throw Error("SAFETY BLOCK: actual SDK project must remain DEMO");
const src=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");

class HttpsError extends Error{
 constructor(code,message){super(message);this.code=code}
}
function harness({signup=false,access=false,approved=false,dayCap="2",shortCap="2",hmacKey="b".repeat(64)}={}){
 const opts=new Map();
 const onCall=(options,handler)=>{
  if(handler.toString().includes("Public registration is not available"))
   opts.set("completeFreeSignup",options);
  return handler;
 };
 function firestore(){return db}
 firestore.FieldValue=admin.firestore.FieldValue;
 const fakeAdmin={initializeApp(){},firestore,auth:()=>auth};
 // Simulating flags inside the function VM ONLY. Actual Firebase env remains
 // demo-only. Production-like project ID is an isolated source test fixture.
 const env={
  PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
  GCLOUD_PROJECT:"packtook-prod-01",GCP_PROJECT:"packtook-prod-01",
  PACKTOOK_PUBLIC_SIGNUP_ENABLED:String(signup),
  PACKTOOK_PUBLIC_ACCESS_ENABLED:String(access),
  PACKTOOK_PUBLIC_POLICIES_APPROVED:String(approved),
  PACKTOOK_PUBLIC_CUSTOMER_APP_ID:"1:123456789:web:demoappcheckv71",
  PACKTOOK_PUBLIC_FREE_NEW_DAY_CAP:dayCap,
  PACKTOOK_PUBLIC_FREE_NEW_15M_CAP:shortCap,
  PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX:hmacKey,
  PACKTOOK_V7_QA_ENABLED:"false"
 };
 const requireFake=id=>{
  if(id==="firebase-functions/v2/https")return {onCall,HttpsError};
  if(id==="firebase-admin")return fakeAdmin;
  if(id==="node:crypto")return crypto;
  throw Error("Unexpected source import: "+id);
 };
 const exports={};
 new Function("exports","process","require","console",src)(
  exports,{env},requireFake,{log(){},warn(){},error(){}});
 return {fn:exports,opts};
}
const tag=crypto.randomUUID().replaceAll("-","").slice(0,20);
const userA="v71-a-"+tag,userB="v71-b-"+tag,userBeta="v71-beta-"+tag,
 userCap="v71-cap-"+tag,userReuse="v71-reuse-"+tag;
const users=[userA,userB,userBeta,userCap,userReuse];
const policy="2026-11-v1";
const consent={acceptTerms:true,termsVersion:policy,privacyVersion:policy};
const deviceA="v71-device-a-"+tag,deviceA2="v71-device-c-"+tag;
const deviceB="v71-device-b-"+tag;
const opA="v71-recording-a-"+tag,opB="v71-recording-b-"+tag;
const barcode="V71-TEST-"+tag;
const ref=id=>db.collection("accounts").doc(id);
const call=(uid,data={},extra={})=>({
 auth:{uid,token:{email_verified:extra.tokenVerified??true,
  packtookPublicCustomer:extra.publicClaim??false,
  packtookProductionBeta:extra.betaClaim??false}},
 app:extra.noApp?null:{appId:"1:123456789:web:demoappcheckv71"},
 data
});
const deny=async(run,code)=>assert.rejects(run,error=>error?.code===code);
const off=harness(),oneFlag=harness({signup:true}),twoFlags=harness({signup:true,access:true});
const f=harness({signup:true,access:true,approved:true});
let stage="init";
const intentionallyDeletedAuthUsers=new Set();
try{
 stage="isolated disabled public gates";
 assert.equal((await off.fn.publicSignupStatus()).enabled,false);
 assert.equal((await oneFlag.fn.publicSignupStatus()).enabled,false);
 assert.equal((await twoFlags.fn.publicSignupStatus()).enabled,false);
 assert.equal(f.opts.get("completeFreeSignup")?.enforceAppCheck,true);
 assert.equal((await harness({signup:true,access:true,approved:true,dayCap:"0"}).fn.publicSignupStatus()).enabled,false);
 assert.equal((await harness({signup:true,access:true,approved:true,hmacKey:""}).fn.publicSignupStatus()).enabled,false);
 await auth.createUser({uid:userA,email:userA+"@example.test",emailVerified:false});
 await auth.createUser({uid:userB,email:userB+"@example.test",emailVerified:true});
 await auth.createUser({uid:userBeta,email:userBeta+"@example.test",emailVerified:true});
 await auth.createUser({uid:userCap,email:userCap+"@example.test",emailVerified:true});
 await deny(()=>off.fn.completeFreeSignup(call(userA,consent)),"failed-precondition");
 await deny(()=>oneFlag.fn.completeFreeSignup(call(userA,consent)),"failed-precondition");
 await deny(()=>twoFlags.fn.completeFreeSignup(call(userA,consent)),"failed-precondition");
 assert.equal((await ref(userA).get()).exists,false);
 console.log("PASS: all 3 separate Public flags required; default OFF never grants credits");

 stage="actual Auth verification, consent, App Check fixture";
 await deny(()=>f.fn.completeFreeSignup(call(userA,consent)),"permission-denied");
 await deny(()=>f.fn.completeFreeSignup(call(userA,consent,{noApp:true})),"permission-denied");
 await deny(()=>f.fn.completeFreeSignup({
  ...call(userA,consent),app:{appId:"1:999:web:otherfirebaseapp"}
 }),"permission-denied");
 await auth.updateUser(userA,{emailVerified:true});
 await deny(()=>f.fn.completeFreeSignup(call(userA,{acceptTerms:false,
  termsVersion:policy,privacyVersion:policy})),"invalid-argument");
 await deny(()=>f.fn.completeFreeSignup(call(userA,{acceptTerms:true,
  termsVersion:"wrong",privacyVersion:policy})),"invalid-argument");
 await auth.setCustomUserClaims(userBeta,{packtookProductionBeta:true});
 await deny(()=>f.fn.completeFreeSignup(call(userBeta,consent)),"already-exists");
 console.log("PASS: real DEMO Auth requires verified email, policy consent; Beta stays isolated");

 stage="real Firestore transaction + claim idempotency";
 const first=await f.fn.completeFreeSignup(call(userA,consent));
 assert.equal(first.created,true);assert.equal(first.freeVideosPerMonth,20);
 assert.equal((await ref(userA).get()).data().registrationSource,"self_service_v65");
 assert.equal((await auth.getUser(userA)).customClaims.packtookPublicCustomer,true);
 const repeat=await f.fn.completeFreeSignup(call(userA,consent));
 assert.equal(repeat.created,false);
 assert.equal((await ref(userA).get()).data().used,0);
 const second=await f.fn.completeFreeSignup(call(userB,consent));
 assert.equal(second.created,true);
 assert.equal((await auth.getUser(userB)).customClaims.packtookPublicCustomer,true);
 const a=(p={},extras={})=>call(userA,p,{publicClaim:true,...extras});
 const b=(p={},extras={})=>call(userB,p,{publicClaim:true,...extras});
 assert.equal((await f.fn.usageStatus(a())).remaining,20);
 assert.equal((await f.fn.usageStatus(b())).remaining,20);
 await deny(()=>off.fn.usageStatus(a()),"permission-denied");
 console.log("PASS: real DEMO Firestore Free creation exactly once per UID and no cross-user credits");
 await deny(()=>f.fn.completeFreeSignup(call(userCap,consent)),"resource-exhausted");
 assert.equal((await ref(userCap).get()).exists,false);
 const daySnaps=await db.collection("publicSignupGuards").where("count","==",2).get();
 assert.equal(daySnaps.size,2,"Both short and daily counters count 2 successful grants");
 console.log("PASS: atomic 15-minute/day Free grant caps deny third UID without creating credits");

 stage="one device, one video, retry and account isolation";
 const r=await f.fn.registerDevice(a({deviceId:deviceA,name:"Primary test device"}));
 assert.equal(r.limit,1);
 await deny(()=>f.fn.registerDevice(a({deviceId:deviceA2,name:"Second device"})),"resource-exhausted");
 const other=await f.fn.registerDevice(b({deviceId:deviceB,name:"Other user's device"}));
 assert.equal(other.limit,1);
 await deny(()=>f.fn.reserveCredit(a({deviceId:deviceB,barcode,operationId:opA})),"permission-denied");
 const reserved=await f.fn.reserveCredit(a({deviceId:deviceA,barcode,operationId:opA}));
 assert.equal(reserved.remaining,19);
 const duplicateReserve=await f.fn.reserveCredit(a({deviceId:deviceA,barcode,operationId:opA}));
 assert.equal(duplicateReserve.idempotent,true);
 assert.equal((await f.fn.usageStatus(a())).remaining,19);
 const finish=await f.fn.finalizeCredit(a({operationId:opA,success:true,
  bytes:12000,filename:"v71-free-test.webm"}));
 assert.equal(finish.status,"completed");
 const twice=await f.fn.finalizeCredit(a({operationId:opA,success:true,
  bytes:12000,filename:"v71-free-test.webm"}));
 assert.equal(twice.idempotent,true);
 assert.equal((await f.fn.usageStatus(a())).remaining,19);
 assert.equal((await f.fn.usageStatus(a())).used,1);
 assert.equal((await f.fn.usageStatus(b())).remaining,20);
 await deny(()=>f.fn.recordingStatus(b({operationId:opA})),"not-found");
 const otherRes=await f.fn.reserveCredit(b({deviceId:deviceB,
  barcode,operationId:opB}));
 assert.equal(otherRes.remaining,19);
 assert.equal((await f.fn.usageStatus(a())).remaining,19);
 await deny(()=>f.fn.reserveCredit(a({deviceId:deviceA,
  barcode,operationId:"v71-repeated-"+tag})),"already-exists");
 console.log("PASS: 1 device/UID; reserve+finalize+repeat=1 debit; another UID cannot read recordings");

 stage="account recreation guard, QA OFF after release";
 const finalRepeat=await f.fn.completeFreeSignup(a(consent));
 assert.equal(finalRepeat.created,false);
 assert.equal((await f.fn.usageStatus(a())).remaining,19);
 assert.equal((await f.fn.publicSignupStatus()).freeVideosPerMonth,20);
 assert.equal((await f.fn.publicSignupStatus()).freeDevices,1);
 await db.recursiveDelete(ref(userB));
 await deny(()=>f.fn.completeFreeSignup(b(consent)),"failed-precondition");
 await deny(()=>f.fn.usageStatus(b()),"failed-precondition");
 await deny(()=>f.fn.qaFreeStatus(a()),"permission-denied");
 // New UID + SAME prior email after deletion must not receive fresh 20.
 // This tests the HMAC email lock even when Firebase Auth has released email.
 await auth.deleteUser(userA);
 intentionallyDeletedAuthUsers.add(userA);
 await auth.createUser({uid:userReuse,email:userA+"@example.test",emailVerified:true});
 await deny(()=>f.fn.completeFreeSignup(call(userReuse,consent)),"already-exists");
 assert.equal((await ref(userReuse).get()).exists,false);
 console.log("PASS: deleting Firebase Auth user then re-registering same email cannot regrant 20");
 console.log("PASS: deleting Free account cannot regrant credits; QA invite remains OFF");
 console.log("RESULT: PACKTOOK V7.1 DEMO AUTH/FIRESTORE PUBLIC FREE INTEGRATION PASS");
}catch(e){
 console.error("V7.1 DEMO PUBLIC FREE FAILED at stage: "+stage);
 console.error(e?.stack||e);
 throw e;
}finally{
 for(const id of users){
  try{await db.recursiveDelete(ref(id))}catch(e){console.warn("DEMO cleanup Firestore:",e.message)}
  if(!intentionallyDeletedAuthUsers.has(id))try{await auth.deleteUser(id)}catch(e){console.warn("DEMO cleanup Auth:",e.message)}
 }
 await admin.app().delete();
}
