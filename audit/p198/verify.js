"use strict";
// P198: independent metadata reconciliation only, never cryptographic proof of deployed code.
const {EXPECTED_CANDIDATE}=require("../p195/reconcile");
const {TARGET,ENDPOINT}=require("../p196/operator-readonly-runtime");
const BUILD="projects/689946391888/locations/asia-southeast1/builds/8dc6958c-b6dc-4188-a675-2740b18f7098";
const PROJECT="packtook-staging";
const REVISION="usagestatus-00021-nob";
const GCS={
 bucket:"gcf-v2-sources-689946391888-asia-southeast1",
 object:"usageStatus/function-source.zip",
 generation:"1794070024475037"
};
function sameStorage(a,b){return !!a&&!!b&&a.bucket===b.bucket&&a.object===b.object&&a.generation===b.generation&&a.bucket===GCS.bucket&&a.object===GCS.object&&a.generation===GCS.generation;}
function proof({func,build}={}){
 const issues=[],flag=(ok,code)=>{if(!ok)issues.push(code)};
 if(!func||typeof func!=="object"||Array.isArray(func))return {status:"REJECTED",issues:["FUNCTION_METADATA_MISSING"],g02Decision:"NO_GO"};
 flag(func.name===TARGET,"FUNCTION_NOT_STAGING");
 flag(func.url===ENDPOINT,"CALLABLE_ENDPOINT_MISMATCH");
 flag(func.environment==="GEN_2","NOT_GEN2");
 flag(func.state==="ACTIVE","FUNCTION_NOT_ACTIVE");
 flag(func.serviceConfig?.revision===REVISION,"REVISION_DRIFT");
 flag(func.buildConfig?.build===BUILD,"FUNCTION_BUILD_ID_DRIFT");
 flag(sameStorage(func.buildConfig?.source?.storageSource,func.buildConfig?.sourceProvenance?.resolvedStorageSource),"FUNCTION_SOURCE_GENERATION_MISMATCH");
 const buildPresent=build!==undefined&&build!==null;
 if(buildPresent){
  if(typeof build!=="object"||Array.isArray(build))issues.push("BUILD_RESPONSE_INVALID");
  else {
   flag(build.name===BUILD||build.id==="8dc6958c-b6dc-4188-a675-2740b18f7098"&&
     build.projectId===PROJECT,"WRONG_BUILD_ID_OR_PROJECT");
   flag(build.status==="SUCCESS","BUILD_NOT_SUCCESS");
   // Cloud Build source is either 'source.storageSource' or 'sourceProvenance.resolvedStorageSource'.
   // If neither exists, do not imply that the build is linked to the source.
   flag(sameStorage(func.buildConfig?.source?.storageSource,build.source?.storageSource)||
    sameStorage(func.buildConfig?.source?.storageSource,build.sourceProvenance?.resolvedStorageSource),
    "FUNCTION_BUILD_SOURCE_NOT_PROVEN_SAME_GENERATION");
  }
 }
 return {
  schema:"packtook-p198-build-provenance-metadata-v1",
  project:PROJECT,
  functionResource:TARGET,
  expectedCandidateSha256:EXPECTED_CANDIDATE,
  functionMetadataMatchesPin:issues.filter(x=>x!=="BUILD_RESPONSE_MISSING").length===0,
  buildMetadataProvided:buildPresent,
  metadataIssues:issues,
  metadataConsistent:buildPresent&&issues.length===0,
  deployedCandidateByteEquality:"NOT_VERIFIED",
  sourceArchiveContentsVerified:false,
  cloudRunRevisionImageDigestVerified:false,
  operatorIdentityIndependentlyVerified:false,
  appCheckEnforcementVerified:false,
  g02Decision:"NO_GO",
  releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",
  publicSignup:"KEEP_CLOSED",
  note:"Metadata link is necessary but insufficient. A source archive/build reference or Firebase label is not a byte-for-byte SHA256 attestation of deployed candidate."
 };
}
module.exports={proof,sameStorage,BUILD,REVISION,GCS,PROJECT};
