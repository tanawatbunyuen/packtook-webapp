"use strict";
/* P70 direct credit implementation against REAL local Firestore Emulator.
 * App Check/onCall positive transport is NOT proven; see negative HTTP suite.
 */
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createRequire}=require("node:module"),path=require("node:path");
const uid="p70DemoUser001",session="s65_1234567890abcdef";
const device="p70_device00000001";
const op=n=>"p70_operation_"+String(n).padStart(5,"0");
const period=()=>new Date().toISOString().slice(0,7);
const c=()=>({enabled:true,ownerApproved:true,legalApproved:true,
 policyVersion:"p65-staging-review-only",sessionId:session,
 startedAt:new Date(Date.now()-60*1000).toISOString(),
 expiresAt:new Date(Date.now()+45*60*1000).toISOString(),
 maxInvitedUsers:3,invitedUids:[uid]});
function guard(){
 if(process.env.GCLOUD_PROJECT!=="demo-packtook-p69"||
 process.env.GCP_PROJECT!=="demo-packtook-p69"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9199"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8199"||
 process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
 throw Error("P70_DEMO_ONLY");
}
test("P70 live Firestore credit/recovery transactional invariants",async t=>{
 guard();
 const appRequire=createRequire(path.resolve(__dirname,"functions/package.json"));
 const admin=appRequire("firebase-admin");
 const app=admin.initializeApp({projectId:"demo-packtook-p69"},"p70-credit-test");
 const db=admin.firestore(app),{HttpsError}=appRequire("firebase-functions/v2/https");
 const {createCreditHandlers}=require("./functions/credit-handlers.cjs");
 const {FieldValue}=appRequire("firebase-admin/firestore");
 const svc=createCreditHandlers({db,FieldValue,HttpsError});
 const acc=db.collection("accounts").doc(uid),lease=db.doc("pilotControls/p65");
 const ctx={session};
 const state=async()=>{const d=(await acc.get()).data();return [d.creditWalletRemaining,d.reserved,d.used];};
 const make=(n,barcode)=>({operationId:op(n),barcode,deviceId:device});
 const code=e=>e&&typeof e.code==="string";
 try{
  await lease.set(c());
  await acc.set({plan:"Free",period:period(),used:0,reserved:0,
   creditWalletV1:true,creditWalletRemaining:3,walletStartingCredits:3,
   devices:[{id:device,name:"Demo P70"}]});
  await t.test("reserve and exact replay preserve credit",async()=>{
   const a=await svc.reserve(uid,make(1,"P70-BAR-ONE"),ctx);
   assert.equal(a.status,"reserved");assert.equal(a.remaining,2);
   const b=await svc.reserve(uid,make(1,"P70-BAR-ONE"),ctx);
   assert.equal(b.idempotent,true);assert.deepEqual(await state(),[2,1,0]);
  });
  await t.test("wrong barcode on same operation and duplicate lock fail",async()=>{
   await assert.rejects(svc.reserve(uid,make(1,"P70-CHANGED"),ctx),code);
   await assert.rejects(svc.reserve(uid,make(2,"P70-BAR-ONE"),ctx),code);
   assert.deepEqual(await state(),[2,1,0]);
  });
  await t.test("revocation inside transaction denies mutation",async()=>{
   await lease.update({enabled:false});
   await assert.rejects(svc.reserve(uid,make(2,"P70-BAR-TWO"),ctx),e=>e.code==="permission-denied");
   await assert.rejects(svc.finalize(uid,{operationId:op(1),success:false},ctx),
    e=>e.code==="permission-denied");
   assert.deepEqual(await state(),[2,1,0]);
   await lease.update({enabled:true});
  });
  await t.test("wrong invitation session denies mutation",async()=>{
   await assert.rejects(svc.reserve(uid,make(2,"P70-BAR-TWO"),{session:"bad"}),
    e=>e.code==="permission-denied");
   assert.deepEqual(await state(),[2,1,0]);
  });
  await t.test("success finalization uses one credit and replay is idempotent",async()=>{
   const d={operationId:op(1),success:true,bytes:4096,filename:"ok.webm"};
   const a=await svc.finalize(uid,d,ctx),b=await svc.finalize(uid,d,ctx);
   assert.equal(a.status,"completed");assert.equal(b.idempotent,true);
   assert.deepEqual(await state(),[2,0,1]);
  });
  await t.test("cannot reverse completed into failed",async()=>{
   await assert.rejects(svc.finalize(uid,{operationId:op(1),success:false},ctx),
    e=>e.code==="failed-precondition");
  });
  await t.test("failure refund credited once",async()=>{
   await svc.reserve(uid,make(2,"P70-BAR-TWO"),ctx);
   const a=await svc.finalize(uid,{operationId:op(2),success:false},ctx);
   const b=await svc.finalize(uid,{operationId:op(2),success:false},ctx);
   assert.equal(a.status,"failed");assert.equal(b.idempotent,true);
   assert.deepEqual(await state(),[2,0,1]);
  });
  await t.test("recent reservation recovery denied then stale recover once",async()=>{
   await svc.reserve(uid,make(3,"P70-BAR-THREE"),ctx);
   await assert.rejects(svc.recover(uid,{operationId:op(3),confirmNoVideo:true},ctx),
     e=>e.code==="failed-precondition");
   await acc.collection("recordings").doc(op(3)).update({
     createdAt:admin.firestore.Timestamp.fromMillis(Date.now()-31*60*1000)
   });
   const a=await svc.recover(uid,{operationId:op(3),confirmNoVideo:true},ctx);
   const b=await svc.recover(uid,{operationId:op(3),confirmNoVideo:true},ctx);
   assert.equal(a.creditReturned,true);assert.equal(b.idempotent,true);
   assert.deepEqual(await state(),[2,0,1]);
  });
  await t.test("concurrent unique operations cannot overspend wallet",async()=>{
   const operations=[4,5,6];
   const replies=await Promise.allSettled(operations.map(n=>svc.reserve(uid,make(n,"P70-BAR-"+n),ctx)));
   const success=replies.filter(r=>r.status==="fulfilled");
   const failure=replies.filter(r=>r.status==="rejected");
   assert.equal(success.length,2);
   assert.equal(failure.length,1);
   assert.equal(failure[0].reason.code,"resource-exhausted");
   assert.deepEqual(await state(),[0,2,1]);
  });
  await t.test("recovery not allowed for already completed recording",async()=>{
   await assert.rejects(svc.recover(uid,{operationId:op(1),confirmNoVideo:true},ctx),
    e=>e.code==="failed-precondition");
   assert.deepEqual(await state(),[0,2,1]);
  });
  await t.test("expired lease causes all mutation callbacks to deny",async()=>{
   await lease.update({expiresAt:new Date(Date.now()-5000).toISOString()});
   await assert.rejects(svc.reserve(uid,make(9,"P70-BAR-9"),ctx),
    e=>e.code==="permission-denied");
   await assert.rejects(svc.finalize(uid,{operationId:op(4),success:false},ctx),
    e=>e.code==="permission-denied");
   assert.deepEqual(await state(),[0,2,1]);
  });
 }finally{
  await Promise.allSettled([db.recursiveDelete(acc),lease.delete()]);
  await app.delete();
 }
});
