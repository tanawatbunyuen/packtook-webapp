"use strict";
// P182 REVIEW-ONLY candidate. Must NOT be imported by production functions/index.js.
// Authenticated identity + persisted ownerUid required for all owner-only actions.
// Explicitly refuses legacy accounts without ownerUid: migrate separately with verified provenance.
const crypto=require("node:crypto");
const {requirePersistedAccountOwner,verifiedUid,AuthorizationError}=require("./p174-authz-guard-candidate");
function requireAccount(req,snap){
 const uid=verifiedUid(req);
 return requirePersistedAccountOwner(req,{exists:snap.exists,data:snap.exists?snap.data():null})===uid?uid:null;
}
async function accountRole(db,req){
 const id=verifiedUid(req);
 const snap=await db.collection("p182_demo_accounts").doc(id).get();
 requireAccount(req,snap);
 return {role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false};
}
async function approveDuplicate(db,req,{barcode,reason,now=Date.now()}={}){
 const id=verifiedUid(req);
 if(typeof barcode!=="string"||!barcode.trim()||barcode.length>160||
 typeof reason!=="string"||reason.trim().length<10||reason.trim().length>500)
 throw new AuthorizationError("invalid-argument","Barcode and reason required");
 if(!Number.isSafeInteger(now)||now<0)throw new AuthorizationError("invalid-argument","Invalid time");
 const account=db.collection("p182_demo_accounts").doc(id);
 const key=crypto.createHash("sha256").update(barcode.trim()).digest("hex");
 const lock=account.collection("barcodeLocks").doc(key);
 const approval=account.collection("duplicateApprovals").doc();
 const audit=account.collection("audit").doc();
 return db.runTransaction(async tx=>{
  const [a,l]=await Promise.all([tx.get(account),tx.get(lock)]);
  requireAccount(req,a);
  if(!l.exists||l.data().status!=="completed")
   throw new AuthorizationError("failed-precondition","Completed barcode required");
  tx.create(approval,{barcode:barcode.trim(),reason:reason.trim(),status:"approved",
   approvedBy:id,expiresAtMs:now+300000,originalOperationId:l.data().operationId});
  tx.create(audit,{action:"duplicate_approved",approvalId:approval.id,approvedBy:id});
  // CRITICAL: no ownerUid bootstrap or mutation, even for legacy accounts.
  return {approvalId:approval.id,approvedBy:id};
 });
}
module.exports={accountRole,approveDuplicate};
