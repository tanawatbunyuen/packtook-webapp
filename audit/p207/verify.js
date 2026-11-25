"use strict";
/** P207: Offline sanitized provenance readiness only.
 * No ZIP downloading, source-byte comparison, cloud calls, or release authority.
 */
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {BUILD,REVISION,PROJECT}=require("../p198/verify");
const {SOURCE}=require("../p199/verify");
const {EXPECTED_DIGEST}=require("../p201/verify");
const FIELDS=new Set(["project","function","revision","build","sourceGeneration",
 "candidateSha256","revisionImageDigest","buildOutputImageDigest",
 "sourceArchiveAvailability","sourceArchiveByteEqualityReview",
 "imageAvailability","operatorIndependentAttestation","reviewerIndependentAttestation",
 "reviewTicket","sourceEvidenceReference"]);
const obj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
const sha=x=>typeof x==="string"&&/^sha256:[a-f0-9]{64}$/.test(x);
const candidate=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
function reconcile(input){
 const errors=[],missing=[];
 if(!obj(input)||Object.keys(input).some(k=>!FIELDS.has(k)))
  return {schema:"packtook-p207-source-provenance-readiness-v1",classification:"REJECTED",
   errors:["UNSAFE_OR_UNEXPECTED_FIELDS"],g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
   deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED"};
 const fail=(v,c)=>{if(!v)errors.push(c)};
 const need=(v,c)=>{if(!v)missing.push(c)};
 fail(input.project===PROJECT,"PROJECT_DRIFT");
 fail(input.function==="usageStatus","FUNCTION_DRIFT");
 fail(input.revision===REVISION,"REVISION_DRIFT");
 fail(input.build===BUILD,"BUILD_DRIFT");
 fail(input.sourceGeneration===SOURCE,"SOURCE_GENERATION_DRIFT");
 fail(input.candidateSha256===EXPECTED_CANDIDATE,"P188_CANDIDATE_DRIFT");
 fail(input.revisionImageDigest===EXPECTED_DIGEST,"REVISION_DIGEST_DRIFT");
 if(input.buildOutputImageDigest!=null){
  fail(sha(input.buildOutputImageDigest),"BUILD_DIGEST_MALFORMED");
  if(sha(input.buildOutputImageDigest))
   fail(input.buildOutputImageDigest===input.revisionImageDigest,"BUILD_REVISION_IMAGE_DIGEST_MISMATCH");
 }else missing.push("BUILD_OUTPUT_IMAGE_DIGEST_MISSING");
 if(input.sourceArchiveAvailability!=="AVAILABLE")missing.push("SOURCE_ARCHIVE_BYTES_UNAVAILABLE");
 if(input.imageAvailability!=="AVAILABLE")missing.push("ARTIFACT_IMAGE_UNAVAILABLE");
 // A label of MATCHED is an unverified assertion until protected original evidence
 // and reviewer identity are independently authenticated in an external system.
 if(input.sourceArchiveByteEqualityReview!=="MATCHED")missing.push("SOURCE_TO_P188_BYTE_EQUALITY_NOT_CLAIMED");
 need(input.operatorIndependentAttestation===true,"OPERATOR_ATTESTATION_MISSING");
 need(input.reviewerIndependentAttestation===true,"REVIEWER_ATTESTATION_MISSING");
 need(typeof input.reviewTicket==="string"&&/^G02-[A-Z0-9-]{8,60}$/.test(input.reviewTicket),"REVIEW_TICKET_MISSING");
 need(typeof input.sourceEvidenceReference==="string"&&/^G02-EVIDENCE-[A-Z0-9-]{8,60}$/.test(input.sourceEvidenceReference),"PROTECTED_EVIDENCE_REFERENCE_MISSING");
 return {
  schema:"packtook-p207-source-provenance-readiness-v1",
  classification:errors.length?"REJECTED":"CLAIMED_NOT_INDEPENDENTLY_VERIFIED",
  project:PROJECT,referenceBuild:BUILD,referenceRevision:REVISION,
  buildRevisionImageDigestMetadataMatches:sha(input.buildOutputImageDigest)&&input.buildOutputImageDigest===input.revisionImageDigest,
  sourceArchiveAvailabilityReported:input.sourceArchiveAvailability==="AVAILABLE",
  sourceToP188EqualityClaimed:input.sourceArchiveByteEqualityReview==="MATCHED",
  errors,missing,
  deployedP188SourceProven:false,
  sourceByteEqualityIndependentlyVerified:false,
  reviewerIdentityVerified:false,
  cleanupDeletionCausalityProven:false,
  independentlyVerifiedExternalTracks:0,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED",
  cloudCalls:0,cloudWrites:0
 };
}
module.exports={reconcile,FIELDS};
