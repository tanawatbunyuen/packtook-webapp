"use strict";
// P200 — reconcile user-supplied actual Cloud Run Revision shape, NO live API or source reads.
const {BUILD,REVISION,PROJECT,GCS}=require("../p198/verify");
const {SOURCE}=require("../p199/verify");
const expectedBuildId=BUILD.split("/").at(-1);
const imageBase="asia-southeast1-docker.pkg.dev/packtook-staging/gcf-artifacts/";
const sha=/^sha256:[a-f0-9]{64}$/;
const exactRevision=REVISION;
function check(revision, build){
 const issues=[],missing=[];
 const fail=(ok,code)=>{if(!ok)issues.push(code)};
 const pending=(ok,code)=>{if(!ok)missing.push(code)};
 if(!revision||typeof revision!=="object"||Array.isArray(revision))
  return {schema:"packtook-p200-revision-reconciliation-v1",issues:["REVISION_NOT_PROVIDED"],g02Decision:"NO_GO"};
 const meta=revision.metadata||{};
 const spec=revision.spec||{};
 const status=revision.status||{};
 const conditions=Array.isArray(status.conditions)?status.conditions:[];
 fail(revision.kind==="Revision"&&revision.apiVersion==="serving.knative.dev/v1","WRONG_RESOURCE_KIND");
 fail(meta.name===exactRevision,"REVISION_NAME_DRIFT");
 fail(meta.namespace==="689946391888","REVISION_PROJECT_NAMESPACE_DRIFT");
 fail(meta.labels?.["cloud.googleapis.com/location"]==="asia-southeast1","REVISION_REGION_DRIFT");
 fail(meta.labels?.["serving.knative.dev/service"]==="usagestatus","REVISION_SERVICE_DRIFT");
 fail(meta.annotations?.["run.googleapis.com/build-id"]===JSON.stringify({worker:expectedBuildId}),"REVISION_BUILD_ID_DRIFT");
 fail(meta.annotations?.["run.googleapis.com/build-source-location"]===JSON.stringify({worker:SOURCE}),"REVISION_SOURCE_GENERATION_DRIFT");
 fail(meta.annotations?.["run.googleapis.com/build-function-target"]===JSON.stringify({worker:"usageStatus"}),"REVISION_TARGET_DRIFT");
 fail(spec.serviceAccountName==="packtook-staging-runtime@packtook-staging.iam.gserviceaccount.com","REVISION_RUNTIME_IDENTITY_DRIFT");
 fail(conditions.some(c=>c.type==="Ready"&&c.status==="True"),"REVISION_NOT_READY");
 const image=spec.containers?.[0]?.image;
 const statusImage=status.imageDigest;
 const containerStatus=status.containerStatuses?.find(x=>x.name==="worker")?.imageDigest;
 const splitImage=x=>{
  if(typeof x!=="string"||!x.startsWith(imageBase)||!x.includes("@"))return null;
  const at=x.lastIndexOf("@");
  const digest=x.slice(at+1);
  return sha.test(digest)?{name:x.slice(0,at),digest}:null;
 };
 const parsed=splitImage(image);
 pending(!!parsed,"REVISION_SPEC_IMAGE_DIGEST_REQUIRED");
 pending(!!splitImage(statusImage),"REVISION_STATUS_IMAGE_DIGEST_REQUIRED");
 pending(!!splitImage(containerStatus),"REVISION_CONTAINER_STATUS_DIGEST_REQUIRED");
 if(parsed&&statusImage)fail(image===statusImage,"SPEC_STATUS_IMAGE_DIGEST_MISMATCH");
 if(parsed&&containerStatus)fail(image===containerStatus,"SPEC_CONTAINER_STATUS_DIGEST_MISMATCH");
 // Cross-check build output only if supplied. Never invent build image digest from revision.
 const images=Array.isArray(build?.results?.images)?build.results.images:[];
 const matchable=images.filter(x=>typeof x?.name==="string"&&sha.test(x?.digest||""));
 pending(build?.status==="SUCCESS","BUILD_SUCCESS_NOT_VERIFIED");
 pending(matchable.length===1,"BUILD_OUTPUT_IMAGE_DIGEST_NOT_VERIFIED");
 if(parsed&&matchable.length===1){
  fail(parsed.name===matchable[0].name&&parsed.digest===matchable[0].digest,"BUILD_REVISION_DIGEST_MISMATCH");
 }
 if(build){
  fail(build.name===BUILD||build.id===expectedBuildId&&build.projectId===PROJECT,"BUILD_RESOURCE_MISMATCH");
  fail(build.substitutions?._GOOGLE_LABEL_SOURCE===SOURCE,"BUILD_SOURCE_GENERATION_MISMATCH");
 }
 missing.push("SOURCE_ARCHIVE_BYTE_EQUALITY_NOT_VERIFIED","P188_CANDIDATE_NOT_PROVEN_DEPLOYED","REAL_STAGING_APPCHECK_NOT_VERIFIED","INDEPENDENT_REVIEW_NOT_SIGNED");
 return {
  schema:"packtook-p200-revision-reconciliation-v1",
  project:PROJECT,
  referenceBuild:BUILD,
  referenceRevision:exactRevision,
  userSuppliedRevisionPresent:true,
  revisionImageDigestPresent:!!parsed,
  revisionThreeImageFieldsConsistent:!!parsed&&image===statusImage&&image===containerStatus,
  buildOutputDigestAvailable:matchable.length===1,
  buildRevisionDigestEqualityVerified:!!parsed&&matchable.length===1&&parsed.name===matchable[0].name&&parsed.digest===matchable[0].digest,
  issues,missing,
  // Suppress raw metadata, token, source archive, and image reference from public log.
  reviewedCandidateSourceMatchesDeployed:false,
  independentlyAttested:false,
  g02Decision:"NO_GO",
  releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",
  publicSignup:"KEEP_CLOSED"
 };
}
module.exports={check};
