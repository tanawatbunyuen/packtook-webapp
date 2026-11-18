"use strict";
/* P73 Emulator: clock/period boundaries, corrupt counters, finalization
 * concurrency, and recovery idempotency, all in demo project.
 */
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createRequire}=require("node:module"),path=require("node:path");
const uid="p73EdgeTestUser01",session="s65_1234567890abcdef";
const device="p73_device00000001";
const op=n=>"p73_operation0000"+n;
const period=()=>new Date().toISOString().slice(0,7);
const envGuard=()=>{
 if(process.env.GCLOUD_PROJECT!=="demo-packtook-p69"||
 process.env.GCP_PROJECT!=="demo-packtook-p69"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9199"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8199"||
 process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
  throw Error("P73_DEMO_EMULATOR_ONLY");
};
test("P73 Firestore credit wallet & recovery edge cases",async t=>{
 envGuard();
 const load=createRequire(path.resolve(__dirname,"functions/package.json"));
 const admin=load("firebase-admin"),{FieldValue}=load("firebase-admin/firestore");
 const {HttpsError}=load("firebase-functions/v2/https");
 const {createCreditHandlers}=require("./functions/credit-handlers.cjs");
 const app=admin.initializeApp({projectId:"demo-packtook-p69"},"p73-test-app");
 const db=admin.firestore(app),svc=createCreditHandlers({db,FieldValue,HttpsError});
 const acc=db.collection("accounts").doc(uid),lease=db.doc("pilotControls/p65");
 const ctx={session};
 const make=n=>({operationId:op(n),barcode:"P73-BAR-"+n,deviceId:device});
 const state=async()=>{const a=(await acc.get()).data();return [a.creditWalletRemaining,a.reserved,a.used];};
 try{
  await lease.set({enabled:true,ownerApproved:true,legalApproved:true,
    policyVersion:"p65-staging-review-only",sessionId:session,
    startedAt:new Date(Date.now()-60000).toISOString(),
    expiresAt:new Date(Date.now()+3600000).toISOString(),
    maxInvitedUsers:3,invitedUids:[uid]});
  await acc.set({plan:"Free",period:period(),creditWalletV1:true,
    creditWalletRemaining:5,used:0,reserved:0,
    devices:[{id:device,name:"P73 Test"}]});
  await t.test("wallet reservation created last month refunds once without used rollover",async()=>{
   await acc.update({period:"2020-01",used:0,reserved:0});
   await svc.reserve(uid,make(1),ctx);
   await acc.update({period:"2020-01",used:8,reserved:1});
   const r=await svc.finalize(uid,{operationId:op(1),success:false},ctx);
   assert.equal(r.status,"failed");
   const s=await state();
   assert.deepEqual(s,[5,0,8]);
  });
  await t.test("same-period duplicate finalization race consumes one credit",async()=>{
   await acc.update({period:period(),used:0,reserved:0,creditWalletRemaining:5});
   await svc.reserve(uid,make(2),ctx);
   const payload={operationId:op(2),success:true,bytes:2500,filename:"p73.webm"};
   const [a,b]=await Promise.all([svc.finalize(uid,payload,ctx),svc.finalize(uid,payload,ctx)]);
   assert.equal(a.status,"completed");assert.equal(b.status,"completed");
   assert.equal(Number(!!a.idempotent)+Number(!!b.idempotent),1);
   assert.deepEqual(await state(),[4,0,1]);
  });
  await t.test("stale recovery and success finalize cannot both credit and consume",async()=>{
   await acc.update({period:period(),used:1,reserved:0,creditWalletRemaining:4});
   await svc.reserve(uid,make(3),ctx);
   const recording=acc.collection("recordings").doc(op(3));
   await recording.update({createdAt:admin.firestore.Timestamp.fromMillis(Date.now()-31*60*1000)});
   const responses=await Promise.allSettled([
    svc.recover(uid,{operationId:op(3),confirmNoVideo:true},ctx),
    svc.finalize(uid,{operationId:op(3),success:true,bytes:3100,filename:"p73-race.webm"},ctx)
   ]);
   const successful=responses.filter(x=>x.status==="fulfilled");
   const rejected=responses.filter(x=>x.status==="rejected");
   assert.equal(successful.length,1);
   assert.equal(rejected.length,1);
   assert.equal(rejected[0].reason.code,"failed-precondition");
   const a=await acc.get(),r=await recording.get();
   assert.equal(a.data().reserved,0);
   assert.ok(["failed","completed"].includes(r.data().status));
   if(r.data().status==="failed"){
    assert.equal(a.data().creditWalletRemaining,4);
    assert.equal(a.data().used,1);
   }else{
    assert.equal(a.data().creditWalletRemaining,3);
    assert.equal(a.data().used,2);
   }
  });
  await t.test("unknown plan cannot produce a refund or recovery",async()=>{
   await acc.update({plan:"UnknownPlan",reserved:1,creditWalletRemaining:4});
   await assert.rejects(svc.recover(uid,{operationId:op(3),confirmNoVideo:true},ctx),
    e=>e.code==="failed-precondition");
   await assert.rejects(svc.finalize(uid,{operationId:op(2),success:false},ctx),
    e=>e.code==="failed-precondition");
   assert.equal((await acc.get()).data().creditWalletRemaining,4);
  });
  await t.test("corrupted wallet reserve count rejects finalization without mutation",async()=>{
   await acc.update({plan:"Free",period:period(),reserved:0,creditWalletRemaining:3});
   await svc.reserve(uid,make(4),ctx);
   await acc.update({reserved:0});
   const before=(await acc.get()).data();
   await assert.rejects(svc.finalize(uid,{operationId:op(4),success:false},ctx),
    e=>e.code==="failed-precondition");
   const after=(await acc.get()).data();
   assert.equal(after.creditWalletRemaining,before.creditWalletRemaining);
   assert.equal((await acc.collection("recordings").doc(op(4)).get()).data().status,"reserved");
  });
 }finally{
  await Promise.allSettled([db.recursiveDelete(acc),lease.delete()]);
  await app.delete();
 }
});
