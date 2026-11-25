"use strict";
// P203 — offline-only structured reviewer handoff; does not authenticate reviewers or grant approvals.
const {consolidate}=require("../p202/reconcile");
const {EXPECTED_CANDIDATE,REQUIREMENTS}=require("../p190/reconcile");
const {BUILD,REVISION}=require("../p198/verify");
const REQUIREMENT_ORDER=Object.keys(REQUIREMENTS);
const ownerScope={STAGING_LEGACY_INVENTORY:"Staging Cloud Operator",
 PROD_LEGACY_INVENTORY:"Separately authorized Production Cloud Operator",
 STAGING_VALID_APPCHECK:"Staging App Check Operator",
 OWNER_PROVENANCE_REMEDIATION:"Independent Security Reviewer",
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:"Independent Security Reviewer"};
const acceptance={
 STAGING_LEGACY_INVENTORY:"Authorized complete staging Auth/Firestore aggregate inventory, no unresolved owner conflicts or lookup errors; independent provenance required.",
 PROD_LEGACY_INVENTORY:"Separate explicit production READ authorization; sanitized complete inventory, independent verification; no writes.",
 STAGING_VALID_APPCHECK:"Authorized genuine staging Auth/AppCheck token provenance plus negative and positive responses against exact function revision.",
 OWNER_PROVENANCE_REMEDIATION:"Independently reviewed legacy owner identity and conflicts, no auto-backfill or imports.",
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:"Independent review of exact P188 pinned candidate diff, Cloud Build source lineage, deployed revision, and security gates."};
function packet({claims={},signoffs={}}={}){
 if(!signoffs||typeof signoffs!=="object"||Array.isArray(signoffs)||Object.keys(signoffs).some(x=>!REQUIREMENT_ORDER.includes(x)))
  throw Error("P203_UNKNOWN_REVIEW_SIGNOFF");
 const p=consolidate({claims});
 const req=REQUIREMENT_ORDER.map(id=>{
  const claim=signoffs[id];
  const issues=[];
  if(claim!==undefined){
   if(!claim||typeof claim!=="object"||Array.isArray(claim)||
      Object.keys(claim).some(k=>!["reviewerRole","decision","evidenceReference","candidateSha256","project"].includes(k)))
    issues.push("UNTRUSTED_SIGNOFF_SHAPE_OR_PII");
   else{
    if(claim.project!==REQUIREMENTS[id].project)issues.push("REVIEW_PROJECT_MISMATCH");
    if(claim.candidateSha256!==EXPECTED_CANDIDATE)issues.push("RELEASE_CANDIDATE_SHA_DRIFT");
    if(claim.reviewerRole!==ownerScope[id])issues.push("REVIEWER_ROLE_CLAIM_DRIFT");
    if(claim.decision!=="APPROVED_FOR_REVIEW")issues.push("REVIEWER_DECISION_NOT_APPROVED");
    if(typeof claim.evidenceReference!=="string"||
       !/^G02-EVIDENCE-[A-Z0-9-]{8,60}$/.test(claim.evidenceReference))
      issues.push("EVIDENCE_REFERENCE_INVALID");
   }
  }
  return {requirement:id,project:REQUIREMENTS[id].project,responsibleRole:ownerScope[id],
   acceptanceCriteria:acceptance[id],
   classification:claim===undefined?"NOT_SUPPLIED":issues.length?"REJECTED":"SELF_ASSERTED_NOT_VERIFIED",
   issues,independentConfirmation:false};
 });
 return {schema:"packtook-p203-independent-security-handoff-v1",scope:"REVIEW_ONLY",
  candidateSha256:EXPECTED_CANDIDATE,referenceBuild:BUILD,referenceRevision:REVISION,
  claimRecords:p.records,requirements:req,requiredCount:req.length,
  externalIndependentlyVerified:0,
  selfAssertedSignoffs:req.filter(x=>x.classification==="SELF_ASSERTED_NOT_VERIFIED").length,
  reviewerIdentityVerified:false,sourceContainerByteEqualityVerified:false,
  appCheckRealStagingVerified:false,legacyOwnerVerified:false,
  productionReadAuthorizedByThisPacket:false,
  independentSecurityDecision:"NOT_PERFORMED",
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED",
  warning:"Never treat self-declared signoff as independently authenticated. Security release review requires protected original evidence and separate authority."};
}
module.exports={packet,REQUIREMENT_ORDER};
