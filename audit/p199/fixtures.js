"use strict";
const assert=require("node:assert/strict");
const {result,SOURCE}=require("./verify");
const {BUILD,REVISION}=require("../p198/verify");
let n=0;const test=(k,fn)=>{fn();n++;console.log("P199_"+k+"=PASS")};
const sha="a".repeat(64),image="asia-southeast1-docker.pkg.dev/packtook-staging/gcf-artifacts/usagestatus";
const b=()=>({name:BUILD,substitutions:{
 _GOOGLE_LABEL_SOURCE:SOURCE,_GOOGLE_FUNCTION_TARGET:"usageStatus",
 _GOOGLE_RUNTIME:"nodejs22",_GOOGLE_FUNCTION_SIGNATURE_TYPE:"http",
 _GOOGLE_BUILD_ENV:"prod"},tags:["p-gcf","r-nodejs22","service_usagestatus"],
 timing:{BUILD:{startTime:"2026-11-07T16:47:06Z",endTime:"2026-11-07T16:47:59Z"}}});
const full=()=>({...b(),status:"SUCCESS",results:{images:[{name:image,digest:"sha256:"+sha}]}});
const rev=()=>({metadata:{name:"projects/packtook-staging/locations/asia-southeast1/services/usagestatus/revisions/"+REVISION},
 spec:{containers:[{image:image+"@sha256:"+sha}]}});
test("USER_FRAGMENT_SOURCE_GENERATION_LINKED",()=>assert.equal(b().substitutions._GOOGLE_LABEL_SOURCE,SOURCE));
test("FRAGMENT_IS_NOT_BUILD_SUCCESS",()=>{const r=result({build:b()});assert.equal(r.buildStatusReported,"NOT_VERIFIED");assert(r.pending.includes("BUILD_SUCCESS_NOT_SUPPLIED_OR_NOT_SUCCESS"))});
test("FRAGMENT_NO_OUTPUT_IMAGE_DIGEST",()=>{const r=result({build:b()});assert.equal(r.buildOutputDigestWellFormed,false);assert(r.pending.includes("SINGLE_BUILD_OUTPUT_IMAGE_WITH_DIGEST_REQUIRED"))});
test("GOOGLE_BUILD_ENV_PROD_NOT_PRODUCTION_PROJECT",()=>{const r=result({build:b()});assert.equal(r.project,"packtook-staging");assert.equal(r.g02Decision,"NO_GO")});
test("BUILD_WITH_RESULT_BUT_NO_REVISION_STILL_PENDING",()=>{const r=result({build:full()});assert(r.pending.includes("REVISION_METADATA_MISSING"));assert.equal(r.deployedCandidateCodeProven,false)});
test("SYNTHETIC_DIGEST_MATCH_STILL_NO_GO",()=>{const r=result({build:full(),revision:rev()});assert.equal(r.failures.length,0);assert.equal(r.g02Decision,"NO_GO");assert.equal(r.candidateSourceZipCompared,false)});
test("BUILD_DIGEST_MISMATCH_REJECTED",()=>{const x=rev();x.spec.containers[0].image=image+"@sha256:"+"b".repeat(64);assert(result({build:full(),revision:x}).failures.includes("BUILD_TO_REVISION_IMAGE_MISMATCH"))});
test("WRONG_PROJECT_BUILD_REJECTED",()=>{const x=full();x.name="projects/another/locations/asia-southeast1/builds/8dc6958c-b6dc-4188-a675-2740b18f7098";assert(result({build:x}).failures.includes("BUILD_ID_OR_PROJECT_MISMATCH"))});
test("WRONG_SOURCE_GENERATION_REJECTED",()=>{const x=full();x.substitutions._GOOGLE_LABEL_SOURCE=SOURCE.replace(/\d+$/,"999");assert(result({build:x}).failures.includes("SOURCE_GENERATION_LABEL_MISMATCH"))});
test("WRONG_TARGET_REJECTED",()=>{const x=full();x.substitutions._GOOGLE_FUNCTION_TARGET="ownerGrantCredits";assert(result({build:x}).failures.includes("BUILD_TARGET_MISMATCH"))});
test("WRONG_RUNTIME_REJECTED",()=>{const x=full();x.substitutions._GOOGLE_RUNTIME="nodejs20";assert(result({build:x}).failures.includes("BUILD_RUNTIME_MISMATCH"))});
test("REVISION_DRIFT_REJECTED",()=>{const x=rev();x.metadata.name=x.metadata.name.replace(REVISION,"usagestatus-00022-new");assert(result({build:full(),revision:x}).failures.includes("REVISION_ID_MISMATCH"))});
test("MISSING_REVISION_IMAGE_UNVERIFIED",()=>{const x=rev();x.spec.containers=[];assert(result({build:full(),revision:x}).pending.includes("DEPLOYED_IMAGE_DIGEST_REQUIRED"))});
test("NO_BUILD_IMAGE_DIGEST_UNVERIFIED",()=>{const x=full();x.results.images=[{name:image}];assert(result({build:x,revision:rev()}).pending.includes("SINGLE_BUILD_OUTPUT_IMAGE_WITH_DIGEST_REQUIRED"))});
test("NON_STAGING_IMAGE_REJECTED",()=>{const x=full();x.results.images=[{name:"us-docker.pkg.dev/packtook-prod-01/images/usagestatus",digest:"sha256:"+sha}];assert(result({build:x,revision:rev()}).pending.includes("SINGLE_BUILD_OUTPUT_IMAGE_WITH_DIGEST_REQUIRED"))});
test("MULTI_IMAGE_NOT_UNAMBIGUOUS",()=>{const x=full();x.results.images.push({...x.results.images[0]});assert(result({build:x}).pending.includes("SINGLE_BUILD_OUTPUT_IMAGE_WITH_DIGEST_REQUIRED"))});
test("PROVIDER_SECRETS_NOT_EMITTED",()=>{const x=full();x.secrets="SUPER_SECRET";assert(!JSON.stringify(result({build:x,revision:rev()})).includes("SUPER_SECRET"))});
test("MISSING_BUILD_FAILS_CLOSED",()=>assert.equal(result().g02Decision,"NO_GO"));
console.log("P199_BUILD_IMAGE_REVISION_FIXTURES="+n+"/"+n+"_PASS");
console.log("P199_USER_SUPPLIED_BUILD_FRAGMENT_PARTIAL=TRUE");
console.log("P199_REAL_CLOUD_CALLS=0 DEPLOYS=0");
console.log("P199_G02=NO_GO_EXTERNAL_PROVENANCE_REQUIRED");
