"use strict";
/* P72 real Firestore emulator candidate tests; no cloud identity or credentials */
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createRequire}=require("node:module"),path=require("node:path");
const uid="p72UserDemo00001",sess="s65_1234567890abcdef",device="p72_device00000001";
const op=n=>"p72_operation_000"+n;
const period=()=>new Date().toISOString().slice(0,7);
function environment(){
 if(process.env.GCLOUD_PROJECT!=="demo-packtook-p69"||
 process.env.GCP_PROJECT!=="demo-packtook-p69"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9199"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8199"||
 process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
 throw Error("P72_EMULATOR_ONLY");
}
test("P72 paid subscription and cross-month Staging credit semantic matrix",async t=>{
 environment();
 const requireSDK=createRequire(path.resolve(__dirname,"functions/package.json"));
 const admin=requireSDK("firebase-admin"),{FieldValue}=requireSDK("firebase-admin/firestore");
 const {HttpsError}=requireSDK("firebase-functions/v2/https");
 const {createCreditHandlers}=require("./functions/credit-handlers.cjs");
 const app=admin.initializeApp({projectId:"demo-packtook-p69"},"p72-demo");
 const db=admin.firestore(app),svc=createCreditHandlers({db,FieldValue,HttpsError});
 const acct=db.collection("accounts").doc(uid),lease=db.doc("pilotControls/p65");
 const ctx={session:sess};
 const make=n=>({operationId:op(n),barcode:"P72-BAR-"+n,deviceId:device});
 try{
  await lease.set({enabled:true,ownerApproved:true,legalApproved:true,
   policyVersion:"p65-staging-review-only",sessionId:sess,
   startedAt:new Date(Date.now()-60000).toISOString(),
   expiresAt:new Date(Date.now()+3600000).toISOString(),
   maxInvitedUsers:3,invitedUids:[uid]});
  await t.test("account not pre-provisioned never creates free grant",async()=>{
   await assert.rejects(svc.reserve(uid,make(1),ctx),e=>e.code==="failed-precondition");
   assert.equal((await acct.get()).exists,false);
  });
  const a={plan:"Starter",period:period(),used:0,reserved:0,
   creditWalletV1:true,creditWalletRemaining:3,
   devices:[{id:device,name:"P72 Emulator Device"}]};
  await acct.set(a);
  await t.test("unconfigured paid subscription denies reservation without change",async()=>{
   await assert.rejects(svc.reserve(uid,make(1),ctx),e=>e.code==="permission-denied");
   assert.equal((await acct.get()).data().creditWalletRemaining,3);
  });
  await t.test("invalid paid expiry denies reservation",async()=>{
   await acct.update({planExpiresAt:"garbage"});
   await assert.rejects(svc.reserve(uid,make(1),ctx),e=>e.code==="permission-denied");
  });
  await t.test("expired paid subscription denies reservation",async()=>{
   await acct.update({planExpiresAt:new Date(Date.now()-5000).toISOString()});
   await assert.rejects(svc.reserve(uid,make(1),ctx),e=>e.code==="permission-denied");
  });
  await t.test("active paid subscription reserves then returns credit on failure",async()=>{
   await acct.update({planExpiresAt:new Date(Date.now()+3600000).toISOString()});
   assert.equal((await svc.reserve(uid,make(1),ctx)).status,"reserved");
   assert.equal((await acct.get()).data().creditWalletRemaining,2);
   assert.equal((await svc.finalize(uid,{operationId:op(1),success:false},ctx)).status,"failed");
   assert.equal((await acct.get()).data().creditWalletRemaining,3);
  });
  await t.test("next-month wallet preserves credits and active reserved count",async()=>{
   await acct.update({plan:"Free",period:"2020-01",used:9,reserved:0,
    creditWalletV1:true,creditWalletRemaining:3});
   const r=await svc.reserve(uid,make(2),ctx);
   assert.equal(r.remaining,2);
   assert.equal((await acct.get()).data().reserved,1);
   assert.equal((await acct.get()).data().used,0);
  });
  await t.test("legacy next-month account starts fresh quota and validates counters",async()=>{
   await acct.update({plan:"Free",period:"2020-01",used:17,reserved:0,
    creditWalletV1:false,creditWalletRemaining:3});
   const r=await svc.reserve(uid,make(3),ctx);
   assert.equal(r.remaining,19);
   const d=(await acct.get()).data();assert.equal(d.reserved,1);assert.equal(d.used,0);
  });
  await t.test("legacy negative counters fail closed even across months",async()=>{
   await acct.update({period:"2020-01",used:-3,reserved:1});
   await assert.rejects(svc.reserve(uid,make(4),ctx),e=>e.code==="failed-precondition");
  });
 }finally{
  await Promise.allSettled([db.recursiveDelete(acct),lease.delete()]);
  await app.delete();
 }
});
