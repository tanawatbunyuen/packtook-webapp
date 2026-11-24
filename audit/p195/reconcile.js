"use strict";
/**
 * P195 — staging evidence reconciliation (OFFLINE).
 * NO live cloud reads, no token collection, no approval authority.
 * Accept only sanitized local operator observations; never claim their authenticity.
 */
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const TARGET="projects/packtook-staging/locations/asia-southeast1/functions/usageStatus";
const ENDPOINT="https://asia-southeast1-packtook-staging.cloudfunctions.net/usageStatus";
const REVISION=/^[a-z][a-z0-9-]{5,120}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const TICKET=/^G02-[A-Z0-9-]{8,60}$/;
const allowed={
 runtime:["project","functionResource","endpoint","region","revision","state","runtime","observedAt","candidateSha256","artifactSha256","ticket"],
 inventory:["project","scope","observedAt","complete","scanned","authLookupErrors","ownerConflicts","artifactSha256","ticket"],
 appCheck:["project","functionResource","revision","observedAt","missingTokenHttp","validTokenHttp","artifactSha256","ticket"],
 securityReview:["candidateSha256","reviewerRole","reviewerDecision","artifactSha256","ticket","observedAt","independentVerificationRef"]
};
function shape(o,fields){
 return !!o&&typeof o==="object"&&!Array.isArray(o)&&Object.keys(o).every(k=>fields.includes(k));
}
function timeValid(v,now){
 const t=typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(v)?Date.parse(v):NaN;
 const n=Date.parse(now);
 return Number.isFinite(t)&&Number.isFinite(n)&&t<=n&&n-t<=7*86400000;
}
function appendIf(errors,condition,code){if(!condition)errors.push(code);}
function testObservation(type,obs,now,revision){
 const errors=[];
 if(obs==null)return ["MISSING"];
 if(!shape(obs,allowed[type]))return ["UNEXPECTED_FIELDS_OR_PII"];
 const sha=obs.artifactSha256;
 appendIf(errors,DIGEST.test(sha||""),"EVIDENCE_DIGEST_INVALID");
 appendIf(errors,TICKET.test(obs.ticket||""),"TICKET_FORMAT_INVALID");
 appendIf(errors,timeValid(obs.observedAt,now),"TIMESTAMP_INVALID_OR_STALE");
 if(type==="runtime"){
  appendIf(errors,obs.project==="packtook-staging","WRONG_PROJECT");
  appendIf(errors,obs.functionResource===TARGET,"WRONG_FUNCTION");
  appendIf(errors,obs.region==="asia-southeast1","WRONG_REGION");
  appendIf(errors,obs.endpoint===ENDPOINT,"ENDPOINT_NOT_PINNED");
  appendIf(errors,obs.state==="ACTIVE","RUNTIME_NOT_ACTIVE");
  appendIf(errors,typeof obs.runtime==="string"&&/^nodejs(?:20|22|24)$/.test(obs.runtime),"UNEXPECTED_NODE_RUNTIME");
  appendIf(errors,typeof obs.revision==="string"&&REVISION.test(obs.revision),"REVISION_INVALID");
  appendIf(errors,obs.candidateSha256===EXPECTED_CANDIDATE,"RELEASE_CANDIDATE_HASH_MISMATCH");
 }else if(type==="inventory"){
  appendIf(errors,obs.project==="packtook-staging","WRONG_PROJECT");
  appendIf(errors,obs.scope==="FIRESTORE_AUTH_READ_ONLY","NOT_READ_ONLY_INVENTORY");
  appendIf(errors,obs.complete===true,"TRUNCATED_SCAN");
  appendIf(errors,Number.isSafeInteger(obs.scanned)&&obs.scanned>=0,"SCANNED_INVALID");
  appendIf(errors,obs.authLookupErrors===0,"AUTH_LOOKUP_ERRORS");
  appendIf(errors,obs.ownerConflicts===0,"OWNER_CONFLICTS_REQUIRE_REVIEW");
 }else if(type==="appCheck"){
  appendIf(errors,obs.project==="packtook-staging","WRONG_PROJECT");
  appendIf(errors,obs.functionResource===TARGET,"WRONG_FUNCTION");
  appendIf(errors,revision&&obs.revision===revision,"REVISION_MISMATCH");
  appendIf(errors,[401,403].includes(obs.missingTokenHttp),"MISSING_APPCHECK_NOT_DENIED");
  appendIf(errors,obs.validTokenHttp===200,"POSITIVE_APPCHECK_NOT_ACCEPTED");
 }else if(type==="securityReview"){
  appendIf(errors,obs.candidateSha256===EXPECTED_CANDIDATE,"SECURITY_REVIEW_HASH_MISMATCH");
  appendIf(errors,obs.reviewerRole==="IndependentSecurityReviewer","REVIEWER_ROLE_NOT_INDEPENDENT");
  appendIf(errors,obs.reviewerDecision==="APPROVED_FOR_STAGING_REVIEW","SECURITY_REVIEW_NOT_APPROVED");
  appendIf(errors,typeof obs.independentVerificationRef==="string"&&
   /^G02-REVIEW-[A-Z0-9-]{8,60}$/.test(obs.independentVerificationRef),"REVIEW_PROOF_REFERENCE_MISSING");
 }
 return errors;
}
function reconcile({observations={},now="2026-11-24T23:59:59+07:00"}={}){
 if(!shape(observations,Object.keys(allowed)))throw Error("P195_UNKNOWN_OBSERVATION");
 const revision=observations.runtime?.revision;
 const results=Object.keys(allowed).map(type=>{
  const errors=testObservation(type,observations[type],now,revision);
  return {type,status:errors.length?(errors[0]==="MISSING"?"MISSING":"REJECTED"):
    "CLAIMED_NOT_INDEPENDENTLY_VERIFIED",issues:errors};
 });
 return {
  schema:"packtook-p195-staging-evidence-review-v1",
  project:"packtook-staging",
  candidateSha256:EXPECTED_CANDIDATE,
  evidence:results,
  submitted:results.filter(x=>x.status!=="MISSING").length,
  metadataAccepted:results.filter(x=>x.status==="CLAIMED_NOT_INDEPENDENTLY_VERIFIED").length,
  independentlyVerified:0,
  externalP190ProductionInventoryStillMissing:true,
  candidateDeployedOrStagingAttested:false,
  identityAttestation:false,
  stagingReadiness: "PENDING_INDEPENDENT_REVIEW",
  g02Decision:"NO_GO",
  releaseDecision:"NO_GO_RELEASE",
  deployment:"NO_GO_DEPLOY",
  signup:"KEEP_CLOSED",
  caveat:"Operator metadata and digests are self-assertions until independently checked against protected original evidence and IAM/revision; no deployment approval"
 };
}
module.exports={reconcile,testObservation,TARGET,ENDPOINT,EXPECTED_CANDIDATE};
