"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {makeIntegratedEmulator,NAMES}=require("./staging-real-handler-bridge.cjs");
const {requireIsolatedEmulators}=require("../p67/real-handler-emulator-harness.cjs");
const {StagingAuthorizationError}=require("../p65/staging-authorization.cjs");
const now=Date.parse("2026-11-17T12:00:00Z");
const uid="p68StagingTester01",session="s65_1234567890abcdef",appId="1:123:web:abcdef1234";
const device="p68_staging_device01";
const op1="p68_order000000001",op2="p68_order000000002",op3="p68_order000000003";
const period=()=>new Date().toISOString().slice(0,7);
const env=()=>({GCLOUD_PROJECT:"packtook-staging",
 PACKTOOK_STAGING_PILOT_ENABLED:"true",
 PACKTOOK_STAGING_PUBLIC_SIGNUP_ENABLED:"false",
 PACKTOOK_STAGING_PUBLIC_ACCESS_ENABLED:"false",
 PACKTOOK_STAGING_PILOT_APP_ID:appId});
const control=()=>({enabled:true,ownerApproved:true,legalApproved:true,
 policyVersion:"p65-staging-review-only",sessionId:session,maxInvitedUsers:3,
 startedAt:"2026-11-17T11:30:00Z",expiresAt:"2026-11-17T13:00:00Z",invitedUids:[uid]});
