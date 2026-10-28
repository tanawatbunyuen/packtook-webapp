"use strict";
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const crypto=require("node:crypto");
admin.initializeApp();
const db=admin.firestore();
const {FieldValue}=admin.firestore;
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const deviceLimits={Free:1,Starter:1,Basic:1,Growth:3,Business:5,Pro:10};
const region="asia-southeast1";
const options={region,maxInstances:20,timeoutSeconds:30}; // Enable enforceAppCheck:true after configuring web App Check.
function uid(req){if(!req.auth)throw new HttpsError("unauthenticated","Please sign in");if(req.auth.token.email_verified!==true)throw new HttpsError("permission-denied","Verify your email");return req.auth.uid}
function data(req){return req.data&&typeof req.data==="object"?req.data:{}}
function validOp(id){return typeof id==="string"&&/^[a-zA-Z0-9_-]{16,100}$/.test(id)}
function own(uid){return db.collection("accounts").doc(uid)}
async function accountIdFor(uidValue){const member=await db.collection("memberships").doc(uidValue).get();return member.exists?member.data().accountId:uidValue}
async function ownerRef(uidValue){return own(await accountIdFor(uidValue))}
async function assertAdmin(uidValue){const accountId=await accountIdFor(uidValue);if(accountId!==uidValue)throw new HttpsError("permission-denied","Admin only");return accountId}

