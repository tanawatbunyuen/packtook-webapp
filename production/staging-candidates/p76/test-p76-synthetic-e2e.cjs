"use strict";
/* P76 integrated local Auth + Firestore emulator journey. No real video,
 * browser camera, Functions callable transport, App Check or Omise payment.
 */
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createRequire}=require("node:module"),path=require("node:path");
const {createSyntheticBilling,PRICE_SATANG,CREDITS}=require("./synthetic-billing-fixture.cjs");
const UID="p76EndToEndDemo01",SESSION="s65_1234567890abcdef";
const DEVICE="p76_device00000001";
const OP1="p76_recording000001",OP2="p76_recording000002",OP3="p76_recording000003";
const INVOICE="p76_invoice0000001";
function guard(){
 if(process.env.GCLOUD_PROJECT!=="demo-packtook-p69"||
    process.env.GCP_PROJECT!=="demo-packtook-p69"||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9199"||
    process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8199"||
    process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
  throw Error("P76_EMULATOR_ONLY");
}
function control(uid){
 return {enabled:true,ownerApproved:true,legalApproved:true,
   policyVersion:"p65-staging-review-only",sessionId:SESSION,
   startedAt:new Date(Date.now()-60000).toISOString(),
   expiresAt:new Date(Date.now()+3600000).toISOString(),
   maxInvitedUsers:3,invitedUids:[uid]};
}
test("P76 synthetic signup/payment/packing/credit/recovery E2E on demo emulators",async t=>{
 guard();
 const load=createRequire(path.resolve(__dirname,"../p69/functions/package.json"));
 const admin=load("firebase-admin"),{FieldValue}=load("firebase-admin/firestore"),
  {HttpsError}=load("firebase-functions/v2/https");
 const {createCreditHandlers}=require("../p69/functions/credit-handlers.cjs");
 const app=admin.initializeApp({projectId:"demo-packtook-p69"},"p76-e2e-demo");
 const db=admin.firestore(app),auth=admin.auth(app);
 const credit=createCreditHandlers({db,FieldValue,HttpsError});
 const billing=createSyntheticBilling({db,FieldValue});
 const acct=db.collection("accounts").doc(UID),lease=db.doc("pilotControls/p65");
 const ctx={session:SESSION},record=n=>acct.collection("recordings").doc(n);
 const wallet=async()=>{const v=(await acct.get()).data();return [v.creditWalletRemaining,v.reserved,v.used];};
 try{
  try{await auth.deleteUser(UID);}catch(e){if(e.code!=="auth/user-not-found")throw e;}
  await t.test("unverified or unprovisioned Auth user receives no free grant",async()=>{
   await auth.createUser({uid:UID,email:"p76@invalid.example",emailVerified:false});
   assert.equal((await acct.get()).exists,false);
   await assert.rejects(billing.createInvoice(UID,INVOICE),/P76_ACCOUNT_NOT_ACTIVATED/);
  });
  await t.test("owner-provisioned test account, verified Auth and Pilot Lease",async()=>{
   await auth.updateUser(UID,{emailVerified:true});
   await auth.setCustomUserClaims(UID,{packtookStagingPilot:true,p65Session:SESSION});
   const live=await auth.getUser(UID);
   assert.equal(live.emailVerified,true);
   assert.equal(live.customClaims.p65Session,SESSION);
   await lease.set(control(UID));
   await acct.set({plan:"Free",period:new Date().toISOString().slice(0,7),
     creditWalletV1:true,creditWalletRemaining:1,walletStartingCredits:1,
     used:0,reserved:0,devices:[{id:DEVICE,name:"P76 Device"}]});
   assert.deepEqual(await wallet(),[1,0,0]);
  });
  await t.test("test invoice creates awaiting-payment only (no credits)",async()=>{
   const r=await billing.createInvoice(UID,INVOICE);
   assert.equal(r.created,true);assert.equal(r.status,"awaiting_payment");
   assert.deepEqual(await wallet(),[1,0,0]);
  });
  await t.test("client claim or mismatched amount cannot grant credits",async()=>{
   await assert.rejects(billing.applyProviderFixture(UID,INVOICE,
    {providerVerified:false,amountSatang:PRICE_SATANG}),/P76_PAYMENT_NOT_CONFIRMED/);
   await assert.rejects(billing.applyProviderFixture(UID,INVOICE,
    {providerVerified:true,amountSatang:PRICE_SATANG-1}),/P76_PAYMENT_NOT_CONFIRMED/);
   await assert.rejects(billing.applyProviderFixture(UID,INVOICE,
    {providerVerified:true,amountSatang:PRICE_SATANG,testOnly:false}),/P76_REAL_PROVIDER_FORBIDDEN/);
   assert.deepEqual(await wallet(),[1,0,0]);
  });
  await t.test("synthetic provider confirmation grants purchased credits exactly once",async()=>{
   const replies=await Promise.all([
    billing.applyProviderFixture(UID,INVOICE,{providerVerified:true,amountSatang:PRICE_SATANG}),
    billing.applyProviderFixture(UID,INVOICE,{providerVerified:true,amountSatang:PRICE_SATANG})
   ]);
   assert.equal(replies.filter(x=>x.credited).length,1);
   assert.equal(replies.filter(x=>x.idempotent).length,1);
   assert.deepEqual(await wallet(),[1+CREDITS,0,0]);
   assert.equal((await acct.get()).data().plan,"Basic");
  });
  await t.test("paid account reserves and completes synthetic recorded packing",async()=>{
   assert.equal((await credit.reserve(UID,{operationId:OP1,barcode:"P76-PACK-1",deviceId:DEVICE},ctx)).status,"reserved");
   assert.deepEqual(await wallet(),[CREDITS,1,0]);
   assert.equal((await credit.finalize(UID,{operationId:OP1,success:true,bytes:4096,filename:"synthetic-packing.webm"},ctx)).status,"completed");
   assert.deepEqual(await wallet(),[CREDITS,0,1]);
   assert.equal((await record(OP1).get()).data().status,"completed");
  });
  await t.test("failed packing returns one reserved credit",async()=>{
   await credit.reserve(UID,{operationId:OP2,barcode:"P76-PACK-2",deviceId:DEVICE},ctx);
   const d={operationId:OP2,success:false};
   const first=await credit.finalize(UID,d,ctx),again=await credit.finalize(UID,d,ctx);
   assert.equal(first.status,"failed");assert.equal(again.idempotent,true);
   assert.deepEqual(await wallet(),[CREDITS,0,1]);
  });
  await t.test("stale recording recovery never double-refunds",async()=>{
   await credit.reserve(UID,{operationId:OP3,barcode:"P76-PACK-3",deviceId:DEVICE},ctx);
   await record(OP3).update({createdAt:admin.firestore.Timestamp.fromMillis(Date.now()-31*60*1000)});
   const d={operationId:OP3,confirmNoVideo:true};
   const first=await credit.recover(UID,d,ctx),again=await credit.recover(UID,d,ctx);
   assert.equal(first.creditReturned,true);assert.equal(again.idempotent,true);
   assert.deepEqual(await wallet(),[CREDITS,0,1]);
  });
  await t.test("revoked pilot session blocks further packing without mutations",async()=>{
   await lease.update({enabled:false});
   await assert.rejects(credit.reserve(UID,
    {operationId:"p76_recording000004",barcode:"P76-PACK-4",deviceId:DEVICE},ctx),
    e=>e.code==="permission-denied");
   assert.deepEqual(await wallet(),[CREDITS,0,1]);
  });
 }finally{
  await Promise.allSettled([db.recursiveDelete(acct),lease.delete()]);
  try{await auth.deleteUser(UID);}catch{}
  await app.delete();
 }
});
