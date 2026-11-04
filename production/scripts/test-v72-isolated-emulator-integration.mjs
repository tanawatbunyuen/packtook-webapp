// PACKTOOK V7.2 isolated Firebase Auth + Firestore Emulator integration.
// Executes ACTUAL production/functions/index.js handlers with real Admin SDK
// against demo-only emulators. Callable transport/App Check and HMAC are mocked.
// NO GCP, no Production Auth/Firestore, no real email, no Secret Manager.
// Run only via scripts/v72-run-isolated-emulator.sh.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import {createRequire} from "node:module";

const PROJECT="demo-packtook-v72";
const APP_ID="1:267344264661:web:abcde12345";
const SESSION="v72_abcdefghijklmnop1234";
const ADMIN_TEST_EMAIL="pilot-v72-integration@example.invalid";
const VALID_OP="v72operation_00001";
const DEVICE="v72device_00000001";
function fail(message){throw Error("SAFETY BLOCK: "+message)}
if(process.argv.length!==2)fail("no arguments accepted");
if(process.env.GCLOUD_PROJECT!==PROJECT&&process.env.GCLOUD_PROJECT!==undefined)
 fail("GCLOUD_PROJECT must be demo project");
if(process.env.GOOGLE_CLOUD_PROJECT!==PROJECT&&process.env.GOOGLE_CLOUD_PROJECT!==undefined)
 fail("GOOGLE_CLOUD_PROJECT must be demo project");
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080")
 fail("Firestore emulator loopback port required");
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099")
 fail("Auth emulator loopback port required");
if(process.env.FIREBASE_CONFIG||process.env.GOOGLE_APPLICATION_CREDENTIALS)
 fail("unexpected Production config or credentials in emulator shell");
const requireFunctions=createRequire(new URL("../functions/package.json",import.meta.url));
let admin;
try{admin=requireFunctions("firebase-admin")}catch{
 fail("firebase-admin not installed; run npm ci/npm install in production/functions");
}
admin.initializeApp({projectId:PROJECT});
const db=admin.firestore();
const authService=admin.auth();
// Ensure both emulators respond before ANY data operation.
for(const [url,service] of [
 ["http://127.0.0.1:19099/","auth"],
 ["http://127.0.0.1:18080/","firestore"]]){
 let response;
 try{response=await fetch(url,{signal:AbortSignal.timeout(4000)})}
 catch{fail(service+" emulator not reachable on expected loopback address")}
 if(![200,400,404].includes(response.status))
  fail(service+" emulator not ready: HTTP "+response.status);
}
const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const metrics={handlersLoaded:false,admissionWrites:0,passes:0};
class HttpsError extends Error{
 constructor(code,message){super(message);this.code=code}
}
const realAdmin={
 initializeApp(){return admin.app()},
 firestore:Object.assign(()=>db,{FieldValue:admin.firestore.FieldValue}),
 auth:()=>authService
};
const mocks={
 "firebase-functions/v2/https":{
  HttpsError,onCall:(opts,handler)=>async req=>{
   if(opts.enforceAppCheck===true&&!req.app)throw new HttpsError("unauthenticated","App Check required (test transport stub)");
   return handler(req);
  }
 },
 "firebase-functions/params":{defineSecret:()=>({value:()=>"a".repeat(64)})},
 "firebase-functions/logger":{info(){}},
 "firebase-admin":realAdmin,
 "node:crypto":crypto
};
const module={exports:{}};
const env={
 PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
 // ONLY inside the VM: gate expects production, while Admin SDK is pinned
 // to DEMO project and its endpoints are strictly loopback emulators.
 GCLOUD_PROJECT:"packtook-prod-01",
 GCP_PROJECT:"packtook-prod-01",
 PACKTOOK_V72_PILOT_ENABLED:"true",
 PACKTOOK_PUBLIC_SIGNUP_ENABLED:"false",
 PACKTOOK_PUBLIC_ACCESS_ENABLED:"false",
 PACKTOOK_PUBLIC_POLICIES_APPROVED:"false",
 PACKTOOK_V7_QA_ENABLED:"false",
 PACKTOOK_PUBLIC_CUSTOMER_APP_ID:APP_ID,
 PACKTOOK_PUBLIC_FREE_NEW_DAY_CAP:"3",
 PACKTOOK_PUBLIC_FREE_NEW_15M_CAP:"2"
};
vm.runInNewContext(source,{module,exports:module.exports,
 process:{env},require:(name)=>{
  if(!Object.hasOwn(mocks,name))fail("unrecognized dependency "+name);
  return mocks[name];
 },Date,Buffer,console}, {filename:"production/functions/index.js",timeout:3000});
