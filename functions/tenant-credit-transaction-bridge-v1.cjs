"use strict";
/**
 * Firestore transaction bridge candidate (not wired to live exports).
 * This is the required read-inside-transaction version of membership,
 * credit reservation and approval checks. Zero side effects until a caller
 * applies the returned writes within the SAME transaction.
 */
const p=require("./tenant-credit-transaction-policy-v1.cjs");
const {emailDigest}=require("./operator-domain-v1.cjs");
function createTenantTransactionGuards({db,HttpsError}){
 if(!db||!HttpsError)throw new TypeError("Missing dependencies");
 const deny=e=>{
  if(e instanceof p.PolicyDenied)throw new HttpsError("permission-denied",e.message);
  throw e;
 };
 function membershipRef(ctx){
  return ctx.role==="operator"?db.collection("operatorMemberships").doc(ctx.actorUid):null;
 }
 async function membershipRead(tx,ctx,verifiedEmail){
  const ref=membershipRef(ctx);
  const snap=ref?await tx.get(ref):null;
  const record=snap?.exists?snap.data():null;
  try{p.assertTransactionMembership(ctx,record,verifiedEmail)}catch(e){deny(e)}
  return record;
 }
 async function beforeReserve(tx,{ctx,verifiedEmail,accountRef,recordRef,approvalRef,requestRef,barcode,nowMs}){
  // All reads must happen before caller performs any transaction writes.
  if(!ctx||!accountRef||!recordRef)throw new TypeError("Missing reserve references");
  const [ownerSnap,recSnap,membershipSnap,approvalSnap,requestSnap]=await Promise.all([
   tx.get(accountRef),tx.get(recordRef),
   membershipRef(ctx)?tx.get(membershipRef(ctx)):Promise.resolve(null),
   approvalRef?tx.get(approvalRef):Promise.resolve(null),
   requestRef?tx.get(requestRef):Promise.resolve(null)
  ]);
  const member=membershipSnap?.exists?membershipSnap.data():null;
  if(!ownerSnap.exists)throw new HttpsError("failed-precondition","Tenant account unavailable");
  const owner=ownerSnap.data();
  try{
   p.assertReservationCreate(ctx,member,verifiedEmail,{
    accountOwnerUid:owner.ownerUid||accountRef.id,recordingExists:recSnap.exists});
  }catch(e){deny(e)}
  if(approvalRef||requestRef){
   if(!approvalRef||!requestRef)
    throw new HttpsError("invalid-argument","Approval and request must both be supplied");
   try{p.assertDuplicateApprovalUse(ctx,member,verifiedEmail,{
    approval:approvalSnap?.exists?{id:approvalRef.id,...approvalSnap.data()}:null,
    request:requestSnap?.exists?{id:requestRef.id,...requestSnap.data()}:null,
    barcode,nowMs
   })}catch(e){deny(e)}
  }
  return {owner,recordedBy:ctx.actorUid,accountId:ctx.accountId,
   member,approval:approvalSnap?.data()||null,request:requestSnap?.data()||null};
 }
 async function beforeFinalize(tx,{ctx,verifiedEmail,accountRef,recordRef,operationId}){
  if(!ctx||!accountRef||!recordRef)throw new TypeError("Missing finalize references");
  const [ownerSnap,recordSnap,membershipSnap]=await Promise.all([
   tx.get(accountRef),tx.get(recordRef),
   membershipRef(ctx)?tx.get(membershipRef(ctx)):Promise.resolve(null)
  ]);
  if(!ownerSnap.exists||!recordSnap.exists)
   throw new HttpsError("not-found","Tenant reservation not found");
  const member=membershipSnap?.exists?membershipSnap.data():null;
  try{p.assertFinalization(ctx,member,verifiedEmail,{
   accountOwnerUid:ownerSnap.data().ownerUid||accountRef.id,
   recording:{...recordSnap.data(),operationId:recordRef.id},
   operationId
  })}catch(e){deny(e)}
  return {owner:ownerSnap.data(),record:recordSnap.data(),recordedBy:ctx.actorUid};
 }
 return {beforeReserve,beforeFinalize};
}
module.exports={createTenantTransactionGuards};
