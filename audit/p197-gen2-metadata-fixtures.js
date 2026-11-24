"use strict";
// The P197 synthetic fixture reproduces only the shape of the operator's
// user-supplied Gen2 describe metadata. It is NOT a fresh live cloud query.
const assert=require("node:assert/strict");
const {safeExtract,TARGET,ENDPOINT}=require("./p196/operator-readonly-runtime");
const fixture=()=>({
 name:TARGET,environment:"GEN_2",state:"ACTIVE",
 url:ENDPOINT,
 labels:{"firebase-functions-hash":"0ac007f34a35d1eff6843d7e1164cb29987f925b"},
 buildConfig:{
  runtime:"nodejs22",
  build:"projects/689946391888/locations/asia-southeast1/builds/8dc6958c-b6dc-4188-a675-2740b18f7098",
  source:{storageSource:{bucket:"gcf-v2-sources-689946391888-asia-southeast1",object:"usageStatus/function-source.zip",generation:"1794070024475037"}},
  sourceProvenance:{resolvedStorageSource:{bucket:"gcf-v2-sources-689946391888-asia-southeast1",object:"usageStatus/function-source.zip",generation:"1794070024475037"}}
 },
 serviceConfig:{
  uri:"https://usagestatus-x5r74jtjza-as.a.run.app",
  revision:"usagestatus-00021-nob",
  serviceAccountEmail:"packtook-staging-runtime@packtook-staging.iam.gserviceaccount.com",
  allTrafficOnLatestRevision:true
 }
});
let n=0;
function test(name,fn){fn();n++;console.log("P197_"+name+"=PASS");}
test("USER_DESCRIBE_CANONICAL_ENDPOINT_PIN_MATCHES",()=>{
 const r=safeExtract(fixture());assert.equal(r.endpointMatchesPinned,true);
 assert.equal(r.callableUrlPresent,true);
});
test("GEN2_CLOUD_RUN_URI_DISTINCT_CLASSIFIED",()=>{
 const r=safeExtract(fixture());assert.equal(r.gen2,true);
 assert.equal(r.cloudRunUriPresent,true);assert.equal(r.callableAndRunUriDistinct,true);
});
test("NODE22_ACTIVE_REVISION_PRESENCE",()=>{
 const r=safeExtract(fixture());assert.equal(r.runtime,"nodejs22");
 assert.equal(r.active,true);assert.equal(r.revisionPresent,true);
});
test("BUILD_AND_STORAGE_SOURCE_REFERENCES_MATCH",()=>{
 const r=safeExtract(fixture());assert.equal(r.buildReferencePresent,true);
 assert.equal(r.sourceAndResolvedStorageSourceMatch,true);
});
test("SOURCE_GENERATION_MISMATCH_REJECTED",()=>{
 const f=fixture();f.buildConfig.sourceProvenance.resolvedStorageSource.generation="1794070024475038";
 assert.equal(safeExtract(f).sourceAndResolvedStorageSourceMatch,false);
});
test("OFFICIAL_FUNCTION_URL_MISSING_DOES_NOT_USE_RUN_URL",()=>{
 const f=fixture();delete f.url;
 const r=safeExtract(f);
 assert.equal(r.endpointMatchesPinned,false);assert.equal(r.cloudRunUriPresent,true);
});
test("OFFICIAL_FUNCTION_URL_SUBSTITUTION_REFUSED",()=>{
 const f=fixture();f.url="https://packtook-prod-01.cloudfunctions.net/usageStatus";
 assert.equal(safeExtract(f).endpointMatchesPinned,false);
});
test("CHANGING_ONLY_RUN_URL_NEVER_REPINS_CALLABLE",()=>{
 const f=fixture();f.serviceConfig.uri="https://unknown-abc.a.run.app";
 const r=safeExtract(f);assert.equal(r.endpointMatchesPinned,true);
 assert.equal(r.deployedCandidateAttested,false);
});
test("FIREBASE_LABEL_IS_NOT_RELEASE_CANDIDATE_PROOF",()=>{
 const r=safeExtract(fixture());
 assert.equal(r.firebaseFunctionsLabelIsNotSourceSha256,true);
 assert.equal(r.sourceHashMatchesCandidate,"NOT_ATTESTED_BY_DESCRIBE");
 assert.equal(r.deployedCandidateAttested,false);
});
test("APP_CHECK_AND_SECURITY_REVIEW_STILL_MISSING",()=>{
 const r=safeExtract(fixture());
 assert.equal(r.appCheckPositiveAttested,false);
 assert.equal(r.operatorIdentityIndependentlyVerified,false);
 assert.equal(r.g02Decision,"NO_GO");
 assert.equal(r.deployDecision,"NO_GO_DEPLOY");
});
test("NO_REVISION_OR_SERVICE_ACCOUNT_DETAILS_IN_SUMMARY",()=>{
 const result=JSON.stringify(safeExtract(fixture()));
 assert(!result.includes("usagestatus-00021-nob"));
 assert(!result.includes("packtook-staging-runtime@"));
 assert(!result.includes("0ac007f34a35d1eff6843d7e1164cb29987f925b"));
 assert(!result.includes("8dc6958c-b6dc-4188-a675-2740b18f7098"));
});
test("NO_SOURCE_PROVENANCE_RETURNS_UNATTESTED",()=>{
 const f=fixture();delete f.buildConfig.sourceProvenance;
 const r=safeExtract(f);assert.equal(r.sourceAndResolvedStorageSourceMatch,false);
 assert.equal(r.deployedCandidateAttested,false);
});
console.log("P197_GEN2_OPERATOR_METADATA_FIXTURES="+n+"/"+n+"_PASS");
console.log("P197_REAL_STAGING_REQUERIED=FALSE");
console.log("P197_G02=NO_GO_APPCHECK_AND_SOURCE_PROVENANCE_NOT_VERIFIED");
