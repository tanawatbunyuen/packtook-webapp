"use strict";
/* P98 strictly unregistered Staging candidate. No Firebase import/exports.
 * Composes P81 authorization with P97 existing-account usage projection.
 * This intentionally does NOT reproduce legacy ensureAccount auto-creation.
 */
const {createP81LegacyHandlers}=require("../p81/legacy-status-live-gate-candidate.cjs");
const {projectUsageStatus}=require("../p97/status-contract-projection.cjs");
function createP98GuardedStatusHandlers({db,auth,onCall,HttpsError,env,now=Date.now}={}){
 if(typeof now!=="function"||typeof HttpsError!=="function")
  throw Error("P98_DEPENDENCIES_REQUIRED");
 return createP81LegacyHandlers({
  db,auth,onCall,HttpsError,env,now,
  usageResponse:account=>projectUsageStatus(account,{now:now(),HttpsError})
 });
}
module.exports={createP98GuardedStatusHandlers};
