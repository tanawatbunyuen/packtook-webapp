"use strict";
// Offline only; compare provider metadata strictly, never authenticate source/image.
const {BUILD,GCS,REVISION,PROJECT}=require("../p198/verify");
const SOURCE="gs://"+GCS.bucket+"/"+GCS.object+"#"+GCS.generation;
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const IMAGE=/^asia-southeast1-docker\.pkg\.dev\/packtook-staging\/[a-z0-9-]+\/[a-z0-9._/-]+$/;
const target="usageStatus",region="asia-southeast1";
function imageRef(x){return typeof x==="string"&&IMAGE.test(x.replace(/@sha256:[a-f0-9]{64}$/,""))}
function result({build,revision}={}){
 const failures=[],pending=[];
 const fail=(ok,code)=>{if(!ok)failures.push(code)};
 const needs=(ok,code)=>{if(!ok)pending.push(code)};
 if(!build||typeof build!=="object"||Array.isArray(build))return {
  schema:"packtook-p199-build-image-revision-v1",failures:["BUILD_METADATA_MISSING"],
  pending:["REVISION_IMAGE_DIGEST_REQUIRED","BUILD_IMAGE_DIGEST_REQUIRED","SOURCE_ARCHIVE_CONTENTS_NOT_ATTESTED"],
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",deployDecision:"NO_GO_DEPLOY"};
 fail(build.name===BUILD||(
  build.id==="8dc6958c-b6dc-4188-a675-2740b18f7098"&&build.projectId===PROJECT),
  "BUILD_ID_OR_PROJECT_MISMATCH");
 fail(build.substitutions?._GOOGLE_FUNCTION_TARGET===target,"BUILD_TARGET_MISMATCH");
 fail(build.substitutions?._GOOGLE_RUNTIME==="nodejs22","BUILD_RUNTIME_MISMATCH");
 fail(build.substitutions?._GOOGLE_LABEL_SOURCE===SOURCE,"SOURCE_GENERATION_LABEL_MISMATCH");
 fail(build.substitutions?._GOOGLE_FUNCTION_SIGNATURE_TYPE==="http","BUILD_SIGNATURE_MISMATCH");
 // 'prod' is Google managed build infrastructure mode; this is NOT a PACKTOOK
 // production deployment and MUST NOT be used as one.
 needs(build.status==="SUCCESS","BUILD_SUCCESS_NOT_SUPPLIED_OR_NOT_SUCCESS");
 const images=Array.isArray(build.results?.images)?build.results.images:[];
 const valid=images.filter(x=>imageRef(x?.name)&&DIGEST.test(x?.digest||""));
 needs(valid.length===1,"SINGLE_BUILD_OUTPUT_IMAGE_WITH_DIGEST_REQUIRED");
 if(revision!=null){
  const expectedName="projects/"+PROJECT+"/locations/"+region+"/services/usagestatus/revisions/"+REVISION;
  fail(revision?.metadata?.name===expectedName||revision?.name===expectedName,"REVISION_ID_MISMATCH");
  const container=revision?.spec?.containers?.[0]?.image||revision?.status?.imageDigest||null;
  needs(typeof container==="string"&&container.includes("@sha256:")&&
   DIGEST.test(container.split("@").at(-1)),"DEPLOYED_IMAGE_DIGEST_REQUIRED");
  if(valid.length===1&&typeof container==="string"){
   const [repo,digest]=container.split("@");
   fail(repo===valid[0].name&&digest===valid[0].digest,"BUILD_TO_REVISION_IMAGE_MISMATCH");
  }
 }else pending.push("REVISION_METADATA_MISSING");
 pending.push("SOURCE_ARCHIVE_CONTENTS_NOT_ATTESTED","INDEPENDENT_OPERATOR_PROVENANCE_NOT_ATTESTED",
 "STAGING_APPCHECK_REAL_TOKEN_NOT_ATTESTED","SECURITY_REVIEW_SIGNOFF_MISSING");
 return {
  schema:"packtook-p199-build-image-revision-v1",
  project:PROJECT,
  expectedBuild:BUILD,
  expectedSource:SOURCE,
  // Never print provider supplied metadata, raw image registry coordinates, token, or revision response.
  buildStatusReported:build.status==="SUCCESS"?"SUCCESS":"NOT_VERIFIED",
  reportedOutputImageCount:images.length,
  buildOutputDigestWellFormed:valid.length===1,
  revisionEvidenceProvided:revision!=null,
  failures,pending,
  metadataConsistent:failures.length===0&&pending.filter(x=>!x.includes("ATTESTED")&&x!=="SECURITY_REVIEW_SIGNOFF_MISSING").length===0,
  deployedCandidateCodeProven:false,
  candidateSourceZipCompared:false,
  operatorIdentityIndependentlyVerified:false,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",deployDecision:"NO_GO_DEPLOY",
  publicSignup:"KEEP_CLOSED"
 };
}
module.exports={result,SOURCE,DIGEST};
