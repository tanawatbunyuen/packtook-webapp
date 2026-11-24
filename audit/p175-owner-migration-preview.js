"use strict";
// P175 READ-ONLY PREVIEW. Inputs are externally attested evidence summaries;
// this function cannot verify their truth, issue auth tokens or write Firestore.
// NEVER use returned 'REVIEW_CANDIDATE' to authorize a caller or change ownership.
const {createHash}=require("node:crypto");
const STATES=Object.freeze({
 NO_CHANGE:"NO_CHANGE", BLOCK:"BLOCK", MANUAL_REVIEW:"MANUAL_REVIEW",
 REVIEW_CANDIDATE:"REVIEW_CANDIDATE"
});
const validUid=x=>typeof x==="string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const validTicket=x=>typeof x==="string"&&/^P175-[A-Z0-9-]{8,64}$/.test(x);
function previewOwnerMigration(input){
 if(!input||typeof input!=="object"||Array.isArray(input))
  return {state:STATES.BLOCK,reason:"INVALID_EVIDENCE_OBJECT"};
 const {accountId,ownerUid,authUid,accountExists,authUserExists,
  authEmailVerified,authUserDisabled,legacyFormatVerified,
  independentAccountProvenanceVerified,evidenceTicket,
  securityReviewerApproved,accountOwnerApproved,conflictingOwnershipEvidence}=input;
 if(!validUid(accountId)||accountExists!==true)
  return {state:STATES.BLOCK,reason:"UNKNOWN_ACCOUNT"};
 if(ownerUid!==undefined&&ownerUid!==null&&ownerUid!==""){
  if(!validUid(ownerUid))return {state:STATES.BLOCK,reason:"MALFORMED_EXISTING_OWNER"};
  if(ownerUid!==accountId)return {state:STATES.BLOCK,reason:"EXISTING_OWNER_REQUIRES_SEPARATE_INVESTIGATION"};
  return {state:STATES.NO_CHANGE,reason:"EXISTING_OWNER_PRESERVE"};
 }
 if(!validUid(authUid)||authUid!==accountId)
  return {state:STATES.BLOCK,reason:"IDENTITY_ACCOUNT_ID_MISMATCH"};
 if(authUserExists!==true||authEmailVerified!==true||authUserDisabled!==false)
  return {state:STATES.BLOCK,reason:"AUTH_IDENTITY_NOT_ESTABLISHED"};
 if(conflictingOwnershipEvidence!==false)
  return {state:STATES.BLOCK,reason:"OWNERSHIP_CONFLICT_UNRESOLVED"};
 if(legacyFormatVerified!==true||independentAccountProvenanceVerified!==true)
  return {state:STATES.MANUAL_REVIEW,reason:"LEGACY_PROVENANCE_INCOMPLETE"};
 if(!validTicket(evidenceTicket)||securityReviewerApproved!==true||accountOwnerApproved!==true)
  return {state:STATES.MANUAL_REVIEW,reason:"INDEPENDENT_APPROVAL_INCOMPLETE"};
 const proofFingerprint=createHash("sha256").update(
  ["P175",accountId,evidenceTicket].join("|"),"utf8").digest("hex").slice(0,16);
 return {state:STATES.REVIEW_CANDIDATE,reason:"REQUIRES_HUMAN_CONTROLLED_MIGRATION",
  accountId,proposedOwnerUid:authUid,proofFingerprint,
  previewOnly:true,authorizedToWrite:false};
}
module.exports={STATES,previewOwnerMigration};