const claim=()=>({packtookStagingPilot:true,p65Session:session});
const req=(data={})=>({auth:{uid,token:{email_verified:true,...claim()}},app:{appId},data});
const denied=p=>assert.rejects(p,e=>e instanceof StagingAuthorizationError&&e.code==="PERMISSION_DENIED");
test("P68 Staging P65 lease + unchanged five production handlers via demo emulator",async t=>{
 requireIsolatedEmulators();
 const {db,auth,app,callables}=makeIntegratedEmulator({env:env(),now:()=>now});
 const account=db.doc("accounts/"+uid),lease=db.doc("pilotControls/p65");
 let userCreated=false;
 const wallet=async()=>{const a=(await account.get()).data();return [a.creditWalletRemaining,a.reserved,a.used]};
 try{
  try{await auth.deleteUser(uid);}catch(e){if(e.code!=="auth/user-not-found")throw e;}
  await auth.createUser({uid,email:"p68@example.invalid",emailVerified:true,disabled:false});
  userCreated=true;
  await auth.setCustomUserClaims(uid,claim());
  await lease.set(control());
  await account.set({plan:"Free",period:period(),used:0,reserved:0,
   creditWalletV1:true,creditWalletRemaining:3,walletStartingCredits:3,
   devices:[{id:device,name:"P68 Test Device"}]});
  await t.test("all five real callback exports present and bridged",()=>{
   assert.deepEqual(Object.keys(callables).sort(),[...NAMES].sort());
  });
  await t.test("anonymous and unverified caller denied without credit writes",async()=>{
   const a=req({operationId:op1,barcode:"P68-ONE",deviceId:device});delete a.auth;
   await denied(callables.reserveCredit(a));
   const b=req({operationId:op1,barcode:"P68-ONE",deviceId:device});
   b.auth.token.email_verified=false;
   await denied(callables.reserveCredit(b));
   assert.deepEqual(await wallet(),[3,0,0]);
  });
  await t.test("wrong app ID and forged Beta claim fail closed",async()=>{
   const a=req({operationId:op1,barcode:"P68-ONE",deviceId:device});
   a.app.appId="1:999:web:invalid";await denied(callables.reserveCredit(a));
   const b=req({operationId:op1,barcode:"P68-ONE",deviceId:device});
   b.auth.token.packtookProductionBeta=true;
   await denied(callables.reserveCredit(b));
   assert.deepEqual(await wallet(),[3,0,0]);
  });
  await t.test("valid pilot executes actual reserveCredit and records wallet debit",async()=>{
   const r=await callables.reserveCredit(req({operationId:op1,barcode:"P68-ONE",deviceId:device}));
   assert.equal(r.status,"reserved");assert.deepEqual(await wallet(),[2,1,0]);
  });
  await t.test("repeat reserve idempotent; no double debit",async()=>{
   const r=await callables.reserveCredit(req({operationId:op1,barcode:"P68-ONE",deviceId:device}));
   assert.equal(r.idempotent,true);assert.deepEqual(await wallet(),[2,1,0]);
  });
  await t.test("original recordingStatus and usageStatus report owner recording and wallet",async()=>{
   const r=await callables.recordingStatus(req({operationId:op1}));
   assert.equal(r.status,"reserved");
   const s=await callables.usageStatus(req());
   assert.equal(s.remaining,2);assert.equal(s.reserved,1);
  });
  await t.test("revoked Firestore pilot lease blocks all five callbacks without mutation",async()=>{
   await lease.update({enabled:false});
   const vectors={
    reserveCredit:{operationId:op2,barcode:"P68-TWO",deviceId:device},
    finalizeCredit:{operationId:op1,success:false},
    recordingStatus:{operationId:op1},
    recoverStaleVideoReservation:{operationId:op1,confirmNoVideo:true},
    usageStatus:{}
   };
   for(const name of NAMES)await denied(callables[name](req(vectors[name])));
   assert.deepEqual(await wallet(),[2,1,0]);
   assert.equal((await account.collection("recordings").doc(op1).get()).data().status,"reserved");
   await lease.update({enabled:true});
  });
  await t.test("disabled live Auth user blocks finalization and preserves reserved credit",async()=>{
   await auth.updateUser(uid,{disabled:true});
   await denied(callables.finalizeCredit(req({operationId:op1,success:false})));
   assert.deepEqual(await wallet(),[2,1,0]);
   await auth.updateUser(uid,{disabled:false});
  });
  await t.test("revoked live Auth claim blocks usage",async()=>{
   await auth.setCustomUserClaims(uid,{packtookStagingPilot:false,p65Session:session});
   await denied(callables.usageStatus(req()));
   await auth.setCustomUserClaims(uid,claim());
  });
  await t.test("real finalizeCredit success and replay cannot double use quota",async()=>{
   const d={operationId:op1,success:true,bytes:2048,filename:"p68.webm"};
   const once=await callables.finalizeCredit(req(d));
   const replay=await callables.finalizeCredit(req(d));
   assert.equal(once.status,"completed");assert.equal(replay.idempotent,true);
   assert.deepEqual(await wallet(),[2,0,1]);
  });
  await t.test("real failed finalization refunds exactly once",async()=>{
   await callables.reserveCredit(req({operationId:op2,barcode:"P68-TWO",deviceId:device}));
   assert.deepEqual(await wallet(),[1,1,1]);
   const payload={operationId:op2,success:false};
   assert.equal((await callables.finalizeCredit(req(payload))).status,"failed");
   assert.equal((await callables.finalizeCredit(req(payload))).idempotent,true);
   assert.deepEqual(await wallet(),[2,0,1]);
  });
  await t.test("real recoverStaleVideoReservation checks age and refunds exactly once",async()=>{
   await callables.reserveCredit(req({operationId:op3,barcode:"P68-THREE",deviceId:device}));
   const payload={operationId:op3,confirmNoVideo:true};
   await assert.rejects(callables.recoverStaleVideoReservation(req(payload)),e=>e.code==="failed-precondition");
   const fb=require("node:module").createRequire(require("node:path").resolve(__dirname,"../../functions/package.json"))("firebase-admin");
   await account.collection("recordings").doc(op3).update({
    createdAt:fb.firestore.Timestamp.fromMillis(Date.now()-31*60*1000)
   });
   const first=await callables.recoverStaleVideoReservation(req(payload));
   const second=await callables.recoverStaleVideoReservation(req(payload));
   assert.equal(first.creditReturned,true);assert.equal(second.idempotent,true);
   assert.deepEqual(await wallet(),[2,0,1]);
  });
  await t.test("expired pilot lease blocks usage even with valid emulator user",async()=>{
   await lease.update({expiresAt:"2026-11-17T11:59:59Z"});
   await denied(callables.usageStatus(req()));
  });
 }finally{
  await Promise.allSettled([db.recursiveDelete(account),lease.delete()]);
  if(userCreated)await auth.deleteUser(uid);
  await app.delete();
 }
});