function barcodeKey(value){return crypto.createHash("sha256").update(value.trim()).digest("hex")}
function periodId(at){return new Date(at).toISOString().slice(0,7)}
function subscriptionState(a){if(a.plan==="Free")return "free";if(!a.planExpiresAt)return "unconfigured";const expires=Date.parse(a.planExpiresAt);if(!Number.isFinite(expires))return "invalid";return expires<=Date.now()?"expired":"active"}
async function ensureAccount(id){
 const ref=await ownerRef(id);
 if(ref.id!==id)return ref;
 try{await ref.create({plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})}
 catch(e){if(e.code!==6&&e.code!=="already-exists")throw e}
 return ref;
}
exports.usageStatus=onCall(options,async req=>{
 const id=uid(req),ref=await ensureAccount(id),snap=await ref.get();
 if(!snap.exists)throw new HttpsError("failed-precondition","Account not provisioned");
 const a=snap.data(),limit=limits[a.plan];if(limit===undefined)throw new HttpsError("failed-precondition","Invalid plan");
 const current=periodId(Date.now()),used=a.period===current?a.used||0:0,reserved=a.period===current?a.reserved||0:0;
 return {plan:a.plan,limit,used,reserved,remaining:limit===null?null:Math.max(0,limit-used-reserved),period:current,planExpiresAt:typeof a.planExpiresAt==="string"?a.planExpiresAt:null,subscriptionStatus:subscriptionState(a)};
});
exports.reserveCredit=onCall(options,async req=>{
 const id=uid(req),body=data(req),op=body.operationId,barcode=body.barcode;
 if(!validDevice(body.deviceId))throw new HttpsError("permission-denied","Device registration required");
 if(!validOp(op)||typeof barcode!=="string"||!barcode.trim()||barcode.length>160)throw new HttpsError("invalid-argument","Invalid operation or barcode");
 const ref=await ensureAccount(id),rec=ref.collection("recordings").doc(op),period=periodId(Date.now()),code=barcode.trim(),key=ref.collection("barcodeLocks").doc(barcodeKey(code));
 return db.runTransaction(async tx=>{
  // All reads before any transaction writes.
  const approvalId=body.approvalId;const approvalRef=typeof approvalId==="string"&&validOp(approvalId)?ref.collection("duplicateApprovals").doc(approvalId):null;
  const [aSnap,rSnap,kSnap,approvalSnap]=await Promise.all([tx.get(ref),tx.get(rec),tx.get(key),approvalRef?tx.get(approvalRef):Promise.resolve(null)]);
  if(!aSnap.exists)throw new HttpsError("failed-precondition","Account not provisioned");
  const a=aSnap.data(),limit=limits[a.plan];if(limit===undefined)throw new HttpsError("failed-precondition","Invalid plan");
  if(!(a.devices||[]).some(d=>d.id===body.deviceId))throw new HttpsError("permission-denied","Device not registered");
  const sub=subscriptionState(a);if(sub==="expired"||sub==="invalid")throw new HttpsError("permission-denied","Subscription expired or invalid");
  if(rSnap.exists){const old=rSnap.data();if(old.barcode!==barcode.trim())throw new HttpsError("already-exists","Operation ID previously used");return {recordingId:op,status:old.status,idempotent:true}}
  const override=kSnap.exists&&kSnap.data().operationId!==op;
  if(override){const approved=approvalSnap?.exists?approvalSnap.data():null;if(!approved||approved.barcode!==code||approved.status!=="approved"||approved.expiresAtMs<=Date.now()||(approved.requestedBy&&approved.requestedBy!==id))throw new HttpsError("already-exists","Barcode already scanned or recorded");if(kSnap.data().status!=="completed")throw new HttpsError("failed-precondition","Previous recording is not completed")}
  if(!override&&approvalId)throw new HttpsError("failed-precondition","Override is not required");
  const samePeriod=a.period===period,used=samePeriod?(a.used||0):0,reserved=samePeriod?(a.reserved||0):0;
  if(limit!==null&&used+reserved>=limit)throw new HttpsError("resource-exhausted","Monthly video quota exceeded");
  tx.set(rec,{barcode:code,status:"reserved",period,createdAt:FieldValue.serverTimestamp(),file:null,overrideOf:override?kSnap.data().operationId:null,approvalId:override?approvalId:null});
  if(override){tx.update(approvalRef,{status:"consumed",consumedBy:op,consumedAt:FieldValue.serverTimestamp()});if(approvalSnap.data().requestId)tx.update(ref.collection("duplicateRequests").doc(approvalSnap.data().requestId),{status:"consumed",consumedBy:op})}
  tx.set(key,{operationId:op,barcode:code,status:"reserved",previousOperationId:override?kSnap.data().operationId:null,createdAt:FieldValue.serverTimestamp()});
  tx.update(ref,{period,used,reserved:reserved+1,updatedAt:FieldValue.serverTimestamp()});
  tx.create(ref.collection("audit").doc(),{action:"reserve",recordingId:op,createdAt:FieldValue.serverTimestamp()});
  return {recordingId:op,status:"reserved",remaining:limit===null?null:Math.max(0,limit-used-reserved-1)};
 })
});
exports.finalizeCredit=onCall(options,async req=>{
 const id=uid(req),d=data(req),op=d.operationId,success=d.success;
 if(!validOp(op)||typeof success!=="boolean")throw new HttpsError("invalid-argument","Invalid finalization");
 if(success&&(!Number.isSafeInteger(d.bytes)||d.bytes<1000||typeof d.filename!=="string"||d.filename.length>255||!d.filename.trim()))throw new HttpsError("invalid-argument","Invalid file metadata");
 const acc=await ownerRef(id),rec=acc.collection("recordings").doc(op);
 return db.runTransaction(async tx=>{
  const [aSnap,rSnap]=await Promise.all([tx.get(acc),tx.get(rec)]);
  if(!aSnap.exists||!rSnap.exists)throw new HttpsError("not-found","Reservation not found");
  const a=aSnap.data(),r=rSnap.data(),key=acc.collection("barcodeLocks").doc(barcodeKey(r.barcode));
  const kSnap=await tx.get(key);
  if(r.status!=="reserved"){
   if(r.status===(success?"completed":"failed"))return {status:r.status,idempotent:true};
   throw new HttpsError("failed-precondition","Reservation already finalized");
  }
  const next=success?"completed":"failed";
  tx.update(rec,{status:next,finalizedAt:FieldValue.serverTimestamp(),file:success?{filename:d.filename,bytes:d.bytes}:null});
  if(kSnap.exists&&kSnap.data().operationId===op){if(success)tx.update(key,{status:"completed",finalizedAt:FieldValue.serverTimestamp()});else if(r.overrideOf)tx.set(key,{operationId:r.overrideOf,barcode:r.barcode,status:"completed",restoredAt:FieldValue.serverTimestamp()});else tx.delete(key)}
  // Credit count of a previous period stays in its own period; never deduct it from the current month.
  if(a.period===r.period)tx.update(acc,{reserved:FieldValue.increment(-1),...(success?{used:FieldValue.increment(1)}:{}),updatedAt:FieldValue.serverTimestamp()});
  tx.create(acc.collection("audit").doc(),{action:next,recordingId:op,createdAt:FieldValue.serverTimestamp()});
  return {status:next};
 })
});

