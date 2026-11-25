"use strict";
const assert=require("node:assert/strict");
const {reconcile,inspectCase,CASES}=require("./verify");
const {PROJECT,REVISION,BUILD}=require("../p198/verify");
const {TARGET,ENDPOINT}=require("../p195/reconcile");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const sample=(which="MISSING_TOKEN")=>({
 case:which,project:PROJECT,functionResource:TARGET,endpoint:ENDPOINT,
 revision:REVISION,build:BUILD,candidateSha256:EXPECTED_CANDIDATE,
 method:"POST",requestShape:"FIREBASE_CALLABLE_JSON",
 httpStatus:which==="VALID_TOKEN"?200:403,
 resultClass:which==="VALID_TOKEN"?"ACCEPTED":"DENIED",
 tokenOrigin:which==="VALID_TOKEN"?"STAGING_LEGITIMATE_CLIENT":
 which==="INVALID_TOKEN"?"INVALID_TEST_TOKEN":"ABSENT",
 observedAt:"2026-11-25T03:00:00Z",evidenceDigest:"a".repeat(64),
 reviewTicket:"G02-READONLY-20261125"
});
let n=0;const t=(name,fn)=>{fn();n++;console.log("P208_"+name+"=PASS")};
t("EMPTY_BATCH_FAILS_CLOSED",()=>{const x=reconcile();assert.equal(x.claimedCases,0);assert.equal(x.independentlyVerifiedAppCheck,false)});
t("THREE_SEPARATE_CASES",()=>assert.deepEqual(CASES,["MISSING_TOKEN","VALID_TOKEN","INVALID_TOKEN"]));
t("MISSING_TOKEN_METADATA_CLASSIFIED_UNVERIFIED",()=>assert.equal(inspectCase(sample()).classification,"CLAIMED_NOT_INDEPENDENTLY_VERIFIED"));
t("VALID_TOKEN_METADATA_CLASSIFIED_UNVERIFIED",()=>assert.equal(inspectCase(sample("VALID_TOKEN")).classification,"CLAIMED_NOT_INDEPENDENTLY_VERIFIED"));
t("INVALID_TOKEN_METADATA_CLASSIFIED_UNVERIFIED",()=>assert.equal(inspectCase(sample("INVALID_TOKEN")).classification,"CLAIMED_NOT_INDEPENDENTLY_VERIFIED"));
t("PAIR_REPORTED_BUT_NOT_PROVEN",()=>{const x=reconcile({observations:[sample(),sample("VALID_TOKEN")]});assert.equal(x.reportedPositiveNegativePairPresent,true);assert.equal(x.independentlyVerifiedAppCheck,false)});
t("ALL_CASES_REPORTED_STILL_NO_GO",()=>{const x=reconcile({observations:CASES.map(sample)});assert.equal(x.claimedCases,3);assert.equal(x.g02Decision,"NO_GO")});
t("NO_LIVE_REQUESTS",()=>assert.equal(reconcile().actualEndpointRequestsPerformed,0));
t("NO_CRYPTO_TOKEN_VERIFICATION",()=>assert.equal(reconcile().cryptographicTokenVerificationPerformed,false));
t("CLAIMED_VALID_TOKEN_CANNOT_ATTEST_ORIGIN",()=>assert(inspectCase(sample("VALID_TOKEN")).unverified.includes("EXTERNAL_REVIEWER_IDENTITY_NOT_AUTHENTICATED")));
t("REPORTED_REVIEWER_CANNOT_OPEN_GATE",()=>{const x=sample();x.reviewerClaim=true;assert.equal(reconcile({observations:[x]}).releaseDecision,"NO_GO_RELEASE")});
t("NEGATIVE_ACCEPTED_200_REJECTED",()=>{const x=sample();x.httpStatus=200;assert(inspectCase(x).errors.includes("MISSING_TOKEN_NOT_DENIED"))});
t("POSITIVE_403_REJECTED",()=>{const x=sample("VALID_TOKEN");x.httpStatus=403;assert(inspectCase(x).errors.includes("VALID_TOKEN_NOT_ACCEPTED"))});
t("INVALID_TOKEN_200_REJECTED",()=>{const x=sample("INVALID_TOKEN");x.httpStatus=200;assert(inspectCase(x).errors.includes("INVALID_TOKEN_NOT_DENIED"))});
t("MISSING_TOKEN_ORIGIN_DRIFT",()=>{const x=sample();x.tokenOrigin="STAGING_LEGITIMATE_CLIENT";assert(inspectCase(x).errors.includes("NEGATIVE_TOKEN_NOT_ABSENT"))});
t("WRONG_FUNCTION_REJECTED",()=>{const x=sample();x.functionResource="usageAdmin";assert(inspectCase(x).errors.includes("FUNCTION_DRIFT"))});
t("WRONG_ENDPOINT_REJECTED",()=>{const x=sample();x.endpoint="https://example.test";assert(inspectCase(x).errors.includes("ENDPOINT_DRIFT"))});
t("PRODUCTION_PROJECT_REJECTED",()=>{const x=sample();x.project="packtook-prod-01";assert(inspectCase(x).errors.includes("PROJECT_DRIFT"))});
t("REVISION_DRIFT_REJECTED",()=>{const x=sample();x.revision="usagestatus-00099-nob";assert(inspectCase(x).errors.includes("REVISION_DRIFT"))});
t("BUILD_DRIFT_REJECTED",()=>{const x=sample();x.build="wrong";assert(inspectCase(x).errors.includes("BUILD_DRIFT"))});
t("P188_CANDIDATE_DRIFT_REJECTED",()=>{const x=sample();x.candidateSha256="f".repeat(64);assert(inspectCase(x).errors.includes("CANDIDATE_DRIFT"))});
t("GET_NOT_POST_REJECTED",()=>{const x=sample();x.method="GET";assert(inspectCase(x).errors.includes("METHOD_DRIFT"))});
t("MALFORMED_CALLABLE_SHAPE_REJECTED",()=>{const x=sample();x.requestShape="RAW_JSON";assert(inspectCase(x).errors.includes("CALLABLE_REQUEST_SHAPE_DRIFT"))});
t("RAW_TOKEN_FIELD_REJECTED",()=>{const x=sample();x.appCheckToken="SECRET";const r=inspectCase(x);assert.equal(r.classification,"REJECTED");assert(!JSON.stringify(r).includes("SECRET"))});
t("RAW_EMAIL_FIELD_REJECTED",()=>{const x=sample();x.email="private@example.invalid";assert(!JSON.stringify(inspectCase(x)).includes("private@example.invalid"))});
t("SYNTHETIC_FIXTURE_NOT_ACCEPTED_AS_RUNTIME",()=>{const x=sample();x.isFixture=true;assert(inspectCase(x).errors.includes("SYNTHETIC_FIXTURE_NOT_REAL"))});
t("INVALID_EVIDENCE_DIGEST_REJECTED",()=>{const x=sample();x.evidenceDigest="bad";assert(inspectCase(x).errors.includes("EVIDENCE_HASH_INVALID"))});
t("FUTURE_LEGAL_TICKET_MISSING",()=>{const x=sample();x.reviewTicket="missing";assert(inspectCase(x).errors.includes("TICKET_INVALID"))});
t("DUPLICATE_CASE_REJECTED",()=>{const x=reconcile({observations:[sample(),sample()]});assert.equal(x.rejected,1)});
t("UNKNOWN_CASE_REJECTED",()=>{const x=sample();x.case="PROD_APPCHECK";assert(inspectCase(x).errors.includes("UNKNOWN_TEST_CASE"))});
t("NON_ARRAY_BATCH_DENIED",()=>assert.throws(()=>reconcile({observations:{}}),/P208_INVALID_BATCH/));
t("TOO_MANY_OBSERVATIONS_DENIED",()=>assert.throws(()=>reconcile({observations:Array(13).fill(sample())}),/P208_INVALID_BATCH/));
t("FAKE_TRUSTED_VERIFICATION_NOT_ENOUGH",()=>{const x=sample("VALID_TOKEN");x.tokenValidatedByTrustedVerifier=true;x.authContextChecked=true;x.pinnedRevisionConfirmedExternally=true;assert.equal(inspectCase(x).classification,"CLAIMED_NOT_INDEPENDENTLY_VERIFIED")});
t("ACTIVE_REVISION_NOT_PROVEN_BY_METADATA",()=>assert.equal(reconcile({observations:CASES.map(sample)}).revisionRoutingIndependentlyVerified,false));
t("P188_NOT_PROVEN_DEPLOYED",()=>assert.equal(reconcile().p188CandidateDeployedVerified,false));
t("ALL_GATES_NO_GO_AND_SIGNUP_CLOSED",()=>{const x=reconcile({observations:CASES.map(sample)});assert.equal(x.releaseDecision,"NO_GO_RELEASE");assert.equal(x.deployDecision,"NO_GO_DEPLOY");assert.equal(x.publicSignup,"KEEP_CLOSED")});
console.log("P208_OFFLINE_APPCHECK_EVIDENCE_FIXTURES="+n+"/"+n+"_PASS");
console.log("P208_REAL_STAGING_APPCHECK=NOT_PERFORMED");
console.log("P208_EXTERNAL_INDEPENDENT_VERIFICATION=0/5");
console.log("P208_G02=NO_GO_RELEASE");