const fn=module.exports;
metrics.handlersLoaded=true;
const uid="pilotv72_"+crypto.randomBytes(6).toString("hex");
const email="pilot-v72-"+crypto.randomBytes(5).toString("hex")+"@example.invalid";
const now=Date.now();
const controlRef=db.collection("pilotControls").doc("v72");
const ctrl={
 enabled:true,legalApproved:true,ownerApproved:true,policyVersion:"2026-11-v1",
 startedAt:new Date(now-30000).toISOString(),
 expiresAt:new Date(now+60*60*1000).toISOString(),
 invitedUids:[uid],maxInvitedUsers:3,sessionId:SESSION
};
const account=db.collection("accounts").doc(uid);
const useAuth=(claims={},app=APP_ID)=>({
 auth:{uid,token:{email_verified:true,...claims}},
 app:app===null?undefined:{appId:app},data:{}
});
const consent={acceptTestTerms:true,acceptPrivacy:true,policyVersion:"2026-11-v1"};
async function rejected(label,run,code="permission-denied"){
 await assert.rejects(run,e=>e?.code===code,label);
 metrics.passes++;console.log("PASS: "+label);
}
async function accepted(label,run,check){
 const result=await run();
 if(check)await check(result);
 metrics.passes++;console.log("PASS: "+label);
}
async function verifyNoAccount(label){
 const snap=await account.get();
 assert.equal(snap.exists,false,label+": no free entitlement");
}
try{
 await authService.createUser({uid,email,password:crypto.randomBytes(20).toString("base64url"),emailVerified:false});
 await rejected("no Firestore pilot control",()=>fn.pilotInvitationStatus(useAuth()));
 await verifyNoAccount("no control");
 await controlRef.set(ctrl);
 await rejected("wrong app ID",()=>fn.pilotInvitationStatus(useAuth({},"1:111:web:wrong")));
 await rejected("not invited UID",async()=>{
  await controlRef.update({invitedUids:["otheruser000001"]});
  try{return await fn.pilotInvitationStatus(useAuth())}
  finally{await controlRef.update({invitedUids:[uid]})}
 });
 await accepted("unverified user gets status but no activation",()=>fn.pilotInvitationStatus(useAuth()),r=>{
  assert.equal(r.enabled,true);assert.equal(r.verified,false);assert.equal(r.active,false);
 });
 await rejected("unverified cannot activate",()=>fn.completePilotFreeSignup({...useAuth(),data:consent}));
 await verifyNoAccount("unverified");
 await authService.updateUser(uid,{emailVerified:true});
 await rejected("missing consent",()=>fn.completePilotFreeSignup({...useAuth(),data:{}}),"invalid-argument");
 await verifyNoAccount("missing consent");
 await accepted("verified eligible status",()=>fn.pilotInvitationStatus(useAuth()),r=>{
  assert.equal(r.enabled,true);assert.equal(r.verified,true);assert.equal(r.active,false);
 });
 await accepted("first activation with real Firestore transaction + Auth claim",()=>fn.completePilotFreeSignup({...useAuth(),data:consent}),async r=>{
  assert.equal(r.activated,true);assert.equal(r.created,true);
  const snap=await account.get();assert.equal(snap.exists,true);
  assert.equal(snap.data().registrationSource,"controlled_pilot_v72");
  assert.equal(snap.data().plan,"Free");assert.equal(snap.data().used,0);
  assert.equal(snap.data().reserved,0);assert.deepEqual(snap.data().devices,[]);
  const person=await authService.getUser(uid);
  assert.equal(person.customClaims.packtookPilotV72,true);
  assert.equal(person.customClaims.packtookPilotV72Session,SESSION);
 });
 await accepted("idempotent activation does not duplicate account",()=>fn.completePilotFreeSignup({...useAuth(),data:consent}),r=>{
  assert.equal(r.activated,true);assert.equal(r.created,false);
 });
 const claims={packtookPilotV72:true,packtookPilotV72Session:SESSION};
 await accepted("live Pilot status active",()=>fn.pilotInvitationStatus(useAuth(claims)),r=>{
  assert.equal(r.active,true);
 });
 await accepted("register single device",()=>fn.registerDevice({...useAuth(claims),data:{deviceId:DEVICE,name:"Emulator QA"}}),r=>{
  assert.equal(r.registered,true);assert.equal(r.limit,1);
 });
 await accepted("usage starts at 20",()=>fn.usageStatus(useAuth(claims)),r=>{
  assert.equal(r.remaining,20);assert.equal(r.used,0);
 });
 await accepted("reserve one recording",()=>fn.reserveCredit({...useAuth(claims),data:{
  operationId:VALID_OP,barcode:"V72-EMULATOR-"+uid,deviceId:DEVICE}}),r=>{
  assert.equal(r.status,"reserved");assert.equal(r.remaining,19);
 });
 await accepted("finalize a locally saved video metadata",()=>fn.finalizeCredit({...useAuth(claims),data:{
  operationId:VALID_OP,success:true,filename:"v72-test.webm",bytes:5012}}),r=>{
  assert.equal(r.status,"completed");
 });
 await accepted("remaining credit 19",()=>fn.usageStatus(useAuth(claims)),r=>{
  assert.equal(r.remaining,19);assert.equal(r.used,1);assert.equal(r.reserved,0);
 });
 await accepted("finalize idempotent repeat",()=>fn.finalizeCredit({...useAuth(claims),data:{
  operationId:VALID_OP,success:true,filename:"v72-test.webm",bytes:5012}}),r=>{
  assert.equal(r.idempotent,true);
 });
 await controlRef.update({enabled:false});
 await rejected("revoked lease rejects existing Pilot token",()=>fn.usageStatus(useAuth(claims)));
 await controlRef.update({enabled:true,expiresAt:new Date(now-1000).toISOString()});
 await rejected("expired lease rejects recording",()=>fn.reserveCredit({...useAuth(claims),data:{
  operationId:"v72operation_00002",barcode:"V72-EXPIRED",deviceId:DEVICE}}));
 await accepted("post-revocation account credit unchanged",()=>account.get(),s=>{
  assert.equal(s.data().used,1);assert.equal(s.data().reserved,0);
 });
 console.log(JSON.stringify({
  mode:"ISOLATED_AUTH_FIRESTORE_EMULATOR_REAL_HANDLERS",
  project:PROJECT,passed:metrics.passes,
  authenticatedRealEmulatorSDK:true,
  firestoreTransactionsVerified:true,
  creditFlow:"20->19",noProductionWrites:true,
  callableTransportMocked:true,realAppCheckVerified:false,
  hmacSecretManagerVerified:false,realVideoFileSaved:false,
  productionRuntimeVerified:false,pilotActivationAuthorized:false,
  decision:"NO_GO_CONTROLLED_PILOT"
 },null,2));
}catch(e){
 console.error("FAIL:",e?.code||e?.name||"UNKNOWN",String(e?.message||e).slice(0,450));
 process.exitCode=2;
}finally{
 await admin.app().delete();
}
