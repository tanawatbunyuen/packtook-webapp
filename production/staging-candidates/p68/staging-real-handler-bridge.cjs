"use strict";
/* P68 emulator-only integration of P65 authorization with P67 original handlers.
 * The production-bound Beta claims shim is created ONLY after a successful
 * per-request Staging auth+lease verification. No Cloud registration/deploy.
 */
const {createStagingGate}=require("../p65/staging-authorization.cjs");
const {loadRealHandlers,requireIsolatedEmulators}=require("../p67/real-handler-emulator-harness.cjs");
const NAMES=Object.freeze(["reserveCredit","finalizeCredit","recordingStatus",
 "recoverStaleVideoReservation","usageStatus"]);
function createBridge({db,auth,rawHandlers,env,now}){
 requireIsolatedEmulators();
 if(!db||!auth||typeof now!=="function"||!env||!rawHandlers)throw Error("P68_DEPENDENCIES_REQUIRED");
 const gate=createStagingGate({
  env,now,
  readControl:async()=>{
   const snap=await db.doc("pilotControls/p65").get();
   return snap.exists?snap.data():null;
  },
  readLiveUser:uid=>auth.getUser(uid)
 });
 const calls=Object.create(null);
 for(const name of NAMES){
  if(typeof rawHandlers[name]!=="function")throw Error("P68_HANDLER_MISSING");
  calls[name]=async req=>{
   // P65 fresh lease, Firebase Auth and app-id validation precede any
   // production callback (including Firestore mutation).
   const id=await gate.assertAuthorized(req);
   const uid=gate.uid(req);
   if(id!==uid)throw Error("P68_UID_MISMATCH");
   // TEST-ONLY bridge into original production uid() logic. The client token
   // is NEVER forwarded, and cannot choose/mint the Beta flag. No real
   // Production project or user claim is ever changed.
   const testReq=Object.freeze({
    auth:Object.freeze({uid,token:Object.freeze({
     email_verified:true,packtookProductionBeta:true
    })}),
    data:req.data&&typeof req.data==="object"?req.data:{}
   });
   return rawHandlers[name](testReq);
  };
 }
 return Object.freeze(calls);
}
function makeIntegratedEmulator({env,now}){
 requireIsolatedEmulators();
 const {db,auth,app,functions}=loadRealHandlers();
 return {db,auth,app,callables:createBridge({db,auth,rawHandlers:functions,env,now})};
}
module.exports={createBridge,makeIntegratedEmulator,NAMES};
