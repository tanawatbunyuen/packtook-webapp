"use strict";
// P174 REVIEW CANDIDATE ONLY. NEVER wired into production exports.
// Authorization must be based on verified request identity and persisted ownerUid,
// never on accountRef.id === authenticated uid or client-supplied role flags.
class AuthorizationError extends Error {
 constructor(code,message){super(message);this.code=code;this.name="AuthorizationError";}
}
function verifiedUid(req){
 if(!req||!req.auth||typeof req.auth.uid!=="string"||!req.auth.uid)
  throw new AuthorizationError("unauthenticated","Sign in required");
 if(req.auth.token?.email_verified!==true)
  throw new AuthorizationError("permission-denied","Verified email required");
 return req.auth.uid;
}
function requirePersistedAccountOwner(req,account){
 const id=verifiedUid(req);
 if(!account||account.exists!==true)
  throw new AuthorizationError("permission-denied","Account ownership not established");
 const saved=account.data;
 if(!saved||typeof saved.ownerUid!=="string"||saved.ownerUid!==id)
  throw new AuthorizationError("permission-denied","Explicit account owner required");
 return id;
}
function accountRoleCandidate(req,account){
 const id=requirePersistedAccountOwner(req,account);
 return {role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false};
}
function duplicateApprovalCandidate(req,account,duplicateLock){
 const id=requirePersistedAccountOwner(req,account);
 if(!duplicateLock||duplicateLock.exists!==true||duplicateLock.status!=="completed")
  throw new AuthorizationError("failed-precondition","Completed recording required");
 return {approvedBy:id,mayCreateApproval:true};
}
module.exports={AuthorizationError,verifiedUid,requirePersistedAccountOwner,accountRoleCandidate,duplicateApprovalCandidate};
