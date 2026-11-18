"use strict";
/* P81 isolated legacy function-name remediation candidate. NEVER loaded by
 * production/firebase.json or P69 index; no Cloud deployment.
 * Avoid reusing the Production-bound guardedCall: P65 Staging gate only.
 */
const {createStagingGate}=require("../p69/functions/staging-authorization.cjs");
const {legacyReadOnlyCandidate}=require("../p75/legacy-status-guard-candidate.cjs");
function createP81LegacyHandlers({db,auth,onCall,HttpsError,usageResponse,
 env,now=Date.now}){
 if(!db||!auth||typeof auth.getUser!=="function"||
   typeof onCall!=="function"||typeof HttpsError!=="function"||
   typeof usageResponse!=="function"||typeof now!=="function")
  throw Error("P81_STAGING_DEPENDENCIES_REQUIRED");
 const options=Object.freeze({region:"asia-southeast1",maxInstances:1,
  timeoutSeconds:30,enforceAppCheck:true,consumeAppCheckToken:false});
 function protect(handler){
  return onCall(options,async request=>{
   try{
    const gate=createStagingGate({env,now,
     readControl:async()=>{
      const snap=await db.doc("pilotControls/p65").get();
      return snap.exists?snap.data():null;
     },
     readLiveUser:uid=>auth.getUser(uid)});
    const authorized=await gate.assertAuthorized(request);
    if(gate.uid(request)!==authorized)
     throw Error("P81_UID_INCONSISTENT");
    return await handler(authorized,request.data||{});
   }catch(error){
    if(error instanceof HttpsError)throw error;
    if(error?.name==="StagingAuthorizationError")
     throw new HttpsError("permission-denied","Staging pilot authorization required");
    throw new HttpsError("internal","Staging request could not be processed");
   }
  });
 }
 return legacyReadOnlyCandidate({protect,db,usageResponse,HttpsError});
}
module.exports={createP81LegacyHandlers};
