"use strict";
/** P217: Real P188 handlers + Firebase Auth/Firestore Emulators, hostile
 * client-supplied ownerUid/accountId/uid and cross-tenant barcodes.
 * Demo-only, local; test itself cannot establish staging deploy/review approval.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {createRequire}=require("node:module");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const project="demo-packtook-p184";
for(const [key,value] of Object.entries({
 CI:"true",GCLOUD_PROJECT:project,GOOGLE_CLOUD_PROJECT:project,
 FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:19099"
}))if(process.env[key]!==value)throw Error("P217_DEMO_ONLY_REQUIRED_"+key);
const source=fs.readFileSync(path.resolve(__dirname,"../p188/candidate-index.js"),"utf8");
assert.equal(crypto.createHash("sha256").update(source).digest("hex"),EXPECTED_CANDIDATE);
const reqFns=createRequire(path.resolve(__dirname,"../../functions/index.js"));
const admin=reqFns("firebase-admin");
const sdk={onCall:(o,h)=>h,onRequest:(o,h)=>h,
 HttpsError:class extends Error{constructor(code,message){super(message);this.code=code}}};
const imports=name=>{
 if(name==="firebase-functions/v2/https")return sdk;
 if(name==="firebase-functions/params")return {defineSecret:()=>({value(){throw Error("SECRETS_FORBIDDEN")}})};
 if(name==="firebase-admin")return admin;
 if(name==="firebase-admin/firestore")return reqFns("firebase-admin/firestore");
 if(name==="node:crypto")return crypto;
 throw Error("IMPORT_UNEXPECTED");
};
const handlers={};
vm.compileFunction(source,["exports","require","module"],{filename:"p217-real-handler.js"})(handlers,imports,{exports:handlers});
const db=admin.firestore(),auth=admin.auth();
const own=id=>db.collection("accounts").doc(id);
const actors=["p217-alice","p217-bob","p217-legacy","p217-outside"];
const barcode="P217-SYNTHETIC-TENANT-BARCODE";
const barcodeId=crypto.createHash("sha256").update(barcode).digest("hex");
const approvals=id=>own(id).collection("duplicateApprovals");
const lock=id=>own(id).collection("barcodeLocks").doc(barcodeId);
const reason="Approved synthetic test order with verified owner only";
async function idToken(uid){
 const email=uid+"@example.invalid",password="P217-demo-password-2026!";
 await auth.createUser({uid,email,password,emailVerified:true});
 const r=await fetch("http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email,password,returnSecureToken:true})
 });
 assert.equal(r.status,200);
 const j=await r.json(),verified=await auth.verifyIdToken(j.idToken);
 assert.equal(verified.uid,uid);
 return {auth:{uid:verified.uid,token:{email_verified:verified.email_verified}},data:{}};
}
async function deny(fn,expected="permission-denied"){
 let e;try{await fn()}catch(err){e=err}
 assert(e,"G02_UNAUTHORIZED_REQUEST_WAS_ACCEPTED");
 assert.equal(e.code,expected);
}
let n=0;async function t(name,fn){await fn();n++;console.log("P217_"+name+"=PASS")}
(async()=>{
 await t("PINNED_P188_CANDIDATE",async()=>assert.equal(crypto.createHash("sha256").update(source).digest("hex"),EXPECTED_CANDIDATE));
 await t("REAL_ADMIN_FIRESTORE_READY",async()=>assert.equal((await db.collection("p217_probe").doc("none").get()).exists,false));
 const [alice,bob,legacy,outside]=await Promise.all(actors.map(idToken));
 await own("p217-alice").set({ownerUid:"p217-alice",plan:"Free",used:0,reserved:0,period:"2026-11"});
 await own("p217-bob").set({ownerUid:"p217-bob",plan:"Free",used:0,reserved:0,period:"2026-11"});
 await own("p217-legacy").set({plan:"Free",used:0,reserved:0,period:"2026-11"});
 await lock("p217-alice").set({operationId:"prior-alice",status:"completed"});
 await lock("p217-bob").set({operationId:"prior-bob",status:"completed"});
 await lock("p217-legacy").set({operationId:"prior-legacy",status:"completed"});
 const before=async(id)=>({account:(await own(id).get()).data(),approvals:(await approvals(id).get()).size});
 await t("AUTH_EMULATOR_VERIFIED_IDENTITIES",async()=>assert.equal(alice.auth.uid,"p217-alice"));
 await t("LEGITIMATE_ALICE_ADMIN",async()=>assert.equal((await handlers.accountRole(alice)).role,"admin"));
 await t("LEGITIMATE_BOB_ADMIN",async()=>assert.equal((await handlers.accountRole(bob)).role,"admin"));
 await t("ATTACK_FORGED_UID_BOB_CANNOT_ASSUME_ALICE",async()=>{
  const payload={...bob,data:{uid:"p217-alice",accountId:"p217-alice",ownerUid:"p217-alice"}};
  const result=await handlers.accountRole(payload);
  assert.equal(result.accountId,"p217-bob");
 });
 await t("ATTACK_LEGACY_FORGED_OWNERUID_DENIED",async()=>{
  await deny(()=>handlers.accountRole({...legacy,data:{uid:"p217-alice",ownerUid:"p217-legacy"}}));
 });
 await t("ATTACK_LEGACY_ROLE_NO_BACKFILL",async()=>assert.equal((await own("p217-legacy").get()).data().ownerUid,undefined));
 await t("ATTACK_UNAUTHENTICATED_WITH_OWNERUID_DENIED",async()=>{
  await deny(()=>handlers.accountRole({data:{uid:"p217-alice",ownerUid:"p217-alice"}}),"unauthenticated");
 });
 await t("ATTACK_FORGED_DUPLICATE_OWNERUID_NOT_CROSS_TENANT",async()=>{
  const payload={...bob,data:{barcode,reason,uid:"p217-alice",
   accountId:"p217-alice",ownerUid:"p217-alice",approvedBy:"p217-alice"}};
  const response=await handlers.authorizeDuplicate(payload);
  assert.equal(typeof response.approvalId,"string");
  assert.equal((await approvals("p217-alice").get()).size,0);
  assert.equal((await approvals("p217-bob").get()).size,1);
 });
 await t("ATTACK_LEGACY_APPROVAL_OWNER_HINTS_DENIED",async()=>{
  await deny(()=>handlers.authorizeDuplicate({...legacy,data:{barcode,reason,ownerUid:"p217-legacy",accountId:"p217-alice"}}));
 });
 await t("ATTACK_LEGACY_APPROVAL_NO_SIDE_EFFECTS",async()=>{
  const b=await before("p217-legacy");
  assert.equal(b.approvals,0);assert.equal(b.account.ownerUid,undefined);
 });
 await t("ATTACK_OUTSIDE_USER_CANNOT_APPROVE_ALICE",async()=>{
  await deny(()=>handlers.authorizeDuplicate({...outside,data:{barcode,reason,accountId:"p217-alice",uid:"p217-alice"}}));
 });
 await t("ATTACK_OUTSIDE_NO_ACCOUNT_CREATED",async()=>assert.equal((await own("p217-outside").get()).exists,false));
 await t("ATTACK_BARCODE_MISSING_IN_BOB_DENIED",async()=>{
  const x={...bob,data:{barcode:"ONLY-IN-ALICE-NOT-BOB",reason,accountId:"p217-alice"}};
  await deny(()=>handlers.authorizeDuplicate(x),"failed-precondition");
 });
 await t("ATTACK_BOB_MISSING_BARCODE_NO_APPROVAL",async()=>assert.equal((await approvals("p217-bob").get()).size,1));
 await t("ATTACK_CLIENT_OWNERUID_CANNOT_OVERRIDE_USAGE_STATUS",async()=>{
  const r=await handlers.usageStatus({...legacy,data:{ownerUid:"p217-legacy",accountId:"p217-alice"}});
  assert.equal(r.plan,"Free");
  assert.equal((await own("p217-legacy").get()).data().ownerUid,undefined);
 });
 await t("ATTACK_ALICE_ACCOUNT_UNTOUCHED",async()=>{
  const b=await before("p217-alice");
  assert.equal(b.account.ownerUid,"p217-alice");assert.equal(b.approvals,0);
 });
 await t("ATTACK_BOB_OWNERUID_UNCHANGED",async()=>assert.equal((await own("p217-bob").get()).data().ownerUid,"p217-bob"));
 await t("ATTACK_FORGED_INPUT_CANNOT_GRANT_OUTSIDE_ADMIN",async()=>{
  await deny(()=>handlers.accountRole({...outside,data:{role:"admin",uid:"p217-alice"}}));
 });
 console.log("P217_REAL_G02_AUTHZ_ADVERSARIAL_EMULATOR_FIXTURES="+n+"/"+n+"_PASS");
 console.log("P217_P188_SOURCE_PINNED=TRUE G02_INDEPENDENT_REVIEW=NOT_PERFORMED");
 console.log("P217_STAGING_RUNTIME_TESTED=FALSE CLOUD_CALLS=0");
 console.log("P217_G02=NO_GO_RELEASE PRODUCTION_WRITES=0");
})().catch(e=>{console.error("P217_BLOCK="+String(e?.message||"FAILED").slice(0,130));process.exitCode=1})
.finally(async()=>{try{await db.terminate()}catch{}try{await admin.app().delete()}catch{}});
