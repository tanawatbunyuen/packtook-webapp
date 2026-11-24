"use strict";
const assert=require("node:assert/strict");
const {check}=require("./verify");
const {BUILD,REVISION}=require("../p198/verify");
const {SOURCE}=require("../p199/verify");
const image="asia-southeast1-docker.pkg.dev/packtook-staging/gcf-artifacts/packtook--staging__asia--southeast1__usage_status@sha256:524bd687470632f6ad654bfe14d1d58bdfcd1f6bd897d672fcdcff4977de20fa";
const r=()=>({
 apiVersion:"serving.knative.dev/v1",kind:"Revision",
 metadata:{name:REVISION,namespace:"689946391888",labels:{
 "cloud.googleapis.com/location":"asia-southeast1","serving.knative.dev/service":"usagestatus"
 },annotations:{
 "run.googleapis.com/build-id":JSON.stringify({worker:"8dc6958c-b6dc-4188-a675-2740b18f7098"}),
 "run.googleapis.com/build-source-location":JSON.stringify({worker:SOURCE}),
 "run.googleapis.com/build-function-target":JSON.stringify({worker:"usageStatus"})
 }},
 spec:{serviceAccountName:"packtook-staging-runtime@packtook-staging.iam.gserviceaccount.com",
 containers:[{name:"worker",image}]},
 status:{imageDigest:image,containerStatuses:[{name:"worker",imageDigest:image}],conditions:[{type:"Ready",status:"True"}]}
});
const b=()=>({name:BUILD,status:"SUCCESS",substitutions:{_GOOGLE_LABEL_SOURCE:SOURCE},results:{
 images:[{name:image.split("@")[0],digest:image.split("@")[1]}]}});
let n=0;
const test=(label,fn)=>{fn();n++;console.log("P200_"+label+"=PASS")};
test("REAL_REVISION_SHORT_NAME_ACCEPTED",()=>{const x=check(r());assert.equal(x.userSuppliedRevisionPresent,true);assert(!x.issues.includes("REVISION_NAME_DRIFT"))});
test("REAL_REVISION_IMAGE_DIGEST_PRESENT",()=>assert.equal(check(r()).revisionImageDigestPresent,true));
test("SPEC_STATUS_CONTAINER_DIGEST_EQUAL",()=>assert.equal(check(r()).revisionThreeImageFieldsConsistent,true));
test("BUILD_SOURCE_GENERATION_ANNOTATION_PINNED",()=>assert(!check(r()).issues.includes("REVISION_SOURCE_GENERATION_DRIFT")));
test("REVISION_READY_TRUE",()=>assert(!check(r()).issues.includes("REVISION_NOT_READY")));
test("BUILD_OUTPUT_DIGEST_STILL_MISSING",()=>{const x=check(r());assert.equal(x.buildOutputDigestAvailable,false);assert(x.missing.includes("BUILD_OUTPUT_IMAGE_DIGEST_NOT_VERIFIED"))});
test("BUILD_STATUS_STILL_MISSING",()=>assert(check(r()).missing.includes("BUILD_SUCCESS_NOT_VERIFIED")));
test("ALL_METADATA_MATCHES_STILL_NO_GO",()=>{const x=check(r(),b());assert.equal(x.buildRevisionDigestEqualityVerified,true);assert.equal(x.reviewedCandidateSourceMatchesDeployed,false);assert.equal(x.g02Decision,"NO_GO")});
test("REVISION_BUILD_ID_DRIFT_REJECTED",()=>{const x=r();x.metadata.annotations["run.googleapis.com/build-id"]=JSON.stringify({worker:"wrong"});assert(check(x).issues.includes("REVISION_BUILD_ID_DRIFT"))});
test("REVISION_SOURCE_GENERATION_DRIFT_REJECTED",()=>{const x=r();x.metadata.annotations["run.googleapis.com/build-source-location"]=JSON.stringify({worker:SOURCE.replace(/\d+$/,"999")});assert(check(x).issues.includes("REVISION_SOURCE_GENERATION_DRIFT"))});
test("REVISION_SERVICE_DRIFT_REJECTED",()=>{const x=r();x.metadata.labels["serving.knative.dev/service"]="unknown";assert(check(x).issues.includes("REVISION_SERVICE_DRIFT"))});
test("REVISION_WRONG_NAMESPACE_REJECTED",()=>{const x=r();x.metadata.namespace="123456789";assert(check(x).issues.includes("REVISION_PROJECT_NAMESPACE_DRIFT"))});
test("IMAGE_DIGEST_MISMATCH_SPEC_STATUS_REJECTED",()=>{const x=r();x.status.imageDigest=x.status.imageDigest.replace("524bd","a24bd");assert(check(x).issues.includes("SPEC_STATUS_IMAGE_DIGEST_MISMATCH"))});
test("IMAGE_DIGEST_MISMATCH_CONTAINER_STATUS_REJECTED",()=>{const x=r();x.status.containerStatuses[0].imageDigest=x.status.imageDigest.replace("524bd","a24bd");assert(check(x).issues.includes("SPEC_CONTAINER_STATUS_DIGEST_MISMATCH"))});
test("BUILD_IMAGE_DIGEST_MISMATCH_REJECTED",()=>{const x=b();x.results.images[0].digest="sha256:"+"f".repeat(64);assert(check(r(),x).issues.includes("BUILD_REVISION_DIGEST_MISMATCH"))});
test("BUILD_WRONG_SOURCE_REJECTED",()=>{const x=b();x.substitutions._GOOGLE_LABEL_SOURCE="gs://wrong";assert(check(r(),x).issues.includes("BUILD_SOURCE_GENERATION_MISMATCH"))});
test("NOT_READY_REJECTED",()=>{const x=r();x.status.conditions[0].status="False";assert(check(x).issues.includes("REVISION_NOT_READY"))});
test("NO_SECRET_OR_RAW_IMAGE_EMITTED",()=>{const x=r();x.metadata.annotations.privateToken="SENSITIVE_TOKEN";const output=JSON.stringify(check(x));assert(!output.includes("SENSITIVE_TOKEN"));assert(!output.includes("524bd687"))});
test("WRONG_IMAGE_REGISTRY_REJECTED",()=>{const x=r();x.spec.containers[0].image="us-docker.pkg.dev/packtook-prod-01/repo/worker@sha256:"+"a".repeat(64);assert(check(x).missing.includes("REVISION_SPEC_IMAGE_DIGEST_REQUIRED"))});
test("NOT_PRODUCTION_READY",()=>{const x=check(r(),b());assert.equal(x.releaseDecision,"NO_GO_RELEASE");assert.equal(x.publicSignup,"KEEP_CLOSED")});
console.log("P200_USER_SUPPLIED_REVISION_SHAPE_FIXTURES="+n+"/"+n+"_PASS");
console.log("P200_USER_EVIDENCE_IS_NOT_INDEPENDENTLY_ATTESTED=TRUE");
console.log("P200_CLOUD_CALLS=0 DEPLOYS=0");