exports.recordingStatus=onCall(options,async req=>{
 const id=uid(req),op=data(req).operationId;
 if(!validOp(op))throw new HttpsError("invalid-argument","Invalid operation ID");
 const snap=await (await ownerRef(id)).collection("recordings").doc(op).get();
 if(!snap.exists)throw new HttpsError("not-found","Recording reservation not found");
 const r=snap.data();
 return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file||null};
});

function validDevice(id){return typeof id==="string"&&/^[a-zA-Z0-9_-]{16,100}$/.test(id)}
exports.registerDevice=onCall(options,async req=>{
 const user=uid(req),d=data(req),id=d.deviceId;
 if(!validDevice(id))throw new HttpsError("invalid-argument","Invalid device identifier");
 const name=typeof d.name==="string"?d.name.trim().slice(0,60):"Browser device";
 const ref=await ensureAccount(user);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref),a=snap.data(),max=deviceLimits[a.plan];
  if(!max)throw new HttpsError("failed-precondition","Invalid plan");
  const devices=Array.isArray(a.devices)?a.devices:[];
  if(devices.some(x=>x.id===id))return {registered:true,devices:devices.map(x=>({name:x.name,isCurrent:x.id===id})),limit:max};
  if(devices.length>=max)throw new HttpsError("resource-exhausted","Device limit reached");
  const next=[...devices,{id,name,addedAt:new Date().toISOString()}];
  tx.update(ref,{devices:next,updatedAt:FieldValue.serverTimestamp()});
  return {registered:true,devices:next.map(x=>({name:x.name,isCurrent:x.id===id})),limit:max};
 });
});
exports.deviceStatus=onCall(options,async req=>{
 const user=uid(req),d=data(req),ref=await ensureAccount(user),snap=await ref.get(),a=snap.data();
 const devices=Array.isArray(a.devices)?a.devices:[];
 return {limit:deviceLimits[a.plan],registered:devices.some(x=>x.id===d.deviceId),devices:devices.map(x=>({id:x.id,name:x.name,isCurrent:x.id===d.deviceId,addedAt:x.addedAt}))};
});
exports.removeDevice=onCall(options,async req=>{
 const user=uid(req),d=data(req);if(!validDevice(d.deviceId)||!validDevice(d.targetId))throw new HttpsError("invalid-argument","Invalid device");
 const ref=await ownerRef(user);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError("not-found","Account missing");
  const a=snap.data(),devices=Array.isArray(a.devices)?a.devices:[];
  // Verified account owner may retire a lost device from a new browser.
  if(!devices.some(x=>x.id===d.targetId))throw new HttpsError("not-found","Device not found");
  tx.update(ref,{devices:devices.filter(x=>x.id!==d.targetId),updatedAt:FieldValue.serverTimestamp()});
  return {removed:true};
 });
});

