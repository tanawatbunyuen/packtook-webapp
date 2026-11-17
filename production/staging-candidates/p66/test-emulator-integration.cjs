"use strict";
/* P66 real Auth+Firestore emulator integration, synthetic UID and demo project only.
 * NO connection to real packtook-staging, no real callables or production data.
 */
const {test}=require("node:test"),assert=require("node:assert/strict");
const {connect,makeGate,requireEmulators}=require("./emulator-adapter.cjs");
const UID="p66StagingUser01",APPID="1:123:web:abcdef1234",SESSION="s65_1234567890abcdef";
const frozen=Date.parse("2026-11-17T12:00:00Z");
function environment(){return {GCLOUD_PROJECT:"packtook-staging",
 PACKTOOK_STAGING_PILOT_ENABLED:"true",
 PACKTOOK_STAGING_PUBLIC_SIGNUP_ENABLED:"false",
 PACKTOOK_STAGING_PUBLIC_ACCESS_ENABLED:"false",
 PACKTOOK_STAGING_PILOT_APP_ID:APPID};}
function control(){return {enabled:true,ownerApproved:true,legalApproved:true,
 policyVersion:"p65-staging-review-only",sessionId:SESSION,
 startedAt:"2026-11-17T11:30:00Z",expiresAt:"2026-11-17T13:00:00Z",
 maxInvitedUsers:3,invitedUids:[UID]};}
function request(){return {app:{appId:APPID},auth:{uid:UID,
 token:{email_verified:true,packtookStagingPilot:true,p65Session:SESSION}}};}
function liveClaims(){return {packtookStagingPilot:true,p65Session:SESSION};}
async function forbidden(promise){await assert.rejects(promise,e=>e.code==="PERMISSION_DENIED");}
test("P66 Auth and Firestore emulator integration (isolated project)",async t=>{
 requireEmulators();
 const {admin,app,auth,db}=connect();
 const ctrl=db.doc("pilotControls/p65"),wallet=db.doc("p66Wallets/"+UID),reservation=db.doc("p66Reservations/orderA");
 let live=null;
 try{
   try{await auth.deleteUser(UID);}catch(e){if(e.code!=="auth/user-not-found")throw e;}
   live=await auth.createUser({uid:UID,email:"p66@example.invalid",emailVerified:true,disabled:false});
   await auth.setCustomUserClaims(UID,liveClaims());
   await ctrl.set(control());
   const gate=makeGate({auth,db,env:environment(),now:()=>frozen});
   await t.test("valid emulator Auth user + Firestore lease",async()=>{
     const result=await gate.wrapReadOnly(async (_,{uid})=>uid())(request());
     assert.equal(result,UID);
   });
   await t.test("revoke Firestore lease and reject next request",async()=>{
     await ctrl.update({enabled:false});
     await forbidden(gate.assertAuthorized(request()));
     await ctrl.update({enabled:true});
   });
   await t.test("wrong App ID rejected with real live reads available",async()=>{
     const x=request();x.app.appId="1:123:web:incorrect";
     await forbidden(gate.assertAuthorized(x));
   });
   await t.test("expired Firestore lease rejected",async()=>{
     await ctrl.update({expiresAt:"2026-11-17T11:00:00Z"});
     await forbidden(gate.assertAuthorized(request()));
     await ctrl.update({expiresAt:control().expiresAt});
   });
   await t.test("removed invite rejected",async()=>{
     await ctrl.update({invitedUids:["notInvited1234"]});
     await forbidden(gate.assertAuthorized(request()));
     await ctrl.update({invitedUids:[UID]});
   });
   await t.test("disabled emulator Auth user denied",async()=>{
     await auth.updateUser(UID,{disabled:true});
     await forbidden(gate.assertAuthorized(request()));
     await auth.updateUser(UID,{disabled:false});
   });
   await t.test("revoked live Auth custom claim rejected",async()=>{
     await auth.setCustomUserClaims(UID,{packtookStagingPilot:false,p65Session:SESSION});
     await forbidden(gate.assertAuthorized(request()));
     await auth.setCustomUserClaims(UID,liveClaims());
   });
   await t.test("live session mismatch rejected",async()=>{
     await auth.setCustomUserClaims(UID,{packtookStagingPilot:true,p65Session:"s65_0000000000000000"});
     await forbidden(gate.assertAuthorized(request()));
     await auth.setCustomUserClaims(UID,liveClaims());
   });
   await t.test("token production claim denied even when Staging lease active",async()=>{
     const x=request();x.auth.token.packtookProductionBeta=true;
     await forbidden(gate.assertAuthorized(x));
   });
   await t.test("Firestore emulated credit reservation / finalize idempotency (synthetic)",async()=>{
     await gate.assertAuthorized(request());
     await wallet.set({remaining:2,reserved:0,used:0});
     async function reserve(){
       return db.runTransaction(async tx=>{
         const [r,w]=await Promise.all([tx.get(reservation),tx.get(wallet)]);
         if(r.exists)return "ALREADY_RESERVED";
         if(w.data().remaining<=0)return "NO_CREDIT";
         tx.create(reservation,{status:"reserved",returned:false});
         tx.update(wallet,{remaining:w.data().remaining-1,reserved:w.data().reserved+1});
         return "RESERVED";
       });
     }
     assert.equal(await reserve(),"RESERVED");
     assert.equal(await reserve(),"ALREADY_RESERVED");
     await db.runTransaction(async tx=>{
       const [r,w]=await Promise.all([tx.get(reservation),tx.get(wallet)]);
       if(r.data().status!=="reserved")return;
       tx.update(reservation,{status:"finalized"});
       tx.update(wallet,{reserved:w.data().reserved-1,used:w.data().used+1});
     });
     const data=(await wallet.get()).data();
     assert.deepEqual({remaining:data.remaining,reserved:data.reserved,used:data.used},
       {remaining:1,reserved:0,used:1});
   });
   await t.test("synthetic reservation recovery returns credit once",async()=>{
     const op=db.doc("p66Reservations/orderB");
     await op.set({status:"reserved",returned:false});
     await wallet.update({remaining:0,reserved:1});
     async function recover(){
       return db.runTransaction(async tx=>{
         const [r,w]=await Promise.all([tx.get(op),tx.get(wallet)]);
         if(r.data().status!=="reserved"||r.data().returned)return false;
         tx.update(op,{status:"failed",returned:true});
         tx.update(wallet,{remaining:w.data().remaining+1,reserved:w.data().reserved-1});
         return true;
       });
     }
     assert.equal(await recover(),true);
     assert.equal(await recover(),false);
     const w=(await wallet.get()).data();
     assert.equal(w.remaining,1);assert.equal(w.reserved,0);
   });
   await t.test("deny-all Firestore rules are present (Admin emulator bypass is not rules proof)",async()=>{
     const rules=require("node:fs").readFileSync(require("node:path").join(__dirname,"firestore.rules"),"utf8");
     assert.match(rules,/allow read, write: if false;/);
   });
 }finally{
   await Promise.allSettled([ctrl.delete(),wallet.delete(),reservation.delete(),
       db.doc("p66Reservations/orderB").delete()]);
   if(live)await auth.deleteUser(UID);
   await app.delete();
 }
});
