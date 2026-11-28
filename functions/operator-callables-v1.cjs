"use strict";
/**
 * REVIEW-ONLY operator and duplicate approval backend implementation candidate.
 * Intentionally NOT imported from functions/index.js until shared-tenant
 * credit/device/recording routing and Emulator E2E pass. Never deploy alone.
 *
 * Auth claim email_verified and verified email are enforced server-side.
 * Never trusts client-supplied tenant ID or role.
 */
const p=require("./operator-domain-v1.cjs");
const crypto=require("node:crypto");
const MAX_REQUEST_AGE_MS=10*60*1000;
function createOperatorCallables({db,FieldValue,HttpsError,onCall,options}){
 const missing=[
  !db?"db":null,
  !FieldValue?"FieldValue":null,
  typeof HttpsError!=="function"?"HttpsError":null,
  typeof onCall!=="function"?"onCall":null,
  !options?"options":null,
  options?.enforceAppCheck!==true?"enforceAppCheck":null
 ].filter(Boolean);
 if(missing.length)
  throw Error("Operator callables startup dependencies unavailable: "+missing.join(","));

 function fail(error){
  const messages={
   UNAUTHENTICATED:["unauthenticated","Sign in required"],
   EMAIL_NOT_VERIFIED:["permission-denied","Verified email required"],
   OWNER_ONLY:["permission-denied","Account owner required"],
   MEMBERSHIP_NOT_AUTHORIZED:["permission-denied","Active verified membership required"],
   ROLE_NOT_AUTHORIZED:["permission-denied","Invalid role"],
   INVITE_NOT_PENDING:["failed-precondition","Invitation unavailable"],
   INVITE_EMAIL_MISMATCH:["permission-denied","Invitation email mismatch"],
   INVITE_EXPIRED:["failed-precondition","Invitation expired"],
   INVITE_OWNER_INVALID:["permission-denied","Invalid inviter"],
   REQUEST_NOT_PENDING:["failed-precondition","Request no longer pending"],
   SELF_APPROVAL_FORBIDDEN:["permission-denied","Self-approval is forbidden"],
   REQUEST_EXPIRED:["failed-precondition","Request expired"],
   ORIGINAL_RECORDING_NOT_COMPLETED:["failed-precondition","A completed recording is required"],
   UNAUTHORIZED_REQUEST:["permission-denied","Request access denied"],
  };
  const item=messages[error.message];
  if(item)throw new HttpsError(...item);
  if(error instanceof TypeError)throw new HttpsError("invalid-argument",error.message);
  throw error;
 }
 function principal(req){try{return p.verifiedPrincipal(req)}catch(e){fail(e)}}
 function account(uid){return db.collection("accounts").doc(uid)}
 function member(uid){return db.collection("operatorMemberships").doc(uid)}
 function inviteIndex(hash){return db.collection("operatorInviteIndex").doc(hash)}
 function serverTime(){return FieldValue.serverTimestamp()}
 function nowMs(){return Date.now()}
 async function identity(req){
  const actor=principal(req),ms=await member(actor.uid).get();
  if(ms.exists){
   const m=ms.data();try{p.requireMembership(actor,m,m.accountId)}catch(e){fail(e)}
   // Tenant account check prevents orphan membership accepted as authority.
   const ownerRef=account(m.accountId);
   const owner=await ownerRef.get();
   if(!owner.exists)throw new HttpsError("permission-denied","Tenant account unavailable");
   return {actor,ownerId:m.accountId,role:"operator",ownerRef};
  }
  const ownerRef=account(actor.uid);
  const owner=await ownerRef.get();
  if(!owner.exists)throw new HttpsError("failed-precondition","Owner account not provisioned");
  return {actor,ownerId:actor.uid,role:"admin",ownerRef};
 }
 function ownerOnly(identity){if(identity.role!=="admin")throw new HttpsError("permission-denied","Owner permission required");}
 function clean(email,actor){
  let value;try{value=p.emailAddress(email)}catch(e){fail(e)}
  if(value===actor.email)throw new HttpsError("invalid-argument","Cannot invite yourself");
  return value;
 }
 function publicRequest(doc){
  const d=doc.data();
  return {requestId:doc.id,barcode:d.barcode,status:d.status,reason:d.reason,
    requestedBy:d.requestedBy,createdAt:d.createdAt?.toDate?.()?.toISOString()||null,
    expiresAtMs:d.expiresAtMs??null,approvalId:d.approvalId||null};
 }
 const handlers={};
 handlers.inviteOperator=onCall(options,async req=>{
  const ctx=await identity(req);ownerOnly(ctx);
  const email=clean(req.data?.email,ctx.actor);
  const hash=p.emailDigest(email),owner=ctx.ownerRef,inv=owner.collection("operatorInvites").doc(hash),idx=inviteIndex(hash);
  const now=nowMs(),expiry=now+p.MAX_INVITE_AGE_MS;
  await db.runTransaction(async tx=>{
   const [aSnap,iSnap,idxSnap]=await Promise.all([tx.get(owner),tx.get(inv),tx.get(idx)]);
   if(!aSnap.exists)throw new HttpsError("not-found","Owner account unavailable");
   if(idxSnap.exists&&idxSnap.data().status==="pending"&&idxSnap.data().expiresAtMs>now&&
      idxSnap.data().accountId!==ctx.ownerId)
    throw new HttpsError("already-exists","Pending invitation exists");
   if(iSnap.exists&&iSnap.data().status==="accepted")
    throw new HttpsError("already-exists","Already accepted");
   const value={accountId:ctx.ownerId,emailHash:hash,invitedBy:ctx.actor.uid,
     status:"pending",expiresAtMs:expiry,updatedAt:serverTime()};
   tx.set(inv,value);tx.set(idx,value);
   tx.create(owner.collection("audit").doc(),{action:"operator_invite",invitedEmailHash:hash,by:ctx.actor.uid,createdAt:serverTime()});
  });
  return {invited:true,expiresAtMs:expiry};
 });
 handlers.acceptOperatorInvite=onCall(options,async req=>{
  const actor=principal(req),hash=p.emailDigest(actor.email),idx=inviteIndex(hash),mem=member(actor.uid),self=account(actor.uid),now=nowMs();
  await db.runTransaction(async tx=>{
   const [indexSnap,memberSnap,ownSnap]=await Promise.all([tx.get(idx),tx.get(mem),tx.get(self)]);
   if(memberSnap.exists||ownSnap.exists)throw new HttpsError("failed-precondition","Existing account or membership requires owner-assisted transfer");
   if(!indexSnap.exists)throw new HttpsError("not-found","No active invitation");
   const item=indexSnap.data();try{p.inviteState(item,actor,now)}catch(e){fail(e)}
   if(item.accountId===actor.uid)throw new HttpsError("permission-denied","Owner cannot accept own invitation");
   const owner=account(item.accountId),inv=owner.collection("operatorInvites").doc(hash),opr=owner.collection("operators").doc(actor.uid);
   const [ownerSnap,inviteSnap,oprSnap]=await Promise.all([tx.get(owner),tx.get(inv),tx.get(opr)]);
   if(!ownerSnap.exists)throw new HttpsError("failed-precondition","Owner account unavailable");
   if(!inviteSnap.exists)throw new HttpsError("failed-precondition","Invitation revoked");
   try{p.inviteState(inviteSnap.data(),actor,now)}catch(e){fail(e)}
   if(oprSnap.exists)throw new HttpsError("already-exists","Operator record exists");
   const m={uid:actor.uid,accountId:item.accountId,emailHash:hash,role:"operator",status:"active",createdAt:serverTime()};
   tx.create(mem,m);tx.create(opr,m);
   tx.update(inv,{status:"accepted",acceptedBy:actor.uid,acceptedAt:serverTime()});
   tx.update(idx,{status:"accepted",acceptedBy:actor.uid,acceptedAt:serverTime()});
   tx.create(owner.collection("audit").doc(),{action:"operator_accepted",operatorUid:actor.uid,createdAt:serverTime()});
  });
  return {accepted:true,role:"operator"};
 });
 handlers.listOperators=onCall(options,async req=>{
  const ctx=await identity(req);ownerOnly(ctx);
  const [members,invites]=await Promise.all([
   ctx.ownerRef.collection("operators").limit(50).get(),
   ctx.ownerRef.collection("operatorInvites").where("status","==","pending").limit(50).get()
  ]);
  return {operators:members.docs.map(x=>({uid:x.id,role:"operator",status:x.data().status||"unknown"})),
   pendingInvitations:invites.docs.map(x=>({emailHash:x.id,expiresAtMs:x.data().expiresAtMs||null})),
   truncated:members.size===50||invites.size===50};
 });
 handlers.requestDuplicate=onCall(options,async req=>{
  const ctx=await identity(req);
  if(ctx.role!=="operator")throw new HttpsError("permission-denied","Operator request required");
  let barcode,reason;try{barcode=p.barcodeValue(req.data?.barcode);reason=p.requestReason(req.data?.reason)}catch(e){fail(e)}
  const lock=ctx.ownerRef.collection("barcodeLocks").doc(crypto.createHash("sha256").update(barcode).digest("hex"));
  const request=ctx.ownerRef.collection("duplicateRequests").doc(),now=nowMs();
  await db.runTransaction(async tx=>{
   const [lSnap,mSnap]=await Promise.all([tx.get(lock),tx.get(member(ctx.actor.uid))]);
   try{p.requireMembership(ctx.actor,mSnap.exists?mSnap.data():null,ctx.ownerId)}catch(e){fail(e)}
   if(!lSnap.exists||lSnap.data().status!=="completed"||lSnap.data().barcode!==barcode)
    throw new HttpsError("failed-precondition","Original recording not completed");
   tx.create(request,{accountId:ctx.ownerId,barcode,reason,requestedBy:ctx.actor.uid,
     status:"pending",expiresAtMs:now+MAX_REQUEST_AGE_MS,createdAt:serverTime()});
   tx.create(ctx.ownerRef.collection("audit").doc(),{action:"duplicate_requested",requestId:request.id,requestedBy:ctx.actor.uid,createdAt:serverTime()});
  });
  return {requestId:request.id,status:"pending",expiresAtMs:now+MAX_REQUEST_AGE_MS};
 });
 handlers.myDuplicateRequests=onCall(options,async req=>{
  const ctx=await identity(req);
  const snap=await ctx.ownerRef.collection("duplicateRequests").where("requestedBy","==",ctx.actor.uid).limit(25).get();
  return {requests:snap.docs.map(publicRequest),truncated:snap.size===25};
 });
 handlers.listDuplicateRequests=onCall(options,async req=>{
  const ctx=await identity(req);ownerOnly(ctx);
  const snap=await ctx.ownerRef.collection("duplicateRequests").limit(50).get();
  return {requests:snap.docs.map(publicRequest),truncated:snap.size===50};
 });
 handlers.approveDuplicateRequest=onCall(options,async req=>{
  const ctx=await identity(req);ownerOnly(ctx);
  let id;try{id=p.requestId(req.data?.requestId)}catch(e){fail(e)}
  const request=ctx.ownerRef.collection("duplicateRequests").doc(id),approval=ctx.ownerRef.collection("duplicateApprovals").doc(),now=nowMs();
  await db.runTransaction(async tx=>{
   const snap=await tx.get(request);
   if(!snap.exists)throw new HttpsError("not-found","Request not found");
   const item=snap.data(),lock=ctx.ownerRef.collection("barcodeLocks").doc(crypto.createHash("sha256").update(item.barcode).digest("hex"));
   const [lSnap,mSnap]=await Promise.all([tx.get(lock),tx.get(member(item.requestedBy))]);
   // Approval is owner-authorized. Reject revoked or transferred requesters.
   // The verified-email check happens when that operator next calls the API.
   const requester=mSnap.exists?mSnap.data():null;
   if(!requester||requester.uid!==item.requestedBy||
      requester.accountId!==ctx.ownerId||requester.status!=="active"||
      requester.role!=="operator")
    throw new HttpsError("permission-denied","Requesting operator no longer active");
   try{p.assertApprover(ctx.actor,item,now,lSnap.exists?lSnap.data():null)}catch(e){fail(e)}
   tx.create(approval,{accountId:ctx.ownerId,requestId:id,barcode:item.barcode,reason:item.reason,
     requestedBy:item.requestedBy,approvedBy:ctx.actor.uid,status:"approved",
     expiresAtMs:now+p.MAX_APPROVAL_AGE_MS,createdAt:serverTime()});
   tx.update(request,{status:"approved",approvalId:approval.id,approvedBy:ctx.actor.uid,approvedAt:serverTime()});
   tx.create(ctx.ownerRef.collection("audit").doc(),{action:"duplicate_approved",requestId:id,approvalId:approval.id,approvedBy:ctx.actor.uid,createdAt:serverTime()});
  });
  return {approved:true,approvalId:approval.id,expiresAtMs:now+p.MAX_APPROVAL_AGE_MS};
 });
 handlers.operatorApprovalStatus=onCall(options,async req=>{
  const ctx=await identity(req);
  let id;try{id=p.requestId(req.data?.requestId)}catch(e){fail(e)}
  const snap=await ctx.ownerRef.collection("duplicateRequests").doc(id).get();
  if(!snap.exists)throw new HttpsError("not-found","Request not found");
  try{p.canSeeRequest(ctx.actor,ctx.role,snap.data())}catch(e){fail(e)}
  return publicRequest(snap);
 });
 return handlers;
}
module.exports={createOperatorCallables};
