"use strict";
/* P70 staging-only credit callbacks (candidate, never independently deploy).
 * P67 original production semantics are the reference for diff review.
 * All Firestore reads MUST precede writes inside each transaction.
 */
const crypto=require("node:crypto");
const {validLease}=require("./staging-authorization.cjs");
const OP=/^[A-Za-z0-9_-]{16,100}$/;
const STALE_MS=30*60*1000;
const LIMITS=Object.freeze({Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null});
function createCreditHandlers({db,FieldValue,HttpsError,clock=Date.now}){
 if(!db||!FieldValue||typeof HttpsError!=="function")throw Error("P70_DEPENDENCIES_REQUIRED");
 const bad=(code,message)=>{throw new HttpsError(code,message);};
 const account=id=>db.collection("accounts").doc(id);
 const period=()=>new Date(clock()).toISOString().slice(0,7);
 const key=code=>crypto.createHash("sha256").update(code).digest("hex");
 const validOp=x=>typeof x==="string"&&OP.test(x);
 const wallet=a=>a.creditWalletV1===true;
 function count(a,name){
  const n=a[name]??0;
  if(!Number.isSafeInteger(n)||n<0)bad("failed-precondition","Credit counter needs review");
  return n;
 }
 function increment(a,name){
  const n=count(a,name);
  if(n>=Number.MAX_SAFE_INTEGER)bad("failed-precondition","Credit counter overflow");
 }
 function available(a,p){
  if(!Object.hasOwn(LIMITS,a.plan))bad("failed-precondition","Unknown plan");
  const limit=LIMITS[a.plan];
  if(limit===null)return null;
  if(wallet(a))return count(a,"creditWalletRemaining");
  const committed=(a.period===p)?count(a,"used")+count(a,"reserved"):0;
  if(!Number.isSafeInteger(committed))bad("failed-precondition","Credit counter overflow");
  return Math.max(0,limit-committed);
 }
 async function leaseTx(tx,id,session){
  const snap=await tx.get(db.doc("pilotControls/p65"));
  const control=snap.exists?snap.data():null;
  if(!validLease(control,clock())||!control.invitedUids.includes(id)||control.sessionId!==session)
   bad("permission-denied","Staging invitation changed");
 }
 async function reserve(id,d,{session}){
  const op=d.operationId,barcode=d.barcode,device=d.deviceId;
  if(!validOp(device))bad("permission-denied","Device registration required");
  if(!validOp(op)||typeof barcode!=="string"||!barcode.trim()||barcode.length>160)
   bad("invalid-argument","Invalid recording or barcode");
  const code=barcode.trim(),acc=account(id),rec=acc.collection("recordings").doc(op);
  const lock=acc.collection("barcodeLocks").doc(key(code));
  const overrideRef=typeof d.approvalId==="string"&&validOp(d.approvalId)?
    acc.collection("duplicateApprovals").doc(d.approvalId):null;
  const p=period();
  return db.runTransaction(async tx=>{
   const [controlSnap,aSnap,rSnap,kSnap,approvalSnap]=await Promise.all([
    tx.get(db.doc("pilotControls/p65")),tx.get(acc),tx.get(rec),tx.get(lock),
    overrideRef?tx.get(overrideRef):Promise.resolve(null)
   ]);
   const c=controlSnap.exists?controlSnap.data():null;
   if(!validLease(c,clock())||!c.invitedUids.includes(id)||c.sessionId!==session)
    bad("permission-denied","Staging invitation changed");
   if(!aSnap.exists)bad("failed-precondition","Account not provisioned");
   const a=aSnap.data(),limit=LIMITS[a.plan];
   if(!Object.hasOwn(LIMITS,a.plan))bad("failed-precondition","Invalid plan");
   if(!(a.devices||[]).some(x=>x.id===device))bad("permission-denied","Device not registered");
   if(a.plan!=="Free"&&(!a.planExpiresAt||Date.parse(a.planExpiresAt)<=clock()))
    bad("permission-denied","Subscription invalid or expired");
   if(rSnap.exists){
    const previous=rSnap.data();
    if(previous.barcode!==code)bad("already-exists","Operation ID previously used");
    return {recordingId:op,status:previous.status,idempotent:true};
   }
   const overridden=kSnap.exists&&kSnap.data().operationId!==op;
   if(overridden){
    const approval=approvalSnap?.exists?approvalSnap.data():null;
    if(!approval||approval.barcode!==code||approval.status!=="approved"||
       approval.expiresAtMs<=clock()||
       (approval.requestedBy&&approval.requestedBy!==id))
      bad("already-exists","Barcode already recorded");
    if(kSnap.data().status!=="completed")
      bad("failed-precondition","Previous recording not completed");
   }
   if(!overridden&&d.approvalId)bad("failed-precondition","Override not required");
   const pending=wallet(a)||a.period===p?count(a,"reserved"):0;
   const used=a.period===p?count(a,"used"):0;
   const remaining=available(a,p);
   if(pending===Number.MAX_SAFE_INTEGER||used===Number.MAX_SAFE_INTEGER)
    bad("failed-precondition","Credit counter overflow");
   if(limit!==null&&remaining<=0)bad("resource-exhausted","Credits exhausted");
   if(overridden&&approvalSnap.data().requestId&&
      !validOp(approvalSnap.data().requestId))
    bad("failed-precondition","Duplicate request ID requires review");
   // All Firestore reads are above this line.
   tx.create(rec,{barcode:code,status:"reserved",period:p,createdAt:FieldValue.serverTimestamp(),
    file:null,overrideOf:overridden?kSnap.data().operationId:null,approvalId:overridden?d.approvalId:null});
   tx.set(lock,{operationId:op,barcode:code,status:"reserved",
    previousOperationId:overridden?kSnap.data().operationId:null,
    createdAt:FieldValue.serverTimestamp()});
   if(overridden){
    tx.update(overrideRef,{status:"consumed",consumedBy:op,consumedAt:FieldValue.serverTimestamp()});
    // Production reserveCredit also marks the related duplicate request as
    // consumed when the approval references its original request.
    const linkedRequest=approvalSnap.data().requestId;
    if(linkedRequest){
     tx.update(acc.collection("duplicateRequests").doc(linkedRequest),
      {status:"consumed",consumedBy:op});
    }
   }
   tx.update(acc,{period:p,used,reserved:pending+1,
    ...(wallet(a)&&limit!==null?{creditWalletRemaining:remaining-1}:{}),
    updatedAt:FieldValue.serverTimestamp()});
   tx.create(acc.collection("audit").doc(),{action:"reserve",recordingId:op,
    createdAt:FieldValue.serverTimestamp()});
   return {recordingId:op,status:"reserved",remaining:limit===null?null:remaining-1};
  });
 }
 async function finalize(id,d,{session}){
  const op=d.operationId,success=d.success;
  if(!validOp(op)||typeof success!=="boolean")bad("invalid-argument","Invalid finalization");
  if(success&&(!Number.isSafeInteger(d.bytes)||d.bytes<1000||
    typeof d.filename!=="string"||!d.filename.trim()||d.filename.length>255))
    bad("invalid-argument","Invalid file metadata");
  const acc=account(id),rec=acc.collection("recordings").doc(op);
  return db.runTransaction(async tx=>{
   const [cSnap,aSnap,rSnap]=await Promise.all([
    tx.get(db.doc("pilotControls/p65")),tx.get(acc),tx.get(rec)
   ]);
   const control=cSnap.exists?cSnap.data():null;
   if(!validLease(control,clock())||!control.invitedUids.includes(id)||control.sessionId!==session)
    bad("permission-denied","Staging invitation changed");
   if(!aSnap.exists||!rSnap.exists)bad("not-found","Reservation not found");
   const a=aSnap.data(),r=rSnap.data();
   if(!Object.hasOwn(LIMITS,a.plan))bad("failed-precondition","Unknown plan");
   const lock=acc.collection("barcodeLocks").doc(key(r.barcode));
   const kSnap=await tx.get(lock);
   if(r.status!=="reserved"){
    if(r.status===(success?"completed":"failed"))return {status:r.status,idempotent:true};
    bad("failed-precondition","Reservation already finalized");
   }
   const next=success?"completed":"failed";
   if(wallet(a)){
    if(count(a,"reserved")<1)bad("failed-precondition","Wallet reserved count mismatch");
    if(success&&a.period===r.period)increment(a,"used");
    if(!success&&LIMITS[a.plan]!==null)increment(a,"creditWalletRemaining");
   }else if(a.period===r.period){
    if(count(a,"reserved")<1)bad("failed-precondition","Legacy reserved count mismatch");
    if(success)increment(a,"used");
   }
   // All reads above this line.
   tx.update(rec,{status:next,finalizedAt:FieldValue.serverTimestamp(),
    file:success?{filename:d.filename,bytes:d.bytes}:null});
   if(kSnap.exists&&kSnap.data().operationId===op){
    if(success)tx.update(lock,{status:"completed",finalizedAt:FieldValue.serverTimestamp()});
    else if(r.overrideOf)tx.set(lock,{operationId:r.overrideOf,barcode:r.barcode,status:"completed",
      restoredAt:FieldValue.serverTimestamp()});
    else tx.delete(lock);
   }
   if(wallet(a)){
    tx.update(acc,{reserved:FieldValue.increment(-1),
     ...(success&&a.period===r.period?{used:FieldValue.increment(1)}:{}),
     ...(!success&&LIMITS[a.plan]!==null?{creditWalletRemaining:FieldValue.increment(1)}:{}),
     updatedAt:FieldValue.serverTimestamp()});
   }else if(a.period===r.period){
    tx.update(acc,{reserved:FieldValue.increment(-1),
     ...(success?{used:FieldValue.increment(1)}:{}),updatedAt:FieldValue.serverTimestamp()});
   }
   tx.create(acc.collection("audit").doc(),{action:next,recordingId:op,
    createdAt:FieldValue.serverTimestamp()});
   return {status:next};
  });
 }
 async function recover(id,d,{session}){
  if(!validOp(d.operationId)||d.confirmNoVideo!==true)
   bad("invalid-argument","Confirmation required");
  const op=d.operationId,acc=account(id),rec=acc.collection("recordings").doc(op);
  return db.runTransaction(async tx=>{
   const [cSnap,aSnap,rSnap]=await Promise.all([
    tx.get(db.doc("pilotControls/p65")),tx.get(acc),tx.get(rec)
   ]);
   const control=cSnap.exists?cSnap.data():null;
   if(!validLease(control,clock())||!control.invitedUids.includes(id)||control.sessionId!==session)
    bad("permission-denied","Staging invitation changed");
   if(!aSnap.exists||!rSnap.exists)bad("not-found","Reservation not found");
   const a=aSnap.data(),r=rSnap.data();
   if(!Object.hasOwn(LIMITS,a.plan))bad("failed-precondition","Unknown plan");
   if(r.status==="failed"&&r.recoveryReason==="manual_stale_recovery")
    return {status:"failed",idempotent:true};
   if(r.status!=="reserved")bad("failed-precondition","Already finalized");
   const at=r.createdAt?.toMillis?.();
   if(!at||clock()-at<STALE_MS)bad("failed-precondition","Reservation not old enough");
   const lock=acc.collection("barcodeLocks").doc(key(r.barcode));
   const lockSnap=await tx.get(lock);
   const counted=wallet(a)||a.period===r.period;
   if(counted&&count(a,"reserved")<1)bad("failed-precondition","Invalid reservation count");
   if(wallet(a)&&LIMITS[a.plan]!==null)increment(a,"creditWalletRemaining");
   // All reads above this line.
   tx.update(rec,{status:"failed",file:null,recoveryReason:"manual_stale_recovery",
    finalizedAt:FieldValue.serverTimestamp()});
   if(lockSnap.exists&&lockSnap.data().operationId===op){
    if(r.overrideOf)tx.set(lock,{operationId:r.overrideOf,barcode:r.barcode,status:"completed",
     restoredAt:FieldValue.serverTimestamp()});
    else tx.delete(lock);
   }
   if(counted)tx.update(acc,{reserved:count(a,"reserved")-1,
    ...(wallet(a)&&LIMITS[a.plan]!==null?{creditWalletRemaining:FieldValue.increment(1)}:{}),
    updatedAt:FieldValue.serverTimestamp()});
   tx.create(acc.collection("audit").doc(),{action:"manual_stale_reservation_recovery",
    recordingId:op,createdAt:FieldValue.serverTimestamp()});
   return {status:"failed",creditReturned:counted,period:r.period};
  });
 }
 return Object.freeze({reserve,finalize,recover});
}
module.exports={createCreditHandlers};