exports.authorizeDuplicate=onCall(options,async req=>{
 const accountId=uid(req),d=data(req),barcode=typeof d.barcode==="string"?d.barcode.trim():"",reason=typeof d.reason==="string"?d.reason.trim():"";
 if(!barcode||barcode.length>160||reason.length<10||reason.length>500)throw new HttpsError("invalid-argument","Barcode and reason (10-500 characters) required");
 const acc=await ensureAccount(accountId),lock=acc.collection("barcodeLocks").doc(barcodeKey(barcode));
 const approval=acc.collection("duplicateApprovals").doc(),now=Date.now();
 return db.runTransaction(async tx=>{
  const [aSnap,lSnap]=await Promise.all([tx.get(acc),tx.get(lock)]);
  if(!lSnap.exists||lSnap.data().status!=="completed")throw new HttpsError("failed-precondition","No completed video for barcode");
  const a=aSnap.data();
  // Account currently has a single Firebase user; separate employee roles are not yet implemented.
  if(acc.id!==accountId||a.ownerUid&&a.ownerUid!==accountId)throw new HttpsError("permission-denied","Owner approval required");
  if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});
  tx.create(approval,{barcode,reason,status:"approved",approvedBy:accountId,approvedAt:FieldValue.serverTimestamp(),expiresAtMs:now+5*60*1000,originalOperationId:lSnap.data().operationId});
  tx.create(acc.collection("audit").doc(),{action:"duplicate_approved",barcode,reason,approvalId:approval.id,approvedBy:accountId,createdAt:FieldValue.serverTimestamp()});
  return {approvalId:approval.id,expiresAtMs:now+5*60*1000};
 });
});

exports.accountRole=onCall(options,async req=>{
 const id=uid(req),ref=await ensureAccount(id),snap=await ref.get(),a=snap.data();
 const role=ref.id===id?"admin":"operator";
 return {role,accountId:ref.id,canApproveDuplicates:role==="admin",multiUserEnabled:true};
});

