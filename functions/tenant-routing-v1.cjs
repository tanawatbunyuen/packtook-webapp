"use strict";
/**
 * PACKTOOK tenant resolver candidate. This is an isolated, non-deployed helper.
 * Does not provision accounts or migrate data. No client-supplied account IDs.
 */
const {verifiedPrincipal,requireMembership}=require("./operator-domain-v1.cjs");
function createTenantResolver({db,HttpsError}){
 if(!db||typeof db.collection!=="function"||typeof HttpsError!=="function")
  throw new TypeError("Missing tenant resolver dependencies");
 async function resolve(req,{allowOperator=true,ownerOnly=false}={}){
  let principal;
  try{principal=verifiedPrincipal(req)}catch(e){
   throw new HttpsError(e.message==="UNAUTHENTICATED"?"unauthenticated":"permission-denied","Verified login required");
  }
  const membershipRef=db.collection("operatorMemberships").doc(principal.uid);
  const membership=await membershipRef.get();
  if(membership.exists){
   const record=membership.data();
   try{requireMembership(principal,record,record.accountId)}catch(e){
    throw new HttpsError("permission-denied","Operator membership invalid");
   }
   if(record.accountId===principal.uid)
    throw new HttpsError("permission-denied","Self membership not permitted");
   if(ownerOnly||!allowOperator)
    throw new HttpsError("permission-denied","Account owner only");
   const ownerRef=db.collection("accounts").doc(record.accountId);
   const ownerSnap=await ownerRef.get();
   if(!ownerSnap.exists)throw new HttpsError("failed-precondition","Tenant account unavailable");
   const owner=ownerSnap.data();
   if(owner.ownerUid&&owner.ownerUid!==record.accountId)
    throw new HttpsError("permission-denied","Tenant owner mismatch");
   return {actorUid:principal.uid,accountId:record.accountId,role:"operator",accountRef:ownerRef,
    membershipRef};
  }
  const accountRef=db.collection("accounts").doc(principal.uid);
  const snap=await accountRef.get();
  if(!snap.exists)throw new HttpsError("failed-precondition","Owner account not provisioned");
  const owner=snap.data();
  if(owner.ownerUid&&owner.ownerUid!==principal.uid)
   throw new HttpsError("permission-denied","Account ownership mismatch");
  return {actorUid:principal.uid,accountId:principal.uid,role:"admin",accountRef,membershipRef:null};
 }
 function requireReservationActor(context,record){
  if(!context||!record)throw new HttpsError("permission-denied","Invalid reservation context");
  if(context.role==="operator"&&record.recordedBy!==context.actorUid)
   throw new HttpsError("permission-denied","Cannot finalize another operator's recording");
  if(context.role==="admin"&&record.recordedBy&&record.recordedBy!==context.actorUid)
   throw new HttpsError("permission-denied","Cannot finalize another user's recording");
  return true;
 }
 function requireBillingOwner(context){
  if(!context||context.role!=="admin"||context.actorUid!==context.accountId)
   throw new HttpsError("permission-denied","Billing belongs to account owner");
  return true;
 }
 return {resolve,requireReservationActor,requireBillingOwner};
}
module.exports={createTenantResolver};
