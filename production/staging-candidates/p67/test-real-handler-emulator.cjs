"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {loadRealHandlers,requireIsolatedEmulators}=require("./real-handler-emulator-harness.cjs");
const USER="p67TestUser0001",OTHER="p67OtherUser01";
const DEVICE="p67_device0000001";
const SESSION="p67_operation00001";
const TWO="p67_operation00002";
const THREE="p67_operation00003";
const FOUR="p67_operation00004";
const LATE="p67_operation00005";
const BAR="P67-TEST-BARCODE-1";
const period=()=>new Date().toISOString().slice(0,7);
const beta=(uid=USER,data={})=>({auth:{uid,token:{email_verified:true,packtookProductionBeta:true}},data});
const anon=(data={})=>({data});
const err=(code)=>e=>e&&e.code===code;
test("P67 original Firebase handler module + real Firestore emulator transactions",async t=>{
 requireIsolatedEmulators();
 const {db,app,functions,auth}=loadRealHandlers();
 const account=db.doc("accounts/"+USER),other=db.doc("accounts/"+OTHER);
 const recordings=account.collection("recordings");
 try{
  // Account is seeded so no public activation or provisioning function runs.
  await account.set({plan:"Free",period:period(),used:0,reserved:0,
    creditWalletV1:true,creditWalletRemaining:3,walletStartingCredits:3,
    devices:[{id:DEVICE,name:"P67 Demo Device"}]});
  await other.set({plan:"Free",period:period(),used:0,reserved:0,
    creditWalletV1:true,creditWalletRemaining:2,walletStartingCredits:2,
    devices:[{id:DEVICE,name:"Other Test Device"}]});
  await t.test("uses exactly the five original exported functions",()=>{
   for(const n of ["reserveCredit","finalizeCredit","recordingStatus",
    "recoverStaleVideoReservation","usageStatus"])assert.equal(typeof functions[n],"function");
  });
  await t.test("unauthenticated and unverified requests are denied",async()=>{
   await assert.rejects(functions.usageStatus(anon()),err("unauthenticated"));
   await assert.rejects(functions.usageStatus({auth:{uid:USER,token:{email_verified:false,packtookProductionBeta:true}},data:{}}),err("permission-denied"));
  });
  await t.test("request without Beta grant cannot access account",async()=>{
   const r={auth:{uid:USER,token:{email_verified:true}},data:{}};
   await assert.rejects(functions.usageStatus(r),err("permission-denied"));
  });
  await t.test("read-only usageStatus reports seeded three credits",async()=>{
   const usage=await functions.usageStatus(beta());
   assert.equal(usage.walletEnabled,true);assert.equal(usage.remaining,3);
   assert.equal(usage.reserved,0);
  });
  await t.test("unknown device cannot reserve credit",async()=>{
   await assert.rejects(functions.reserveCredit(beta(USER,{operationId:SESSION,barcode:BAR,deviceId:"p67_wrongDevice001"})),err("permission-denied"));
  });
  await t.test("reserveCredit commits genuine wallet/reservation/barcode transaction",async()=>{
   const r=await functions.reserveCredit(beta(USER,{operationId:SESSION,barcode:BAR,deviceId:DEVICE}));
   assert.equal(r.status,"reserved");assert.equal(r.remaining,2);
   const saved=(await recordings.doc(SESSION).get()).data();
   assert.equal(saved.barcode,BAR);assert.equal(saved.status,"reserved");
   const a=(await account.get()).data();
   assert.equal(a.reserved,1);assert.equal(a.creditWalletRemaining,2);
  });
  await t.test("same operation and barcode idempotent; no second debit",async()=>{
   const r=await functions.reserveCredit(beta(USER,{operationId:SESSION,barcode:BAR,deviceId:DEVICE}));
   assert.equal(r.idempotent,true);
   const a=(await account.get()).data();
   assert.equal(a.reserved,1);assert.equal(a.creditWalletRemaining,2);
  });
  await t.test("same operation with different barcode rejects",async()=>{
   await assert.rejects(functions.reserveCredit(beta(USER,{operationId:SESSION,barcode:"P67-DIFFERENT",deviceId:DEVICE})),err("already-exists"));
  });
  await t.test("duplicate barcode on a different operation rejects",async()=>{
   await assert.rejects(functions.reserveCredit(beta(USER,{operationId:TWO,barcode:BAR,deviceId:DEVICE})),err("already-exists"));
  });
  await t.test("recordingStatus reads owner recording but not a different account",async()=>{
   const r=await functions.recordingStatus(beta(USER,{operationId:SESSION}));
   assert.equal(r.status,"reserved");assert.equal(r.barcode,BAR);
   await assert.rejects(functions.recordingStatus(beta(OTHER,{operationId:SESSION})),err("not-found"));
  });
  await t.test("finalizeCredit real success increments used, decrements reserved once",async()=>{
   const data={operationId:SESSION,success:true,bytes:4096,filename:"test.webm"};
   const result=await functions.finalizeCredit(beta(USER,data));
   assert.equal(result.status,"completed");
   const second=await functions.finalizeCredit(beta(USER,data));
   assert.equal(second.idempotent,true);
   const a=(await account.get()).data();
   assert.equal(a.used,1);assert.equal(a.reserved,0);assert.equal(a.creditWalletRemaining,2);
  });
  await t.test("finalize cannot flip a completed reservation to failed",async()=>{
   await assert.rejects(functions.finalizeCredit(beta(USER,{operationId:SESSION,success:false})),err("failed-precondition"));
  });
  await t.test("failed finalization refunds exactly one wallet credit",async()=>{
   const barcode="P67-FAIL-BARCODE";
   await functions.reserveCredit(beta(USER,{operationId:TWO,barcode,deviceId:DEVICE}));
   const once=await functions.finalizeCredit(beta(USER,{operationId:TWO,success:false}));
   assert.equal(once.status,"failed");
   const twice=await functions.finalizeCredit(beta(USER,{operationId:TWO,success:false}));
   assert.equal(twice.idempotent,true);
   const a=(await account.get()).data();
   assert.equal(a.creditWalletRemaining,2);assert.equal(a.reserved,0);assert.equal(a.used,1);
  });
  await t.test("manual recovery requires explicit confirmation",async()=>{
   await assert.rejects(functions.recoverStaleVideoReservation(beta(USER,{operationId:THREE})),err("invalid-argument"));
  });
  await t.test("recent reservation cannot be recovered early",async()=>{
   await functions.reserveCredit(beta(USER,{operationId:THREE,barcode:"P67-RECENT-BAR",deviceId:DEVICE}));
   await assert.rejects(functions.recoverStaleVideoReservation(beta(USER,{operationId:THREE,confirmNoVideo:true})),err("failed-precondition"));
  });
  await t.test("stale reservation recovers and refunds once",async()=>{
   const admin=require("node:module").createRequire(require("node:path").resolve(__dirname,"../../functions/package.json"))("firebase-admin");
   const doc=recordings.doc(THREE);
   await doc.update({createdAt:admin.firestore.Timestamp.fromMillis(Date.now()-31*60*1000)});
   const payload={operationId:THREE,confirmNoVideo:true};
   const r=await functions.recoverStaleVideoReservation(beta(USER,payload));
   assert.equal(r.status,"failed");assert.equal(r.creditReturned,true);
   const again=await functions.recoverStaleVideoReservation(beta(USER,payload));
   assert.equal(again.idempotent,true);
   const a=(await account.get()).data();
   assert.equal(a.creditWalletRemaining,2);assert.equal(a.reserved,0);
  });
  await t.test("cross-account finalization fails without touching wallet",async()=>{
   await assert.rejects(functions.finalizeCredit(beta(OTHER,{operationId:SESSION,success:false})),err("not-found"));
   const a=(await other.get()).data();assert.equal(a.creditWalletRemaining,2);
  });
  await t.test("unknown plan fails closed in genuine usageStatus",async()=>{
   await account.update({plan:"UnknownPlan"});
   await assert.rejects(functions.usageStatus(beta()),err("failed-precondition"));
   await account.update({plan:"Free"});
  });
  await t.test("handler refuses to recover a completed recording",async()=>{
   await assert.rejects(functions.recoverStaleVideoReservation(beta(USER,{operationId:SESSION,confirmNoVideo:true})),err("failed-precondition"));
  });
  await t.test("read-only usage after all operations is stable",async()=>{
   const a=await functions.usageStatus(beta());
   assert.equal(a.remaining,2);assert.equal(a.reserved,0);assert.equal(a.used,1);
  });
 }finally{
  // Isolated demo emulator database is discarded at shutdown; individual test
  // documents are still removed to keep repeated local runs predictable.
  await db.recursiveDelete(account).catch(()=>{});
  await db.recursiveDelete(other).catch(()=>{});
  await app.delete();
 }
});
