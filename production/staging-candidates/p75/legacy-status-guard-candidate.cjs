"use strict";
/*
 * P75 isolated implementation candidate for the two EXISTING Staging callable
 * names affected by P63 guard drift. REVIEW-ONLY: not imported/registered by
 * production/functions/index.js, any firebase.json, or live Cloud Functions.
 * Reuses P69 protected Callable wrapper only when explicitly integrated in a
 * separately authorized staging release; never adds an unguarded bypass.
 */
const OP=/^[A-Za-z0-9_-]{16,100}$/;
function legacyReadOnlyCandidate({protect,db,usageResponse,HttpsError}){
 if(typeof protect!=="function"||!db||typeof db.collection!=="function"||
    typeof usageResponse!=="function"||typeof HttpsError!=="function")
  throw Error("P75_DEPENDENCIES_REQUIRED");
 const usageStatus=protect(async uid=>{
  const snap=await db.collection("accounts").doc(uid).get();
  if(!snap.exists)throw new HttpsError("failed-precondition","Account not provisioned");
  return usageResponse(snap.data());
 });
 const recordingStatus=protect(async(uid,data)=>{
  const op=data?.operationId;
  if(typeof op!=="string"||!OP.test(op))
   throw new HttpsError("invalid-argument","Invalid operation ID");
  const snap=await db.collection("accounts").doc(uid)
   .collection("recordings").doc(op).get();
  if(!snap.exists)throw new HttpsError("not-found","Recording reservation not found");
  const r=snap.data();
  return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file??null};
 });
 return Object.freeze({recordingStatus,usageStatus});
}
module.exports={legacyReadOnlyCandidate};
