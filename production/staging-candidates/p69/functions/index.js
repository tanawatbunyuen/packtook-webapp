"use strict";
/* P69 REVIEW-ONLY staging callable runtime candidate. Not registered in main
 * production/firebase.json. Never deploy without separate owner approval.
 * Real Firebase onCall transport and explicit App Check enforcement.
 */
const admin=require("firebase-admin");
const {FieldValue}=require("firebase-admin/firestore");
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {createStagingGate}=require("./staging-authorization.cjs");
const {createCreditHandlers}=require("./credit-handlers.cjs");
const {usageResponse}=require("./p72-account-semantics.cjs");
admin.initializeApp();
const db=admin.firestore();
const auth=admin.auth();
const region="asia-southeast1";
const options=Object.freeze({region,maxInstances:1,timeoutSeconds:30,
 enforceAppCheck:true,consumeAppCheckToken:false});
const DEMO="demo-packtook-p69";
const NOW=()=>Date.now();
function approvedEnvironment(){
 const p=process.env.GCLOUD_PROJECT||process.env.GCP_PROJECT||"";
 const q=process.env.GCP_PROJECT||p;
 const demo=p===DEMO&&q===DEMO&&process.env.FUNCTIONS_EMULATOR==="true"&&
  process.env.FIREBASE_AUTH_EMULATOR_HOST==="127.0.0.1:9199"&&
  process.env.FIRESTORE_EMULATOR_HOST==="127.0.0.1:8199"&&
  !process.env.GOOGLE_APPLICATION_CREDENTIALS;
 if(demo){
  return {GCLOUD_PROJECT:"packtook-staging",
   PACKTOOK_STAGING_PILOT_ENABLED:"true",
   PACKTOOK_STAGING_PUBLIC_SIGNUP_ENABLED:"false",
   PACKTOOK_STAGING_PUBLIC_ACCESS_ENABLED:"false",
   PACKTOOK_STAGING_PILOT_APP_ID:"1:123:web:abcdef1234"};
 }
 if(p!=="packtook-staging"||q!=="packtook-staging")
  throw new HttpsError("failed-precondition","P69 staging project required");
 return process.env;
}
function gate(){
 return createStagingGate({
  env:approvedEnvironment(),now:NOW,
  readControl:async()=>{
   const snap=await db.doc("pilotControls/p65").get();
   return snap.exists?snap.data():null;
  },
  readLiveUser:id=>auth.getUser(id)
 });
}
function protect(handler){
 return onCall(options,async req=>{
  try{
   const g=gate();
   const id=await g.assertAuthorized(req);
   if(g.uid(req)!==id)throw new Error("P69_UID_INCONSISTENT");
   return await handler(id,req.data||{}, {session:req.auth.token.p65Session});
  }catch(e){
   if(e instanceof HttpsError)throw e;
   if(e?.name==="StagingAuthorizationError")
    throw new HttpsError("permission-denied","Staging pilot authorization required");
   // Fail closed without exposing implementation or user details.
   throw new HttpsError("internal","Staging request could not be processed");
  }
 });
}
exports.p69UsageStatus=protect(async id=>{
 const snap=await db.collection("accounts").doc(id).get();
 if(!snap.exists)throw new HttpsError("failed-precondition","Account not provisioned");
 return usageResponse(snap.data());
});
exports.p69RecordingStatus=protect(async (id,data)=>{
 const op=data?.operationId;
 if(typeof op!=="string"||!/^[A-Za-z0-9_-]{16,100}$/.test(op))
  throw new HttpsError("invalid-argument","Invalid operation ID");
 const snap=await db.collection("accounts").doc(id).collection("recordings").doc(op).get();
 if(!snap.exists)throw new HttpsError("not-found","Recording reservation not found");
 const r=snap.data();
 return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file??null};
});
// Credit functions are intentionally NEW-NAME, review-only candidate callables.
// They cannot replace the currently deployed Staging endpoint without
// an owner-approved migration, rollback and independent security review.
const credit=createCreditHandlers({db,FieldValue,HttpsError});
exports.p70ReserveCredit=protect((id,d,ctx)=>credit.reserve(id,d,ctx));
exports.p70FinalizeCredit=protect((id,d,ctx)=>credit.finalize(id,d,ctx));
exports.p70RecoverStaleVideoReservation=protect((id,d,ctx)=>credit.recover(id,d,ctx));
