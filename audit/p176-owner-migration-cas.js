"use strict";
// P176 review-only compare-and-swap candidate. NO Firestore SDK, writes, tokens or cloud access.
const {STATES,previewOwnerMigration}=require("./p175-owner-migration-preview");
const DECISION=Object.freeze({BLOCK:"BLOCK",REVIEW:"REVIEW",NO_CHANGE:"NO_CHANGE",CANDIDATE_ONLY:"CANDIDATE_ONLY"});
function inspectCas({previewInput,observed,latest,operatorEvidence}={}){
  // Deliberately reject missing document revisions or unexpected changes before suggesting any write.
  if(!observed||!latest||typeof observed!=="object"||typeof latest!=="object")
    return {decision:DECISION.BLOCK,reason:"MISSING_SNAPSHOTS",authorizedToWrite:false};
  if(!Number.isSafeInteger(observed.revision)||observed.revision<0||
     !Number.isSafeInteger(latest.revision)||latest.revision<0)
    return {decision:DECISION.BLOCK,reason:"INVALID_REVISION",authorizedToWrite:false};
  if(observed.revision!==latest.revision||observed.accountId!==latest.accountId||
     observed.ownerUid!==latest.ownerUid)
    return {decision:DECISION.BLOCK,reason:"STALE_OR_CHANGED_ACCOUNT",authorizedToWrite:false};
  if(!previewInput||previewInput.accountId!==latest.accountId||
     previewInput.ownerUid!==latest.ownerUid)
    return {decision:DECISION.BLOCK,reason:"PREVIEW_SNAPSHOT_MISMATCH",authorizedToWrite:false};
  if(!operatorEvidence||operatorEvidence.independentlyVerified!==true||
     typeof operatorEvidence.caseReference!=="string"||
     !/^P176-[A-Z0-9-]{8,64}$/.test(operatorEvidence.caseReference))
    return {decision:DECISION.REVIEW,reason:"OPERATOR_EVIDENCE_UNVERIFIED",authorizedToWrite:false};
  const preview=previewOwnerMigration(previewInput);
  if(preview.state===STATES.NO_CHANGE)
    return {decision:DECISION.NO_CHANGE,reason:"EXISTING_OWNER_UNCHANGED",authorizedToWrite:false};
  if(preview.state!==STATES.REVIEW_CANDIDATE)
    return {decision:preview.state===STATES.BLOCK?DECISION.BLOCK:DECISION.REVIEW,reason:preview.reason,authorizedToWrite:false};
  return {decision:DECISION.CANDIDATE_ONLY,reason:"TRANSACTION_AND_APPROVAL_NOT_IMPLEMENTED",
    accountId:latest.accountId,expectedRevision:latest.revision,
    proposedOwnerUid:preview.proposedOwnerUid,authorizedToWrite:false,previewOnly:true};
}
module.exports={DECISION,inspectCas};
