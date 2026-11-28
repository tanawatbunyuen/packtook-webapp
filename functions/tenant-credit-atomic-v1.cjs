"use strict";
/**
 * REVIEW-ONLY transactional shared credit reservation/finalization candidate.
 * Not exported from index.js. Require dedicated emulator coverage before wiring.
 * Every read in each db.runTransaction precedes any write.
 */
const crypto=require("node:crypto");
const {emailDigest}=require("./operator-domain-v1.cjs");
const {assertReservationCreate,assertFinalization,assertDuplicateApprovalUse,PolicyDenied}=require("./tenant-credit-transaction-policy-v1.cjs");
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const devices={Free:1,Starter:1,Basic:1,Growth:3,Business:5,Pro:10};
const OP_RE=/^[A-Za-z0-9_-]{16,100}$/;
function createAtomicCreditCandidate({db,FieldValue,HttpsError,clock=()=>Date.now()}){
 if(!db||!FieldValue||!HttpsError)throw Error("Missing Firestore dependencies");
 const bad=(code,message)=>{throw new HttpsError(code,message)};
 const asErr=e=>{if(e instanceof PolicyDenied)bad("permission-denied",e.message);throw e};
 const yearMonth=ms=>new Date(ms).toISOString().slice(0,7);
 const barcodeKey=s=>crypto.createHash("sha256").update(s).digest("hex");
 const membershipRef=ctx=>ctx.role==="operator"?db.collection("operatorMemberships").doc(ctx.actorUid):null;
 function validate(ctx){if(!ctx||!["operator","admin"].includes(ctx.role)||!ctx.actorUid||!ctx.accountId)bad("permission-denied","Invalid tenant context")}
 function membership(ctx,snap){return snap?.exists?snap.data():null}
 function assertAccount(ref,a,ctx){
  if(!a)bad("not-found","Tenant account missing");
  if(ref.id!==ctx.accountId||a.ownerUid&&a.ownerUid!==ctx.accountId)
   bad("permission-denied","Account ownership mismatch");
 }
 function subState(a,ms){
  if(a.plan==="Free")return "active";
  if(!a.planExpiresAt)return "invalid";
  const expiry=Date.parse(a.planExpiresAt);
  if(!Number.isFinite(expiry)||expiry<=ms)return "expired";
  return "active";
 }
 function allowance(a,ms){
  const limit=limits[a.plan];if(limit===undefined)bad("failed-precondition","Unknown plan");
  if(a.creditWalletV1===true){
   const left=a.creditWalletRemaining;
   if(limit!==null&&(!Number.isSafeInteger(left)||left<0))bad("failed-precondition","Invalid wallet");
   return {limit,available:limit===null?null:left,used:a.period===yearMonth(ms)?a.used||0:0,reserved:a.reserved||0};
  }
  const same=a.period===yearMonth(ms);
  const used=same?(a.used||0):0,reserved=same?(a.reserved||0):0;
  if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(reserved)||reserved<0)
   bad("failed-precondition","Invalid reservations");
  return {limit,available:limit===null?null:Math.max(0,limit-used-reserved),used,reserved};
 }
 function deviceCheck(a,ctx,deviceId){
  if(typeof deviceId!=="string"||!deviceId||deviceId.length>150)bad("invalid-argument","Device ID required");
  const list=Array.isArray(a.devices)?a.devices:[];
  const matching=list.find(x=>x.id===deviceId);
  if(!matching)bad("permission-denied","Device not registered for tenant");
  // Current stored device model has no registeredBy; existing owner records
  // remain owner-only; new operator registrations need explicit actor binding.
  if(ctx.role==="operator"&&matching.registeredBy!==ctx.actorUid)
   bad("permission-denied","Operator device ownership required");
 }
 function validOp(s){if(typeof s!=="string"||!OP_RE.test(s))bad("invalid-argument","Invalid operation ID")}
 function validBarcode(s){if(typeof s!=="string"||!s.trim()||s.length>160)bad("invalid-argument","Invalid barcode");return s.trim()}
 async function reserve({ctx,verifiedEmail,operationId,barcode,deviceId,approvalId}){
  validate(ctx);validOp(operationId);const code=validBarcode(barcode),now=clock(),period=yearMonth(now);
  const account=db.collection("accounts").doc(ctx.accountId);
  const rec=account.collection("recordings").doc(operationId);
  const lock=account.collection("barcodeLocks").doc(barcodeKey(code));
  if(approvalId!==undefined)validOp(approvalId);
  const appr=approvalId?account.collection("duplicateApprovals").doc(approvalId):null;
  return db.runTransaction(async tx=>{
   // Read membership on every retry; cross-account revocations participate in transaction.
   const memRef=membershipRef(ctx);
   const [aSnap,rSnap,lSnap,mSnap,pSnap]=await Promise.all([
    tx.get(account),tx.get(rec),tx.get(lock),
    memRef?tx.get(memRef):Promise.resolve(null),
    appr?tx.get(appr):Promise.resolve(null)
   ]);
   const a=aSnap.exists?aSnap.data():null,member=membership(ctx,mSnap);
   assertAccount(account,a,ctx);
   if(subState(a,now)!=="active")bad("permission-denied","Subscription inactive");
   deviceCheck(a,ctx,deviceId);
   // idempotent response allowed only for the original reserving actor and payload.
   if(rSnap.exists){
    const old=rSnap.data();
    if(old.recordedBy!==ctx.actorUid||old.accountId!==ctx.accountId||
      old.barcode!==code||old.deviceId!==deviceId)
     bad("already-exists","Operation ID already bound");
    try{assertReservationCreate(ctx,member,verifiedEmail,{accountOwnerUid:ctx.accountId,recordingExists:false})}catch(e){asErr(e)}
    return {recordingId:operationId,status:old.status,idempotent:true};
   }
   try{assertReservationCreate(ctx,member,verifiedEmail,{accountOwnerUid:ctx.accountId,recordingExists:false})}catch(e){asErr(e)}
   const oldLock=lSnap.exists?lSnap.data():null;
   const override=!!oldLock;
   if(override&&oldLock.status!=="completed")bad("already-exists","Barcode already reserved");
   if(!override&&approvalId)bad("failed-precondition","No override required");
   if(override&&!appr)bad("already-exists","Completed barcode requires approval");
   let requestRef=null,requestSnap=null;
   if(override){
    const approval=pSnap.exists?pSnap.data():null;
    if(!approval||!approval.requestId||!OP_RE.test(approval.requestId))
     bad("permission-denied","Invalid approval request reference");
    requestRef=account.collection("duplicateRequests").doc(approval.requestId);
    requestSnap=await tx.get(requestRef);
    try{assertDuplicateApprovalUse(ctx,member,verifiedEmail,{
     approval:{id:appr.id,...approval},
     request:requestSnap.exists?{id:requestRef.id,...requestSnap.data()}:null,
     barcode:code,nowMs:now
    })}catch(e){asErr(e)}
   }
   const quota=allowance(a,now);
   if(quota.available!==null&&quota.available<=0)bad("resource-exhausted","Video credit balance exhausted");
   // All tx.get are above this line; write exactly once for a committed transaction.
   tx.create(rec,{operationId,accountId:ctx.accountId,recordedBy:ctx.actorUid,
    deviceId,barcode:code,status:"reserved",period,createdAt:FieldValue.serverTimestamp(),
    file:null,overrideOf:override?oldLock.operationId:null,approvalId:override?approvalId:null});
   tx.set(lock,{operationId,accountId:ctx.accountId,barcode:code,status:"reserved",
    previousOperationId:override?oldLock.operationId:null,createdAt:FieldValue.serverTimestamp()});
   if(override){
    tx.update(appr,{status:"consumed",consumedBy:operationId,consumedAt:FieldValue.serverTimestamp()});
    tx.update(requestRef,{status:"consumed",consumedBy:operationId,consumedAt:FieldValue.serverTimestamp()});
   }
   tx.update(account,{period,used:quota.used,reserved:quota.reserved+1,
    ...(a.creditWalletV1===true&&quota.limit!==null?{creditWalletRemaining:quota.available-1}:{}),
    updatedAt:FieldValue.serverTimestamp()});
   tx.create(account.collection("audit").doc(),{action:"reserve",recordingId:operationId,
    by:ctx.actorUid,createdAt:FieldValue.serverTimestamp()});
   return {recordingId:operationId,status:"reserved",
    remaining:quota.available===null?null:quota.available-1};
  });
 }
 async function finalize({ctx,verifiedEmail,operationId,success,filename,bytes}){
  validate(ctx);validOp(operationId);
  if(typeof success!=="boolean")bad("invalid-argument","Finalize result required");
  if(success&&(typeof filename!=="string"||!filename.trim()||filename.length>255||
    !Number.isSafeInteger(bytes)||bytes<1000))bad("invalid-argument","Invalid file metadata");
  const account=db.collection("accounts").doc(ctx.accountId);
  const rec=account.collection("recordings").doc(operationId);
  return db.runTransaction(async tx=>{
   const memRef=membershipRef(ctx);
   const [aSnap,rSnap,mSnap]=await Promise.all([tx.get(account),tx.get(rec),
    memRef?tx.get(memRef):Promise.resolve(null)]);
   const a=aSnap.exists?aSnap.data():null,record=rSnap.exists?rSnap.data():null;
   assertAccount(account,a,ctx);
   if(!record)bad("not-found","Reservation missing");
   if(record.accountId!==ctx.accountId||record.recordedBy!==ctx.actorUid||
     record.operationId!==operationId)
    bad("permission-denied","Recording identity mismatch");
   // Even idempotent replay requires current active membership to prevent revocation bypass.
   try{assertReservationCreate(ctx,membership(ctx,mSnap),verifiedEmail,{
     accountOwnerUid:ctx.accountId,recordingExists:false})}catch(e){asErr(e)}
   if(record.status!=="reserved"){
    if(record.status===(success?"completed":"failed"))
     return {status:record.status,idempotent:true};
    bad("failed-precondition","Already finalized");
   }
   try{assertFinalization(ctx,membership(ctx,mSnap),verifiedEmail,{
    accountOwnerUid:ctx.accountId,recording,operationId})}catch(e){asErr(e)}
   const lock=account.collection("barcodeLocks").doc(barcodeKey(record.barcode));
   const lockSnap=await tx.get(lock);
   const lockValue=lockSnap.exists?lockSnap.data():null;
   if(!lockValue||lockValue.operationId!==operationId||lockValue.status!=="reserved")
    bad("failed-precondition","Reservation lock mismatch");
   const now=clock(),next=success?"completed":"failed";
   if(a.creditWalletV1===true){
    if(!Number.isSafeInteger(a.reserved)||a.reserved<1)
     bad("failed-precondition","Reserved credit mismatch");
   }else if(record.period===a.period&&(!Number.isSafeInteger(a.reserved)||a.reserved<1))
    bad("failed-precondition","Reserved credit mismatch");
   // Read barrier complete.
   tx.update(rec,{status:next,file:success?{filename,bytes}:null,finalizedAt:FieldValue.serverTimestamp()});
   if(success)tx.update(lock,{status:"completed",finalizedAt:FieldValue.serverTimestamp()});
   else if(record.overrideOf){
    tx.set(lock,{operationId:record.overrideOf,barcode:record.barcode,status:"completed",
     restoredAt:FieldValue.serverTimestamp()});
   }else tx.delete(lock);
   if(a.creditWalletV1===true){
    const quota=allowance(a,now);
    tx.update(account,{reserved:a.reserved-1,
     ...(success&&a.period===record.period?{used:FieldValue.increment(1)}:{}),
     ...(!success&&quota.limit!==null?{creditWalletRemaining:FieldValue.increment(1)}:{}),
     updatedAt:FieldValue.serverTimestamp()});
   }else if(a.period===record.period){
    tx.update(account,{reserved:a.reserved-1,
     ...(success?{used:FieldValue.increment(1)}:{}),
     updatedAt:FieldValue.serverTimestamp()});
   }
   tx.create(account.collection("audit").doc(),{action:next,recordingId:operationId,
    by:ctx.actorUid,createdAt:FieldValue.serverTimestamp()});
   return {status:next};
  });
 }
 return {reserve,finalize};
}
module.exports={createAtomicCreditCandidate};
