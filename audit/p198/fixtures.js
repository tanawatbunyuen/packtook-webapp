"use strict";
const assert=require("node:assert/strict");
const {proof,sameStorage,BUILD,REVISION,GCS}=require("./verify");
const {fetchBuild,BUILD_ID}=require("./operator-build-readonly");
const {TARGET,ENDPOINT,ACK}=require("../p196/operator-readonly-runtime");
const f=()=>({name:TARGET,url:ENDPOINT,environment:"GEN_2",state:"ACTIVE",
 serviceConfig:{revision:REVISION},
 buildConfig:{build:BUILD,source:{storageSource:{...GCS}},
 sourceProvenance:{resolvedStorageSource:{...GCS}}}});
const b=()=>({name:BUILD,status:"SUCCESS",source:{storageSource:{...GCS}}});
const env={PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-staging",
 PACKTOOK_G02_P198_BUILD_READ_ONLY_ACK:"I_AUTHORIZE_P198_STAGING_BUILD_METADATA_READ_ONLY"};
let n=0;const t=(label,fn)=>{fn();n++;console.log("P198_"+label+"=PASS")};
t("USER_SUPPLIED_FUNCTION_METADATA_ONLY_NOT_SOURCE_PROOF",()=>{
 const r=proof({func:f()});assert.equal(r.buildMetadataProvided,false);
 assert.equal(r.deployedCandidateByteEquality,"NOT_VERIFIED");assert.equal(r.g02Decision,"NO_GO");
});
t("CONSISTENT_BUILD_METADATA_STILL_NOT_DEPLOYED_CODE_PROOF",()=>{
 const r=proof({func:f(),build:b()});
 assert.equal(r.metadataConsistent,true);assert.equal(r.sourceArchiveContentsVerified,false);
 assert.equal(r.cloudRunRevisionImageDigestVerified,false);assert.equal(r.releaseDecision,"NO_GO_RELEASE");
});
t("FUNCTION_PROJECT_DRIFT_DENIED",()=>assert(proof({func:{...f(),name:"projects/packtook-prod-01/locations/asia-southeast1/functions/usageStatus"},build:b()}).metadataIssues.includes("FUNCTION_NOT_STAGING")));
t("FUNCTION_BUILD_ID_DRIFT_DENIED",()=>assert(proof({func:{...f(),buildConfig:{...f().buildConfig,build:"projects/689946391888/locations/asia-southeast1/builds/different"}},build:b()}).metadataIssues.includes("FUNCTION_BUILD_ID_DRIFT")));
t("REVISION_DRIFT_DENIED",()=>assert(proof({func:{...f(),serviceConfig:{revision:"usagestatus-00023-xyz"}},build:b()}).metadataIssues.includes("REVISION_DRIFT")));
t("SOURCE_OBJECT_GENERATION_DRIFT_DENIED",()=>{const x=f();x.buildConfig.sourceProvenance.resolvedStorageSource.generation="1794070024475038";assert(proof({func:x,build:b()}).metadataIssues.includes("FUNCTION_SOURCE_GENERATION_MISMATCH"))});
t("CLOUD_BUILD_FAILED_DENIED",()=>assert(proof({func:f(),build:{...b(),status:"FAILURE"}}).metadataIssues.includes("BUILD_NOT_SUCCESS")));
t("BUILD_SOURCE_GENERATION_MISMATCH_DENIED",()=>{const x=b();x.source.storageSource.generation="1794070024475038";assert(proof({func:f(),build:x}).metadataIssues.includes("FUNCTION_BUILD_SOURCE_NOT_PROVEN_SAME_GENERATION"))});
t("BUILD_SOURCE_MISSING_NOT_ASSUMED",()=>assert(proof({func:f(),build:{name:BUILD,status:"SUCCESS"}}).metadataIssues.includes("FUNCTION_BUILD_SOURCE_NOT_PROVEN_SAME_GENERATION")));
t("BUILD_PROJECT_ID_MISMATCH_DENIED",()=>assert(proof({func:f(),build:{id:BUILD_ID,projectId:"packtook-prod-01",status:"SUCCESS",source:{storageSource:GCS}}}).metadataIssues.includes("WRONG_BUILD_ID_OR_PROJECT")));
t("BUILD_NAME_MATCH_ACCEPTED_WITHOUT_PROJECT_ID",()=>assert.equal(proof({func:f(),build:b()}).metadataConsistent,true));
t("SOURCE_STORAGE_FIELDS_ALL_REQUIRED",()=>assert.equal(sameStorage({...GCS,generation:undefined},GCS),false));
t("CI_GUARD_PREVENTS_CLOUD_CALL",()=>{let called=0;assert.throws(()=>fetchBuild({env:{...env,CI:"true"},ticket:"G02-READONLY-20261124",exec:()=>{called++;return "{}"}}),/CI_REAL_CLOUD_BLOCKED/);assert.equal(called,0)});
t("MISSING_OPERATOR_BUILD_ACK_PREVENTS_CALL",()=>{let called=0;assert.throws(()=>fetchBuild({env:{PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-staging"},ticket:"G02-READONLY-20261124",exec:()=>{called++}}),/P198_EXPLICIT_BUILD_READ_ACK_MISSING/);assert.equal(called,0)});
t("OPERATOR_ONLY_FIXED_GCLOUD_DESCRIBE_ARGS",()=>{
 let called=0;const x=fetchBuild({env,ticket:"G02-READONLY-20261124",exec:(name,args)=>{
 called++;assert.equal(name,"gcloud");assert.deepEqual(args,["builds","describe",BUILD_ID,
 "--project","packtook-staging","--region","asia-southeast1","--format=json","--quiet"]);return JSON.stringify(b())}});
 assert.equal(called,1);assert.equal(x.name,BUILD);
});
t("WRONG_BUILD_DATA_CANNOT_CAUSE_GO",()=>{
 const r=proof({func:f(),build:{status:"SUCCESS",source:{storageSource:GCS}}});
 assert.equal(r.g02Decision,"NO_GO");
});
t("NO_CUSTOMER_INFO_IN_REPORT",()=>{
 const x=proof({func:{...f(),email:"private@example.invalid",token:"VERY_SECRET"},build:b()});
 const raw=JSON.stringify(x);assert(!raw.includes("private@example.invalid"));assert(!raw.includes("VERY_SECRET"));
});
console.log("P198_OFFLINE_BUILD_PROVENANCE_FIXTURES="+n+"/"+n+"_PASS");
console.log("P198_REAL_BUILD_DESCRIBE=NOT_PERFORMED");
console.log("P198_DEPLOYED_SOURCE_SHA256=NOT_ATTESTED");
console.log("P198_G02=NO_GO_RELEASE");
