"use strict";
/**
 * PACKTOOK operator/duplicate policy primitives — security candidate only.
 * Pure functions, no Firebase calls. Integration in shared-tenant handlers
 * requires a separate security review and staged test authorization.
 */
const crypto=require("node:crypto");
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_ID_RE=/^[A-Za-z0-9_-]{16,100}$/;
const MAX_INVITE_AGE_MS=24*60*60*1000;
const MAX_APPROVAL_AGE_MS=5*60*1000;

function emailAddress(value){
 if(typeof value!=="string")throw new TypeError("Verified email required");
 const v=value.trim().toLowerCase();
 if(v.length>254||!EMAIL_RE.test(v))throw new TypeError("Invalid email address");
 return v;
}
function emailDigest(value){
 return crypto.createHash("sha256").update(emailAddress(value),"utf8").digest("hex");
}
function verifiedPrincipal(req){
 const token=req?.auth?.token;
 const uid=req?.auth?.uid;
 if(typeof uid!=="string"||!uid||!token)throw new Error("UNAUTHENTICATED");
 if(token.email_verified!==true)throw new Error("EMAIL_NOT_VERIFIED");
 return {uid,email:emailAddress(token.email)};
}
function requireMembership(principal,membership,accountId){
 if(!principal||typeof principal.uid!=="string")throw new Error("UNAUTHENTICATED");
 if(!membership||membership.uid!==principal.uid||membership.status!=="active"||
    membership.accountId!==accountId||membership.emailHash!==emailDigest(principal.email))
  throw new Error("MEMBERSHIP_NOT_AUTHORIZED");
 if(!["operator","admin"].includes(membership.role))throw new Error("ROLE_NOT_AUTHORIZED");
 return membership.role;
}
function requireOwner(principal,accountId){
 if(!principal||principal.uid!==accountId)throw new Error("OWNER_ONLY");
 return true;
}
function inviteState(invite,principal,now){
 if(!invite||invite.status!=="pending")throw new Error("INVITE_NOT_PENDING");
 if(invite.emailHash!==emailDigest(principal.email))throw new Error("INVITE_EMAIL_MISMATCH");
 if(!Number.isSafeInteger(invite.expiresAtMs)||invite.expiresAtMs<=now)throw new Error("INVITE_EXPIRED");
 if(!invite.accountId||!invite.invitedBy||invite.invitedBy!==invite.accountId)throw new Error("INVITE_OWNER_INVALID");
 return true;
}
function requestReason(value){
 if(typeof value!=="string")throw new TypeError("Invalid reason");
 const v=value.trim();
 if(v.length<10||v.length>500)throw new TypeError("Reason must be 10-500 characters");
 return v;
}
function barcodeValue(value){
 if(typeof value!=="string")throw new TypeError("Invalid barcode");
 const v=value.trim();
 if(!v||v.length>160)throw new TypeError("Invalid barcode");
 return v;
}
function requestId(value){
 if(typeof value!=="string"||!REQUEST_ID_RE.test(value))throw new TypeError("Invalid request ID");
 return value;
}
function canSeeRequest(principal,role,request){
 if(!request||!principal)throw new Error("UNAUTHORIZED_REQUEST");
 if(role==="admin"&&request.accountId===principal.uid)return true;
 if(role==="operator"&&request.requestedBy===principal.uid)return true;
 throw new Error("UNAUTHORIZED_REQUEST");
}
function assertApprover(principal,request,now,lock){
 if(!request||request.status!=="pending")throw new Error("REQUEST_NOT_PENDING");
 requireOwner(principal,request.accountId);
 if(request.requestedBy===principal.uid)throw new Error("SELF_APPROVAL_FORBIDDEN");
 if(!Number.isSafeInteger(request.expiresAtMs)||request.expiresAtMs<=now)throw new Error("REQUEST_EXPIRED");
 if(!lock||lock.status!=="completed"||lock.barcode!==request.barcode)
  throw new Error("ORIGINAL_RECORDING_NOT_COMPLETED");
 return true;
}
function assertApprovalUse(approval,request,principal,now,barcode){
 if(!approval||approval.status!=="approved"||approval.requestedBy!==principal.uid)
  throw new Error("APPROVAL_NOT_AUTHORIZED");
 if(!request||request.status!=="approved"||approval.requestId!==request.id||
    request.requestedBy!==principal.uid)throw new Error("REQUEST_NOT_AUTHORIZED");
 if(!Number.isSafeInteger(approval.expiresAtMs)||approval.expiresAtMs<=now)
  throw new Error("APPROVAL_EXPIRED");
 if(approval.barcode!==barcode||request.barcode!==barcode)throw new Error("BARCODE_MISMATCH");
 return true;
}
module.exports={
 emailAddress,emailDigest,verifiedPrincipal,requireMembership,requireOwner,inviteState,
 requestReason,barcodeValue,requestId,canSeeRequest,assertApprover,assertApprovalUse,
 MAX_INVITE_AGE_MS,MAX_APPROVAL_AGE_MS
};
