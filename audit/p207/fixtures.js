"use strict";
const assert=require("node:assert/strict");
const {reconcile}=require("./verify");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {BUILD,REVISION,PROJECT}=require("../p198/verify");
const {SOURCE}=require("../p199/verify");
const {EXPECTED_DIGEST}=require("../p201/verify");
const base=()=>({project:PROJECT,function:"usageStatus",revision:REVISION,build:BUILD,
 sourceGeneration:SOURCE,candidateSha256:EXPECTED_CANDIDATE,
 revisionImageDigest:EXPECTED_DIGEST,buildOutputImageDigest:null,
 sourceArchiveAvailability:"UNKNOWN",imageAvailability:"NOT_FOUND",
 sourceArchiveByteEqualityReview:"UNKNOWN"});
let n=0;function test(name,fn){fn();n++;console.log("P207_"+name+"=PASS")}
const evaluate=x=>reconcile(x);
test("BASELINE_METADATA_PINS_CONSISTENT",()=>assert.equal(evaluate(base()).errors.length,0));
test("BUILD_OUTPUT_DIGEST_ABSENT_REMAINS_MISSING",()=>assert(evaluate(base()).missing.includes("BUILD_OUTPUT_IMAGE_DIGEST_MISSING")));
test("ARCHIVE_UNAVAILABLE_BLOCKS_BYTE_EQUALITY",()=>assert(evaluate(base()).missing.includes("SOURCE_ARCHIVE_BYTES_UNAVAILABLE")));
test("IMAGE_NOT_FOUND_BLOCKS_ARTIFACT_ATTESTATION",()=>assert(evaluate(base()).missing.includes("ARTIFACT_IMAGE_UNAVAILABLE")));
test("CLEANUP_NOT_PROVEN_FROM_ABSENCE",()=>assert.equal(evaluate(base()).cleanupDeletionCausalityProven,false));
test("UNKNOWN_OPERATOR_REMAINS_UNVERIFIED",()=>assert.equal(evaluate(base()).reviewerIdentityVerified,false));
test("FULL_CLAIM_STILL_NOT_PROOF",()=>{const x={...base(),buildOutputImageDigest:EXPECTED_DIGEST,
 sourceArchiveAvailability:"AVAILABLE",imageAvailability:"AVAILABLE",
 sourceArchiveByteEqualityReview:"MATCHED",operatorIndependentAttestation:true,
 reviewerIndependentAttestation:true,reviewTicket:"G02-READONLY-20261125",
 sourceEvidenceReference:"G02-EVIDENCE-ABCDEF123456"};const r=evaluate(x);
 assert.equal(r.errors.length,0);assert.equal(r.missing.length,0);
 assert.equal(r.deployedP188SourceProven,false);
 assert.equal(r.independentlyVerifiedExternalTracks,0);
 assert.equal(r.g02Decision,"NO_GO");
});
test("PROJECT_DRIFT_REJECTED",()=>{const x=base();x.project="packtook-prod-01";assert(evaluate(x).errors.includes("PROJECT_DRIFT"))});
test("FUNCTION_DRIFT_REJECTED",()=>{const x=base();x.function="usageAdmin";assert(evaluate(x).errors.includes("FUNCTION_DRIFT"))});
test("REVISION_DRIFT_REJECTED",()=>{const x=base();x.revision="usagestatus-00022-nob";assert(evaluate(x).errors.includes("REVISION_DRIFT"))});
test("BUILD_DRIFT_REJECTED",()=>{const x=base();x.build="other";assert(evaluate(x).errors.includes("BUILD_DRIFT"))});
test("GCS_GENERATION_DRIFT_REJECTED",()=>{const x=base();x.sourceGeneration="gs://other";assert(evaluate(x).errors.includes("SOURCE_GENERATION_DRIFT"))});
test("CANDIDATE_DRIFT_REJECTED",()=>{const x=base();x.candidateSha256="f".repeat(64);assert(evaluate(x).errors.includes("P188_CANDIDATE_DRIFT"))});
test("REVISION_DIGEST_DRIFT_REJECTED",()=>{const x=base();x.revisionImageDigest="sha256:"+"e".repeat(64);assert(evaluate(x).errors.includes("REVISION_DIGEST_DRIFT"))});
test("BUILD_OUTPUT_DIGEST_CONFLICT_REJECTED",()=>{const x=base();x.buildOutputImageDigest="sha256:"+"f".repeat(64);assert(evaluate(x).errors.includes("BUILD_REVISION_IMAGE_DIGEST_MISMATCH"))});
test("BAD_DIGEST_REJECTED",()=>{const x=base();x.buildOutputImageDigest="bad";assert(evaluate(x).errors.includes("BUILD_DIGEST_MALFORMED"))});
test("UNKNOWN_FIELDS_DENIED",()=>{const x=base();x.accountEmail="private@example.invalid";const r=evaluate(x);assert.equal(r.classification,"REJECTED");assert(!JSON.stringify(r).includes("private@example.invalid"))});
test("TOKEN_FIELDS_DENIED",()=>{const x=base();x.token="secret";assert(evaluate(x).errors.includes("UNSAFE_OR_UNEXPECTED_FIELDS"))});
test("NON_OBJECT_DENIED",()=>assert.equal(evaluate(null).classification,"REJECTED"));
test("ARCHIVE_HASH_NOT_CONFUSED_WITH_SOURCE_HASH",()=>assert.equal(evaluate(base()).sourceByteEqualityIndependentlyVerified,false));
test("BUILD_DIGEST_NOT_INFERRED_FROM_REVISION",()=>assert.equal(evaluate(base()).buildRevisionImageDigestMetadataMatches,false));
test("CLAIMED_DIGEST_MATCH_STILL_NO_GO",()=>{const x=base();x.buildOutputImageDigest=EXPECTED_DIGEST;const r=evaluate(x);assert.equal(r.buildRevisionImageDigestMetadataMatches,true);assert.equal(r.releaseDecision,"NO_GO_RELEASE")});
test("FUTURE_SIGNOFF_CANNOT_UNLOCK",()=>{const x=base();x.reviewerIndependentAttestation=true;assert.equal(evaluate(x).g02Decision,"NO_GO")});
test("PUBLIC_SIGNUP_CLOSED",()=>assert.equal(evaluate(base()).publicSignup,"KEEP_CLOSED"));
test("NO_CLOUD_SIDE_EFFECTS",()=>{const x=evaluate(base());assert.equal(x.cloudCalls,0);assert.equal(x.cloudWrites,0)});
console.log("P207_OFFLINE_SOURCE_PROVENANCE_FIXTURES="+n+"/"+n+"_PASS");
console.log("P207_RUNTIME_SOURCE_VERIFICATION=NOT_PERFORMED");
console.log("P207_G02=NO_GO_RELEASE");
