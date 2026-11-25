"use strict";
const assert=require("node:assert/strict");
const {consolidate,TYPE}=require("./reconcile");
const {BUILD,REVISION}=require("../p198/verify");
const {SOURCE}=require("../p199/verify");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const good=()=>({
 function:{project:"packtook-staging",target:"usageStatus",revision:REVISION,state:"ACTIVE",runtime:"nodejs22"},
 build:{project:"packtook-staging",buildId:BUILD,status:"SUCCESS",sourceGeneration:SOURCE},
 revision:{project:"packtook-staging",revision:REVISION,ready:true,threeDigestsEqual:true,
  buildIdMatches:true,sourceGenerationMatches:true},
 registry:{project:"packtook-staging",cleanupPolicy:"DELETE",olderThanSeconds:604800,
  tagState:"ANY",visibleVersions:0,auditDeleteEvents:0,cleanupPolicyDryRun:null}
});
let n=0;const test=(name,fn)=>{fn();n++;console.log("P202_"+name+"=PASS")};
const status=(c,track)=>consolidate({claims:c}).records.find(x=>x.track===track);
test("EMPTY_CLAIMS_FAIL_CLOSED",()=>{const r=consolidate();assert.equal(r.selfReportedAccepted,0);assert.equal(r.independentlyVerified,0)});
test("ALL_NINE_EXTERNAL_TRACKS_LISTED",()=>assert.equal(TYPE.length,9));
test("USER_OBSERVED_FOUR_TRACKS_SANITIZED",()=>{const r=consolidate({claims:good()});assert.equal(r.selfReportedAccepted,4);assert.equal(r.g02Decision,"NO_GO")});
test("USER_SUPPLIED_CLAIMS_NOT_INDEPENDENT_VERIFICATION",()=>{const r=consolidate({claims:good()});assert.equal(r.independentlyVerified,0);assert.equal(r.sourceCodeAndContainerByteEqualityVerified,false)});
test("EXTERNAL_P190_FIVE_INDEPENDENT_EVIDENCE_MISSING",()=>{const r=consolidate({claims:good()});assert.equal(r.requiredP190ExternalTracks,5);assert.equal(r.requiredP190ExternalStillMissingIndependentVerification,5)});
test("BUILD_SOURCE_SHA256_IS_NOT_GCS_GENERATION",()=>assert.equal(consolidate({claims:good()}).sourceCodeAndContainerByteEqualityVerified,false));
test("DELETION_NOT_ESTABLISHED_BY_EMPTY_LOGS",()=>assert.equal(consolidate({claims:good()}).deletionCausalityVerified,false));
test("MISSING_DRY_RUN_REMAINS_ALLOWED_UNKNOWN",()=>assert.equal(status(good(),"registry").classification,"CLAIMED_NOT_INDEPENDENTLY_VERIFIED"));
test("UNKNOWN_TRACK_BLOCKED",()=>assert.throws(()=>consolidate({claims:{arbitrarySecrets:{}}}),/P202_UNRECOGNIZED/));
test("PII_EMAIL_FIELD_REJECTED",()=>{const x=good();x.function.email="private@example.invalid";assert.equal(status(x,"function").classification,"REJECTED")});
test("TOKEN_FIELD_REJECTED",()=>{const x=good();x.registry.idToken="VERY_PRIVATE";assert.equal(status(x,"registry").classification,"REJECTED")});
test("CROSS_PROJECT_FUNCTION_REJECTED",()=>{const x=good();x.function.project="packtook-prod-01";assert(status(x,"function").issues.includes("WRONG_PROJECT"))});
test("CROSS_PROJECT_PRODUCTION_INVENTORY_REJECTED",()=>{const x=good();x.productionLegacyInventory={project:"packtook-staging",complete:true,authLookupErrors:0,ownerConflicts:0};assert(status(x,"productionLegacyInventory").issues.includes("WRONG_PROJECT"))});
test("BUILD_ID_DRIFT_REJECTED",()=>{const x=good();x.build.buildId="invalid";assert(status(x,"build").issues.includes("BUILD_ID_DRIFT"))});
test("BUILD_STATUS_FAILED_REJECTED",()=>{const x=good();x.build.status="FAILURE";assert(status(x,"build").issues.includes("BUILD_NOT_SUCCESS"))});
test("REVISION_DRIFT_REJECTED",()=>{const x=good();x.revision.revision="usagestatus-99999-zzz";assert(status(x,"revision").issues.includes("REVISION_DRIFT"))});
test("MISMATCHED_REVISION_DIGEST_REJECTED",()=>{const x=good();x.revision.threeDigestsEqual=false;assert(status(x,"revision").issues.includes("REVISION_IMAGE_DIGEST_DIFFERENTIAL"))});
test("WRONG_CLEANUP_AGE_REJECTED",()=>{const x=good();x.registry.olderThanSeconds=600;assert(status(x,"registry").issues.includes("CLEANUP_POLICY_DRIFT"))});
test("UNRESOLVED_STAGING_INVENTORY_REJECTED",()=>{const x=good();x.stagingLegacyInventory={project:"packtook-staging",complete:false,authLookupErrors:1,ownerConflicts:2};assert(status(x,"stagingLegacyInventory").issues.includes("UNRESOLVED_LEGACY_ACCOUNT_INVENTORY"))});
test("MISSING_APPCHECK_REAL_PROBE_REJECTED",()=>{const x=good();x.appCheck={project:"packtook-staging",validTokenAccepted:true,missingTokenDenied:false,revisionMatches:true};assert(status(x,"appCheck").issues.includes("APPCHECK_REAL_PROBE_MISSING"))});
test("FAKE_INDEPENDENT_ATTESTATIONS_STILL_NO_GO",()=>{
 const x=good();x.appCheck={project:"packtook-staging",validTokenAccepted:true,missingTokenDenied:true,revisionMatches:true,tokenProvenanceIndependentlyAttested:true};
 x.stagingLegacyInventory={project:"packtook-staging",complete:true,authLookupErrors:0,ownerConflicts:0,independentAttestation:true};
 x.productionLegacyInventory={project:"packtook-prod-01",complete:true,authLookupErrors:0,ownerConflicts:0,independentAttestation:true};
 x.ownerProvenance={project:"packtook-prod-01",resolved:true,independentAttestation:true};
 x.securitySignoff={project:"packtook-staging",candidateSha256:EXPECTED_CANDIDATE,revisionAndDiffVerified:true,independentAttestation:true};
 const r=consolidate({claims:x});assert.equal(r.selfReportedAccepted,9);
 assert.equal(r.independentlyVerified,0);assert.equal(r.g02Decision,"NO_GO");
 assert.equal(r.securityReviewerSignedOff,false);
});
test("UNPINNED_CANDIDATE_SIGNOFF_REJECTED",()=>{const x=good();x.securitySignoff={project:"packtook-staging",candidateSha256:"f".repeat(64),revisionAndDiffVerified:true};assert(status(x,"securitySignoff").issues.includes("CANDIDATE_SHA256_DRIFT"))});
test("UNKNOWN_PRODUCTION_ACTION_IS_ALWAYS_NO_GO",()=>{const r=consolidate({claims:good()});assert.equal(r.releaseDecision,"NO_GO_RELEASE");assert.equal(r.deployDecision,"NO_GO_DEPLOY");assert.equal(r.publicSignup,"KEEP_CLOSED")});
test("REPORT_STRIPS_SUPPLIED_RAW_FIELDS",()=>{const x=good();x.registry.token="NEVER_ECHO_SECRET";const out=JSON.stringify(consolidate({claims:x}));assert(!out.includes("NEVER_ECHO_SECRET"))});
console.log("P202_OFFLINE_SECURITY_REVIEW_PACKET_FIXTURES="+n+"/"+n+"_PASS");
console.log("P202_INDEPENDENT_RUNTIME_ATTESTATION=0/5");
console.log("P202_NO_CLOUD_CALLS_NO_DEPLOYS_TRUE");
