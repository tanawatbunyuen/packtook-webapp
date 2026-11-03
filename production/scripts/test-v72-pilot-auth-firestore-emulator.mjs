// PACKTOOK V7.2 — real DEMO Auth + Firestore integration for invited Pilot.
// No Production Firebase calls, deploy, email delivery, browser or real App Check.
// Callable transport and SecretParam are stubbed; Admin/Auth/Firestore use DEMO.
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
if(admin.apps.length)throw Error("SAFETY BLOCK: unexpected Admin app");
admin.initializeApp({projectId:DEMO});
const auth=admin.auth(),db=admin.firestore();
if(admin.app().options.projectId!==DEMO)throw Error("SAFETY BLOCK: non-DEMO Firebase");
const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const control=db.collection("pilotControls").doc("v72");
class HttpsError extends Error{
 constructor(code,message){super(message);this.code=code}
}
const appId="1:123456789:web:pilotv72approved";
const policy="2026-11-v1";
function harness({enabled=false,publicSignup=false,qaEnabled=false,hmacKey="e".repeat(64),
 dayCap="3",shortCap="3"}={}){
 const optionsByName=new Map();
 const onCall=(opts,handler)=>{
  const body=handler.toString();
  if(body.includes("Pilot admission protections are not configured")&&body.includes("Pilot invitation"))
   optionsByName.set("pilotInvitationStatus",opts);
  if(body.includes("Pilot admission protections are not configured")&&body.includes("Accept the approved Pilot"))
   optionsByName.set("completePilotFreeSignup",opts);
  return handler;
 };
 function firestore(){return db}
 firestore.FieldValue=admin.firestore.FieldValue;
 const fakeAdmin={initializeApp(){},firestore,auth:()=>auth};
 const env={
  PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
  GCLOUD_PROJECT:"packtook-prod-01",GCP_PROJECT:"packtook-prod-01",
  PACKTOOK_PUBLIC_SIGNUP_ENABLED:String(publicSignup),
  PACKTOOK_PUBLIC_ACCESS_ENABLED:"false",
  PACKTOOK_PUBLIC_POLICIES_APPROVED:"false",
  PACKTOOK_PUBLIC_CUSTOMER_APP_ID:appId,
  PACKTOOK_V7_QA_ENABLED:String(qaEnabled),
  PACKTOOK_V72_PILOT_ENABLED:String(enabled),
  PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX:hmacKey,
  PACKTOOK_PUBLIC_FREE_NEW_DAY_CAP:dayCap,
  PACKTOOK_PUBLIC_FREE_NEW_15M_CAP:shortCap
 };
 const requireFake=name=>{
  if(name==="firebase-functions/v2/https")return {onCall,HttpsError};
  if(name==="firebase-functions/params")return {defineSecret:key=>({name:key,value:()=>env[key]})};
  if(name==="firebase-functions/logger")return {info(){}};
  if(name==="firebase-admin")return fakeAdmin;
  if(name==="node:crypto")return crypto;
  throw Error("Unexpected dependency "+name);
 };
 const exports={};
 new Function("exports","process","require","console",source)(
  exports,{env},requireFake,{log(){},warn(){},error(){}});
 return {fn:exports,optionsByName};
}
const tag=crypto.randomUUID().replaceAll("-","").slice(0,20);
const A="pilot-a-"+tag,B="pilot-b-"+tag,C="pilot-c-"+tag,
 D="pilot-d-"+tag,Beta="pilot-beta-"+tag,Reuse="pilot-reuse-"+tag;
