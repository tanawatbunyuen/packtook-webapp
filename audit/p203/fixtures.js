"use strict";
const assert=require("node:assert/strict");
const {packet,REQUIREMENT_ORDER}=require("./handoff");
const {REQUIREMENTS,EXPECTED_CANDIDATE}=require("../p190/reconcile");
let n=0;const test=(name,fn)=>{fn();n++;console.log("P203_"+name+"=PASS")};
const roles={STAGING_LEGACY_INVENTORY:"Staging Cloud Operator",PROD_LEGACY_INVENTORY:"Separately authorized Production Cloud Operator",STAGING_VALID_APPCHECK:"Staging App Check Operator",OWNER_PROVENANCE_REMEDIATION:"Independent Security Reviewer",EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:"Independent Security Reviewer"};
const perfect=()=>Object.fromEntries(REQUIREMENT_ORDER.map(id=>[id,{
 reviewerRole:roles[id],project:REQUIREMENTS[id].project,candidateSha256:EXPECTED_CANDIDATE,
 decision:"APPROVED_FOR_REVIEW",evidenceReference:"G02-EVIDENCE-20261125-ABC123"
}]));
test("FIVE_REQUIREMENTS_BOUND_TO_P190",()=>assert.equal(REQUIREMENT_ORDER.length,5));
test("EMPTY_PACKET_FAILS_CLOSED",()=>{const x=packet();assert.equal(x.externalIndependentlyVerified,0);assert.equal(x.g02Decision,"NO_GO")});
test("ALL_SELF_REPORTED_SIGNOFFS_STILL_NO_GO",()=>{const x=packet({signoffs:perfect()});assert.equal(x.selfAssertedSignoffs,5);assert.equal(x.externalIndependentlyVerified,0);assert.equal(x.independentSecurityDecision,"NOT_PERFORMED")});
test("NO_SIGNOFF_CAN_OPEN_SIGNUP",()=>assert.equal(packet({signoffs:perfect()}).publicSignup,"KEEP_CLOSED"));
test("PRODUCTION_INVENTORY_SEPARATE_AUTH",()=>assert.equal(packet().productionReadAuthorizedByThisPacket,false));
test("UNKNOWN_SIGNOFF_DENIED",()=>assert.throws(()=>packet({signoffs:{arbitrary:{}}}),/P203_UNKNOWN/));
test("WRONG_PROJECT_DENIED",()=>{const x=perfect();x.PROD_LEGACY_INVENTORY.project="packtook-staging";assert.equal(packet({signoffs:x}).requirements[1].classification,"REJECTED")});
test("CANDIDATE_DRIFT_DENIED",()=>{const x=perfect();x.EXACT_RELEASE_DIFF_SECURITY_SIGNOFF.candidateSha256="f".repeat(64);assert(packet({signoffs:x}).requirements[4].issues.includes("RELEASE_CANDIDATE_SHA_DRIFT"))});
test("UNRECOGNIZED_REVIEWER_ROLE_DENIED",()=>{const x=perfect();x.STAGING_VALID_APPCHECK.reviewerRole="Owner";assert(packet({signoffs:x}).requirements[2].issues.includes("REVIEWER_ROLE_CLAIM_DRIFT"))});
test("MALFORMED_REVIEW_REFERENCE_DENIED",()=>{const x=perfect();x.STAGING_LEGACY_INVENTORY.evidenceReference="unreviewed";assert(packet({signoffs:x}).requirements[0].issues.includes("EVIDENCE_REFERENCE_INVALID"))});
test("RAW_EMAIL_REJECTED",()=>{const x=perfect();x.STAGING_LEGACY_INVENTORY.email="private@example.invalid";const y=packet({signoffs:x});assert.equal(y.requirements[0].classification,"REJECTED");assert(!JSON.stringify(y).includes("private@example.invalid"))});
test("RAW_TOKEN_REJECTED",()=>{const x=perfect();x.STAGING_VALID_APPCHECK.token="SECRET_TOKEN";const y=packet({signoffs:x});assert(!JSON.stringify(y).includes("SECRET_TOKEN"))});
test("SIGNOFF_NOT_APPROVED_DENIED",()=>{const x=perfect();x.OWNER_PROVENANCE_REMEDIATION.decision="PENDING";assert(packet({signoffs:x}).requirements[3].issues.includes("REVIEWER_DECISION_NOT_APPROVED"))});
test("REVIEW_DIFF_REQUIRES_ACTUAL_PROVENANCE",()=>{const x=packet({signoffs:perfect()});assert.equal(x.sourceContainerByteEqualityVerified,false)});
test("APPCHECK_REQUIRES_REAL_RUNTIME_TOKEN",()=>assert.equal(packet({signoffs:perfect()}).appCheckRealStagingVerified,false));
test("LEGACY_OWNER_REQUIRES_INDEPENDENT_ATTESTATION",()=>assert.equal(packet({signoffs:perfect()}).legacyOwnerVerified,false));
test("MISSING_SIGNOFF_NOT_MISLABELED_REJECTED",()=>assert.equal(packet().requirements[0].classification,"NOT_SUPPLIED"));
test("CROSS_PROJECT_CLAIMS_REJECTED_THROUGH_P202",()=>{const x=packet({claims:{function:{project:"packtook-prod-01"}}});assert.equal(x.claimRecords[0].classification,"REJECTED")});
test("ALL_GATES_STILL_NO_GO",()=>{const x=packet({signoffs:perfect()});assert.equal(x.releaseDecision,"NO_GO_RELEASE");assert.equal(x.deployDecision,"NO_GO_DEPLOY")});
test("NO_RUNTIME_APPROVAL_FABRICATED",()=>assert.equal(packet({signoffs:perfect()}).reviewerIdentityVerified,false));
console.log("P203_OFFLINE_SECURITY_HANDOFF_FIXTURES="+n+"/"+n+"_PASS");
console.log("P203_REAL_CLOUD_CALLS=0 INDEPENDENT_SIGNOFFS=0");
console.log("P203_G02=NO_GO_RELEASE");
