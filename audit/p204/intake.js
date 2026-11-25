"use strict";
/**
 * P204 independent review evidence intake, OFFLINE ONLY.
 * The input is untrusted sanitized metadata. It may classify documents, but
 * MUST NEVER make an authentication or independent verification claim.
 */
const {createHash}=require("node:crypto");
const {REQUIREMENTS,EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {BUILD,REVISION}=require("../p198/verify");
const {packet}=require("../p203/handoff");
const KEYS=Object.keys(REQUIREMENTS);
const ID=/^G02-EVIDENCE-[A-Z0-9-]{8,60}$/;
const SHA=/^[a-f0-9]{64}$/;
const TICKET=/^G02-[A-Z0-9-]{8,60}$/;
const ALLOWED=new Set(["requirement","project","kind","candidateSha256","artifactSha256",
 "reference","ticket","capturedAt","submittedAt","operatorRole","reportedOutcome",
 "proposedReviewerDecision","revision","buildId"]);
const roles=Object.freeze({
 STAGING_LEGACY_INVENTORY:"Staging Cloud Operator",
 PROD_LEGACY_INVENTORY:"Separately authorized Production Cloud Operator",
 STAGING_VALID_APPCHECK:"Staging App Check Operator",
 OWNER_PROVENANCE_REMEDIATION:"Independent Security Reviewer",
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:"Independent Security Reviewer"
});
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function dateOk(x,asOf){
 if(typeof x!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(x))return false;
 const t=Date.parse(x),now=Date.parse(asOf);
 return Number.isFinite(t)&&Number.isFinite(now)&&t<=now&&now-t<=30*86400000;
}
function receipt(evidence,{asOf="2026-11-25T12:00:00+07:00"}={}){
 const issues=[];
 const check=(ok,code)=>{if(!ok)issues.push(code)};
 if(!isObj(evidence)||Object.keys(evidence).some(k=>!ALLOWED.has(k))){
  return {state:"REJECTED",issues:["INVALID_SHAPE_OR_RAW_DATA"],receiptFingerprint:null};
 }
 const id=evidence.requirement;
 const spec=REQUIREMENTS[id];
 check(!!spec,"UNKNOWN_REQUIREMENT");
 if(spec){
  check(evidence.project===spec.project,"CROSS_PROJECT_REFUSED");
  check(evidence.kind===spec.kind,"EVIDENCE_KIND_MISMATCH");
  check(evidence.operatorRole===roles[id],"REPORTED_OPERATOR_ROLE_MISMATCH");
 }
 check(evidence.candidateSha256===EXPECTED_CANDIDATE,"CANDIDATE_SHA256_MISMATCH");
 check(SHA.test(evidence.artifactSha256||""),"ARTIFACT_SHA256_INVALID");
 check(ID.test(evidence.reference||""),"REFERENCE_INVALID");
 check(TICKET.test(evidence.ticket||""),"TICKET_INVALID");
 check(dateOk(evidence.capturedAt,asOf),"CAPTURE_DATE_STALE_OR_FUTURE");
 check(dateOk(evidence.submittedAt,asOf),"SUBMISSION_DATE_STALE_OR_FUTURE");
 if(dateOk(evidence.capturedAt,asOf)&&dateOk(evidence.submittedAt,asOf))
  check(Date.parse(evidence.capturedAt)<=Date.parse(evidence.submittedAt),"SUBMITTED_BEFORE_CAPTURE");
 check(evidence.reportedOutcome==="PASS","REPORTED_OUTCOME_NOT_PASS");
 check(evidence.revision===REVISION,"REVISION_NOT_PINNED");
 check(evidence.buildId===BUILD,"BUILD_NOT_PINNED");
 // An untrusted proposed reviewer decision cannot imply verified credentials.
 if(evidence.proposedReviewerDecision!==undefined)
  check(["PENDING","APPROVED_FOR_REVIEW","REJECTED"].includes(evidence.proposedReviewerDecision),
   "INVALID_REVIEWER_DECISION");
 if(issues.length)return {state:"REJECTED",issues,receiptFingerprint:null};
 // Fingerprint sanitized metadata only, not provider certificate, proof of identity,
 // trust anchor, source archive SHA, or signature verification.
 const fingerprint=createHash("sha256").update([
  id,evidence.project,evidence.reference,evidence.artifactSha256,
  evidence.ticket,evidence.capturedAt,evidence.submittedAt].join("\u001f")).digest("hex");
 return {state:"SUBMITTED",issues:[],receiptFingerprint:fingerprint};
}
function intake({submissions=[],claims={},asOf="2026-11-25T12:00:00+07:00"}={}){
 if(!Array.isArray(submissions)||submissions.length>100)throw Error("P204_BATCH_INVALID");
 const seenReferences=new Set(),seenFingerprints=new Set();
 const records=submissions.map((record,index)=>{
  const r=receipt(record,{asOf}),issues=[...r.issues];
  if(r.state==="SUBMITTED"){
   if(seenReferences.has(record.reference)||seenFingerprints.has(r.receiptFingerprint))
    issues.push("REPLAY_OR_DUPLICATE_REFERENCE");
   else{seenReferences.add(record.reference);seenFingerprints.add(r.receiptFingerprint)}
  }
  return {
   row:index+1,
   requirement:KEYS.includes(record?.requirement)?record.requirement:"UNKNOWN",
   state:issues.length?"REJECTED":"SUBMITTED",
   issues,
   // Derived opaque SHA only: no raw operator metadata or customer data.
   receiptFingerprint:issues.length?null:r.receiptFingerprint,
   independentlyVerified:false
  };
 });
 const p=packet({claims});
 return {
  schema:"packtook-p204-evidence-intake-v1",
  scope:"OFFLINE_REVIEW_ONLY",
  candidateSha256:EXPECTED_CANDIDATE,
  records,submitted:records.filter(r=>r.state==="SUBMITTED").length,
  rejected:records.filter(r=>r.state==="REJECTED").length,
  externallyIndependentlyVerified:0,
  reviewerIdentityCryptographicallyVerified:false,
  originalEvidenceAuthenticityVerified:false,
  appCheckTokensVerified:false,ownerProvenanceVerified:false,
  fiveExternalG02RequirementsRemainUnverified:p.requiredCount,
  verifiedStateUnavailableInOfflineMode:true,
  productionReadAuthorizationGranted:false,
  cloudCalls:0,cloudWrites:0,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED",
  note:"A SUBMITTED item means locally validated metadata, not verified source, trusted reviewer, or release approval."
 };
}
module.exports={intake,receipt,KEYS};
