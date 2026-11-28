"use strict";
/**
 * Pure, fail-closed authorization policy for transactional shared-credit changes.
 * All membership/approval/recording snapshots MUST be read within one Firestore
 * transaction prior to invoking this module. This module performs no writes.
 */
const crypto=require("node:crypto");
const {emailDigest}=require("./operator-domain-v1.cjs");
class PolicyDenied extends Error{constructor(reason){super(reason);this.name="PolicyDenied"}}
function deny(reason){throw new PolicyDenied(reason)}
function isString(value){return typeof value==="string"&&value.length>0}
function validCtx(ctx){
 if(!ctx||!isString(ctx.actorUid)||!isString(ctx.accountId)||
 !["admin","operator"].includes(ctx.role))deny("INVALID_CONTEXT");
 if(ctx.role==="admin"&&ctx.actorUid!==ctx.accountId)deny("ADMIN_OWNER_MISMATCH");
 if(ctx.role==="operator"&&ctx.actorUid===ctx.accountId)deny("OPERATOR_OWNER_COLLISION");
}
function assertTransactionMembership(ctx,membership,verifiedEmail){
 validCtx(ctx);
 if(ctx.role==="admin"){
   if(membership!==null&&membership!==undefined)deny("OWNER_HAS_OPERATOR_MEMBERSHIP");
   return true;
 }
 if(!isString(verifiedEmail))deny("VERIFIED_EMAIL_REQUIRED");
 if(!membership||membership.uid!==ctx.actorUid||membership.accountId!==ctx.accountId||
 membership.status!=="active"||membership.role!=="operator"||
 membership.emailHash!==emailDigest(verifiedEmail))deny("MEMBERSHIP_REVOKED_OR_MISMATCH");
 return true;
}
function assertReservationCreate(ctx,membership,verifiedEmail,{accountOwnerUid,recordingExists=false}={}){
 assertTransactionMembership(ctx,membership,verifiedEmail);
 if(accountOwnerUid!==ctx.accountId)deny("TENANT_ACCOUNT_MISMATCH");
 if(recordingExists)deny("OPERATION_ALREADY_EXISTS");
 return {recordedBy:ctx.actorUid,accountId:ctx.accountId};
}
function assertFinalization(ctx,membership,verifiedEmail,{accountOwnerUid,recording,operationId}={}){
 assertTransactionMembership(ctx,membership,verifiedEmail);
 if(accountOwnerUid!==ctx.accountId)deny("TENANT_ACCOUNT_MISMATCH");
 if(!recording||recording.status!=="reserved"||recording.accountId!==ctx.accountId)
  deny("RECORDING_NOT_RESERVED_OR_TENANT_MISMATCH");
 if(!isString(operationId)||recording.operationId!==operationId)
  deny("RECORDING_OPERATION_MISMATCH");
 if(recording.recordedBy!==ctx.actorUid)deny("RECORDING_ACTOR_MISMATCH");
 return true;
}
function assertDuplicateApprovalUse(ctx,membership,verifiedEmail,{approval,request,barcode,nowMs}={}){
 assertTransactionMembership(ctx,membership,verifiedEmail);
 if(ctx.role!=="operator")deny("OPERATOR_APPROVAL_REQUIRED");
 if(!Number.isSafeInteger(nowMs))deny("INVALID_NOW");
 if(!isString(barcode)||!request||!approval)deny("APPROVAL_MISSING");
 if(approval.accountId!==ctx.accountId||request.accountId!==ctx.accountId||
 approval.requestedBy!==ctx.actorUid||request.requestedBy!==ctx.actorUid)
  deny("APPROVAL_TENANT_OR_ACTOR_MISMATCH");
 if(approval.status!=="approved"||request.status!=="approved")
  deny("APPROVAL_NOT_AVAILABLE");
 if(!isString(approval.requestId)||approval.requestId!==request.id||
 !isString(request.approvalId)||request.approvalId!==approval.id)
  deny("APPROVAL_REQUEST_LINK_MISMATCH");
 if(approval.barcode!==barcode||request.barcode!==barcode)deny("APPROVAL_BARCODE_MISMATCH");
 if(!Number.isSafeInteger(approval.expiresAtMs)||approval.expiresAtMs<=nowMs)
  deny("APPROVAL_EXPIRED");
 return true;
}
module.exports={PolicyDenied,assertTransactionMembership,assertReservationCreate,
 assertFinalization,assertDuplicateApprovalUse};
