"use strict";
/* P71 targeted parity: original semantics versus P70 staging candidate,
   using actual demo Firestore transactions, not a fabricated transaction mock.
 */
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createRequire}=require("node:module"),path=require("node:path"),crypto=require("node:crypto");
const uid="p71ParityUser01",session="s65_1234567890abcdef";
const device="p71_device00000001";
const op1="p71_operation0000001",op2="p71_operation0000002";
const approval="p71_approval0000001",requestId="p71_request00000001";
const barcode="P71-APPROVED-DUPLICATE";
const period=()=>new Date().toISOString().slice(0,7);
function guard(){
 if(process.env.GCLOUD_PROJECT!=="demo-packtook-p69"||
    process.env.GCP_PROJECT!=="demo-packtook-p69"||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9199"||
    process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8199"||
    process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
  throw Error("P71_DEMO_ONLY");
}
function lease(){
 return {enabled:true,ownerApproved:true,legalApproved:true,
 policyVersion:"p65-staging-review-only",sessionId:session,
 startedAt:new Date(Date.now()-60000).toISOString(),
 expiresAt:new Date(Date.now()+3600000).toISOString(),
 maxInvitedUsers:3,invitedUids:[uid]};
}
test("P71 duplicate-approval request bookkeeping and credit boundary parity",async t=>{
 guard();
 const requireSDK=createRequire(path.resolve(__dirname,"functions/package.json"));
 const admin=requireSDK("firebase-admin"),{FieldValue}=requireSDK("firebase-admin/firestore");
 const {HttpsError}=requireSDK("firebase-functions/v2/https");
 const {createCreditHandlers}=require("./functions/credit-handlers.cjs");
 const app=admin.initializeApp({projectId:"demo-packtook-p69"},"p71-parity-demo");
 const db=admin.firestore(app),svc=createCreditHandlers({db,FieldValue,HttpsError});
 const acc=db.collection("accounts").doc(uid),ctl=db.doc("pilotControls/p65");
 const rec=acc.collection("recordings").doc(op2);
 const lock=acc.collection("barcodeLocks").doc(crypto.createHash("sha256").update(barcode).digest("hex"));
 const approved=acc.collection("duplicateApprovals").doc(approval);
 const request=acc.collection("duplicateRequests").doc(requestId);
 const ctx={session};
 try{
  await ctl.set(lease());
  await acc.set({plan:"Free",period:period(),creditWalletV1:true,
   creditWalletRemaining:4,reserved:0,used:0,
   devices:[{id:device,name:"P71 Synthetic Device"}]});
  await lock.set({operationId:op1,barcode,status:"completed"});
  await approved.set({status:"approved",barcode,requestedBy:uid,
   requestId,expiresAtMs:Date.now()+300000});
  await request.set({status:"approved",barcode});
  await t.test("duplicate approval consumes both approval and linked request",async()=>{
   const r=await svc.reserve(uid,{operationId:op2,barcode,deviceId:device,approvalId:approval},ctx);
   assert.equal(r.status,"reserved");
   assert.equal((await approved.get()).data().status,"consumed");
   const q=(await request.get()).data();
   assert.equal(q.status,"consumed");assert.equal(q.consumedBy,op2);
   assert.equal((await rec.get()).data().overrideOf,op1);
   assert.equal((await acc.get()).data().creditWalletRemaining,3);
  });
  await t.test("idempotent approval replay does not debit a second credit",async()=>{
   const r=await svc.reserve(uid,{operationId:op2,barcode,deviceId:device,approvalId:approval},ctx);
   assert.equal(r.idempotent,true);
   assert.equal((await acc.get()).data().creditWalletRemaining,3);
  });
  await t.test("failed override finalization restores completed previous barcode lock",async()=>{
   const r=await svc.finalize(uid,{operationId:op2,success:false},ctx);
   assert.equal(r.status,"failed");
   const data=(await lock.get()).data();
   assert.equal(data.operationId,op1);assert.equal(data.status,"completed");
   assert.equal((await acc.get()).data().creditWalletRemaining,4);
  });
  await t.test("Pro plan remains unlimited without creditWalletRemaining mutation",async()=>{
   await acc.update({plan:"Pro",creditWalletV1:true,creditWalletRemaining:4});
   const r=await svc.reserve(uid,{
    operationId:"p71_operation0000003",barcode:"P71-UNLIMITED",
    deviceId:device},ctx);
   assert.equal(r.remaining,null);
   assert.equal((await acc.get()).data().creditWalletRemaining,4);
   await svc.finalize(uid,{operationId:"p71_operation0000003",success:false},ctx);
   assert.equal((await acc.get()).data().creditWalletRemaining,4);
  });
 }finally{
  await Promise.allSettled([db.recursiveDelete(acc),ctl.delete()]);
  await app.delete();
 }
});