const users=[A,B,C,D,Beta,Reuse],created=new Set();
const sid="v72_"+crypto.randomUUID().replaceAll("-","");
const consent={acceptTestTerms:true,acceptPrivacy:true,policyVersion:policy};
const own=id=>db.collection("accounts").doc(id);
const call=(uid,data={},extra={})=>({
 data,
 auth:{uid,token:{
  email_verified:extra.verified??true,
  packtookPilotV72:extra.pilotClaim??false,
  packtookPilotV72Session:extra.sessionId??sid,
  packtookProductionBeta:extra.betaClaim??false
 }},
 app:extra.noApp?null:{appId:extra.appId||appId}
});
const deny=(run,code)=>assert.rejects(run,e=>e?.code===code);
let stage="setup";
const config=(changes={})=>({
 enabled:true,legalApproved:true,ownerApproved:true,
 policyVersion:policy,startedAt:new Date(Date.now()-60000).toISOString(),
 expiresAt:new Date(Date.now()+40*60000).toISOString(),
 sessionId:sid,maxInvitedUsers:3,invitedUids:[A,B,C],...changes
});
const put=async changes=>control.set(config(changes));
try{
 stage="create real DEMO Firebase Auth users, no pilot doc or flags";
 for(const id of [A,B,C,D,Beta]){
  await auth.createUser({uid:id,email:id+"@example.test",
   emailVerified:id!==A});created.add(id);
 }
 const off=harness().fn, f=harness({enabled:true}).fn;
 await deny(()=>off.pilotInvitationStatus(call(A)),"permission-denied");
 await deny(()=>f.pilotInvitationStatus(call(A)),"permission-denied");
 await put();
 await deny(()=>off.completePilotFreeSignup(call(A,consent)),"permission-denied");
 await deny(()=>harness({enabled:true,publicSignup:true}).fn.pilotInvitationStatus(call(A)),"permission-denied");
 await deny(()=>harness({enabled:true,qaEnabled:true}).fn.pilotInvitationStatus(call(A)),"permission-denied");
 await deny(()=>harness({enabled:true,hmacKey:""}).fn.pilotInvitationStatus(call(A)),"failed-precondition");
 await deny(()=>harness({enabled:true,dayCap:"0"}).fn.completePilotFreeSignup(call(A,consent)),"failed-precondition");
 assert.equal((await off.publicSignupStatus()).enabled,false);
 assert.equal((await f.publicSignupStatus()).enabled,false);
 console.log("PASS: Pilot and all Public/QA flags default OFF; no Firestore control grants nothing");
 stage="exact signed App Check fixture, live verified email, consent, cohort";
 assert.equal((await f.pilotInvitationStatus(call(B))).enabled,true);
 await deny(()=>f.pilotInvitationStatus(call(D)),"permission-denied");
 await deny(()=>f.pilotInvitationStatus(call(B,{}, {noApp:true})),"permission-denied");
 await deny(()=>f.pilotInvitationStatus(call(B,{}, {appId:"1:999:web:wrong"})),"permission-denied");
 await deny(()=>f.completePilotFreeSignup(call(A,consent)),"permission-denied");
 await auth.updateUser(A,{emailVerified:true});
 await deny(()=>f.completePilotFreeSignup(call(A,{...consent,acceptTestTerms:false})),"invalid-argument");
 await deny(()=>f.completePilotFreeSignup(call(A,{...consent,acceptPrivacy:false})),"invalid-argument");
 await deny(()=>f.completePilotFreeSignup(call(A,{...consent,policyVersion:"old"})),"invalid-argument");
 await deny(()=>f.completePilotFreeSignup(call(D,consent)),"permission-denied");
 await auth.setCustomUserClaims(Beta,{packtookProductionBeta:true});
 await put({invitedUids:[A,B,Beta]});
 await deny(()=>f.completePilotFreeSignup(call(Beta,consent)),"permission-denied");
 await put();
 console.log("PASS: exact invited UID/App Check, verified Auth email and versioned consent required; Beta excluded");
 stage="control tamper: overlong TTL, wrong version, 4 UIDs, expired, disabled";
 await put({expiresAt:new Date(Date.now()+5*60*60*1000).toISOString()});
 await deny(()=>f.pilotInvitationStatus(call(A)),"permission-denied");
 await put({invitedUids:[A,B,C,D]});
 await deny(()=>f.pilotInvitationStatus(call(A)),"permission-denied");
 await put({invitedUids:[A,A,B]});
 await deny(()=>f.pilotInvitationStatus(call(A)),"permission-denied");
 await put({legalApproved:false});
 await deny(()=>f.pilotInvitationStatus(call(A)),"permission-denied");
 await put({enabled:false});
 await deny(()=>f.pilotInvitationStatus(call(A)),"permission-denied");
 await put({expiresAt:new Date(Date.now()-1000).toISOString()});
 await deny(()=>f.pilotInvitationStatus(call(A)),"permission-denied");
 await put();
 console.log("PASS: >4h TTL, duplicate/4th UID, expired, disabled or unsigned legal gate fail CLOSED");
 stage="atomic Free enrollment, account isolation and one device";
 const first=await f.completePilotFreeSignup(call(A,consent));
 assert.equal(first.created,true);assert.equal(first.freeVideosPerMonth,20);
 assert.equal((await own(A).get()).data().registrationSource,"controlled_pilot_v72");
 const authA=await auth.getUser(A);
 assert.equal(authA.customClaims.packtookPilotV72,true);
 assert.equal(authA.customClaims.packtookPilotV72Session,sid);
 const retry=await f.completePilotFreeSignup(call(A,consent));
 assert.equal(retry.created,false);
 await f.completePilotFreeSignup(call(B,consent));
 await f.completePilotFreeSignup(call(C,consent));
 const a=(d={},extra={})=>call(A,d,{pilotClaim:true,...extra});
 const b=(d={},extra={})=>call(B,d,{pilotClaim:true,...extra});
 await deny(()=>f.usageStatus(call(A)),"permission-denied");
 assert.equal((await f.usageStatus(a())).remaining,20);
 assert.equal((await f.usageStatus(b())).remaining,20);
 await deny(()=>f.usageStatus(a({}, {sessionId:"v72_invalid_session"})),"permission-denied");
 await deny(()=>f.usageStatus(a({}, {appId:"1:999:web:wrong"})),"permission-denied");
 const deviceA="v72-device-a-"+tag,deviceB="v72-device-b-"+tag,other="v72-device-x-"+tag;
 const opA="v72-op-a-"+tag,barcode="V72-TEST-"+tag;
 assert.equal((await f.registerDevice(a({deviceId:deviceA,name:"Demo device"}))).limit,1);
 await deny(()=>f.registerDevice(a({deviceId:other,name:"Other"})),"resource-exhausted");
 assert.equal((await f.registerDevice(b({deviceId:deviceB,name:"Second account"}))).limit,1);
 await deny(()=>f.reserveCredit(a({deviceId:deviceB,barcode,operationId:opA})),"permission-denied");
 assert.equal((await f.reserveCredit(a({deviceId:deviceA,barcode,operationId:opA}))).remaining,19);
 assert.equal((await f.reserveCredit(a({deviceId:deviceA,barcode,operationId:opA}))).idempotent,true);
 assert.equal((await f.finalizeCredit(a({operationId:opA,success:true,bytes:12000,filename:"pilot-test.webm"}))).status,"completed");
 assert.equal((await f.finalizeCredit(a({operationId:opA,success:true,bytes:12000,filename:"pilot-test.webm"}))).idempotent,true);
 assert.equal((await f.usageStatus(a())).remaining,19);
 assert.equal((await f.usageStatus(b())).remaining,20);
 await deny(()=>f.recordingStatus(b({operationId:opA})),"not-found");
 console.log("PASS: real DEMO Firestore atomic once-only 20, 3 UIDs max, 1 device, 20→19, idempotent reserve/finalize, UID isolation");
 stage="live kill switch denies all existing pilot sessions; Beta unaffected";
 await put({enabled:false});
 for(const [name,args] of [
  ["usageStatus",a()],["recordingStatus",a({operationId:opA})],
  ["deviceStatus",a({deviceId:deviceA})],
  ["reserveCredit",a({deviceId:deviceA,barcode:"V72-NEW-"+tag,operationId:"v72-new-"+tag})],
  ["finalizeCredit",a({operationId:opA,success:true,bytes:12000,filename:"pilot-test.webm"})]
 ]){
  await deny(()=>f[name](args),"permission-denied");
 }
 // A verified legacy Beta account continues working after Pilot revocation.
 const betaToken=call(Beta,{}, {betaClaim:true});
 await put({enabled:false});
 assert.equal((await f.usageStatus(betaToken)).remaining,20);
 console.log("PASS: runtime kill switch immediately blocks usage, device, reserve, finalize and recording; Beta stays isolated");
 stage="expired and changed session guard; deleted account email reuse";
 await put({sessionId:"v72_"+crypto.randomUUID().replaceAll("-")});
 await deny(()=>f.usageStatus(a()),"permission-denied");
 await put({expiresAt:new Date(Date.now()-200).toISOString()});
 await deny(()=>f.usageStatus(a()),"permission-denied");
 await put();
 await auth.deleteUser(A);created.delete(A);
 await db.recursiveDelete(own(A));
 await auth.createUser({uid:Reuse,email:A+"@example.test",emailVerified:true});
 created.add(Reuse);
 await put({invitedUids:[Reuse,B,C]});
 await deny(()=>f.completePilotFreeSignup(call(Reuse,consent)),"already-exists");
 assert.equal((await own(Reuse).get()).exists,false);
 console.log("PASS: revoked/expired/stale session cannot revive access; deleted Auth+account email cannot regrant 20");
 console.log("RESULT: PACKTOOK V7.2 REAL DEMO CLOSED PILOT AUTH/FIRESTORE INTEGRATION PASS");
}catch(e){
 console.error("V7.2 PILOT DEMO FAILED at stage: "+stage);
 console.error(e?.stack||e);
 throw e;
}finally{
 await control.delete().catch(()=>{});
 for(const id of users){
  await db.recursiveDelete(own(id)).catch(()=>{});
  if(created.has(id))await auth.deleteUser(id).catch(()=>{});
 }
 await admin.app().delete();
}