exports.inviteOperator=onCall(options,async req=>{
 const requester=uid(req),owner=await assertAdmin(requester),d=data(req);
 const email=typeof d.email==="string"?d.email.trim().toLowerCase():"";
 if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||email.length>254)throw new HttpsError("invalid-argument","Valid email required");
 if(email===String(req.auth.token.email||"").toLowerCase())throw new HttpsError("invalid-argument","Cannot invite owner");
 const ref=db.collection("operatorInvites").doc(crypto.createHash("sha256").update(owner+":"+email).digest("hex"));
 await ref.set({accountId:owner,email,status:"pending",createdAt:FieldValue.serverTimestamp(),expiresAtMs:Date.now()+7*86400000,invitedBy:requester});
 return {invited:true,email,expiresInDays:7};
});
exports.acceptOperatorInvite=onCall(options,async req=>{
 const member=uid(req),email=String(req.auth.token.email||"").toLowerCase();
 if(!email)throw new HttpsError("failed-precondition","Verified email required");
 const already=await db.collection("memberships").doc(member).get();
 if(already.exists)throw new HttpsError("already-exists","User is already an operator");
 const list=await db.collection("operatorInvites").where("email","==",email).where("status","==","pending").limit(20).get();
 const candidates=list.docs.filter(x=>x.data().expiresAtMs>Date.now());
 if(candidates.length!==1)throw new HttpsError("failed-precondition","Exactly one valid invitation is required");
 const invite=candidates[0],owner=invite.data().accountId;
 if(owner===member)throw new HttpsError("invalid-argument","Owner cannot accept an operator invite");
 return db.runTransaction(async tx=>{
  const [inv,membership,account]=await Promise.all([tx.get(invite.ref),tx.get(db.collection("memberships").doc(member)),tx.get(own(owner))]);
  if(membership.exists||!account.exists||inv.data().status!=="pending"||inv.data().expiresAtMs<=Date.now())throw new HttpsError("failed-precondition","Invite no longer valid");
  tx.create(db.collection("memberships").doc(member),{accountId:owner,role:"operator",email,joinedAt:FieldValue.serverTimestamp()});
  tx.update(invite.ref,{status:"accepted",acceptedBy:member,acceptedAt:FieldValue.serverTimestamp()});
  tx.create(own(owner).collection("audit").doc(),{action:"operator_joined",operatorUid:member,email,createdAt:FieldValue.serverTimestamp()});
  return {accepted:true,accountId:owner,role:"operator"};
 });
});
exports.listOperators=onCall(options,async req=>{
 const owner=await assertAdmin(uid(req));
 const members=await db.collection("memberships").where("accountId","==",owner).limit(100).get();
 const invitations=await db.collection("operatorInvites").where("accountId","==",owner).limit(100).get();
 return {operators:members.docs.map(x=>({uid:x.id,email:x.data().email,role:"operator"})),invitations:invitations.docs.map(x=>({email:x.data().email,status:x.data().status,expiresAtMs:x.data().expiresAtMs}))};
});
exports.requestDuplicate=onCall(options,async req=>{
 const operator=uid(req),account=await accountIdFor(operator);
 if(account===operator)throw new HttpsError("failed-precondition","Admin can approve directly");
 const d=data(req),barcode=String(d.barcode||"").trim(),reason=String(d.reason||"").trim();
 if(!barcode||barcode.length>160||reason.length<10||reason.length>500)throw new HttpsError("invalid-argument","Barcode and reason required");
 const acc=own(account),lock=acc.collection("barcodeLocks").doc(barcodeKey(barcode)),ticket=acc.collection("duplicateRequests").doc();
 return db.runTransaction(async tx=>{
  const snap=await tx.get(lock);
  if(!snap.exists||snap.data().status!=="completed")throw new HttpsError("failed-precondition","Barcode does not have a completed recording");
  tx.create(ticket,{barcode,reason,requestedBy:operator,status:"pending",createdAt:FieldValue.serverTimestamp()});
  return {requestId:ticket.id,status:"pending"};
 });
});
exports.listDuplicateRequests=onCall(options,async req=>{
 const owner=await assertAdmin(uid(req)),snap=await own(owner).collection("duplicateRequests").where("status","==","pending").limit(50).get();
 return {requests:snap.docs.map(x=>({id:x.id,barcode:x.data().barcode,reason:x.data().reason,requestedBy:x.data().requestedBy}))};
});
exports.approveDuplicateRequest=onCall(options,async req=>{
 const owner=await assertAdmin(uid(req)),d=data(req),id=d.requestId;
 if(!validOp(id))throw new HttpsError("invalid-argument","Invalid request ID");
 const acc=own(owner),ticket=acc.collection("duplicateRequests").doc(id),approval=acc.collection("duplicateApprovals").doc(),now=Date.now();
 return db.runTransaction(async tx=>{
  const t=await tx.get(ticket);
  if(!t.exists||t.data().status!=="pending")throw new HttpsError("failed-precondition","Request not pending");
  const x=t.data(),lock=await tx.get(acc.collection("barcodeLocks").doc(barcodeKey(x.barcode)));
  if(!lock.exists||lock.data().status!=="completed")throw new HttpsError("failed-precondition","Barcode is not completed");
  tx.create(approval,{barcode:x.barcode,reason:x.reason,requestId:id,status:"approved",approvedBy:owner,requestedBy:x.requestedBy,approvedAt:FieldValue.serverTimestamp(),expiresAtMs:now+5*60000,originalOperationId:lock.data().operationId});
  tx.update(ticket,{status:"approved",approvalId:approval.id,approvedAt:FieldValue.serverTimestamp()});
  tx.create(acc.collection("audit").doc(),{action:"operator_duplicate_approved",requestId:id,approvalId:approval.id,approvedBy:owner,createdAt:FieldValue.serverTimestamp()});
  return {approved:true,approvalId:approval.id};
 });
});
exports.operatorApprovalStatus=onCall(options,async req=>{
 const member=uid(req),d=data(req),requestId=d.requestId;
 if(!validOp(requestId))throw new HttpsError("invalid-argument","Invalid request");
 const acc=await ownerRef(member),snap=await acc.collection("duplicateRequests").doc(requestId).get();
 if(!snap.exists||snap.data().requestedBy!==member)throw new HttpsError("not-found","Request not found");
 return {status:snap.data().status,approvalId:snap.data().status==="approved"?snap.data().approvalId:null};
});

exports.myDuplicateRequests=onCall(options,async req=>{
 const member=uid(req),acc=await ownerRef(member);
 const snap=await acc.collection("duplicateRequests").where("requestedBy","==",member).limit(50).get();
 return {requests:snap.docs.map(x=>({id:x.id,barcode:x.data().barcode,reason:x.data().reason,status:x.data().status,approvalId:x.data().status==="approved"?x.data().approvalId:null}))};
});
