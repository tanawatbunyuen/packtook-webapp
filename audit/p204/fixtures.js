"use strict";
const assert=require("node:assert/strict");
const {intake,receipt,KEYS}=require("./intake");
const {REQUIREMENTS,EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {BUILD,REVISION}=require("../p198/verify");
const roles={STAGING_LEGACY_INVENTORY:"Staging Cloud Operator",
 PROD_LEGACY_INVENTORY:"Separately authorized Production Cloud Operator",
 STAGING_VALID_APPCHECK:"Staging App Check Operator",
 OWNER_PROVENANCE_REMEDIATION:"Independent Security Reviewer",
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:"Independent Security Reviewer"};
let n=0;function t(name,f){f();n++;console.log("P204_"+name+"=PASS");}
const good=(id="STAGING_VALID_APPCHECK")=>({
 requirement:id,project:REQUIREMENTS[id].project,kind:REQUIREMENTS[id].kind,
 candidateSha256:EXPECTED_CANDIDATE,
 artifactSha256:"a".repeat(64),reference:"G02-EVIDENCE-ABCDEF123456",ticket:"G02-READONLY-20261125",
 capturedAt:"2026-11-24T15:00:00Z",submittedAt:"2026-11-25T03:00:00Z",
 operatorRole:roles[id],reportedOutcome:"PASS",proposedReviewerDecision:"APPROVED_FOR_REVIEW",
 revision:REVISION,buildId:BUILD});
const row=(o)=>intake({submissions:[o]}).records[0];
t("EMPTY_INTAKE_NO_VERIFICATION",()=>{const r=intake();assert.equal(r.externallyIndependentlyVerified,0);assert.equal(r.submitted,0)});
t("VALID_METADATA_SUBMITTED_ONLY",()=>{const r=row(good());assert.equal(r.state,"SUBMITTED");assert.equal(r.independentlyVerified,false)});
t("ALL_FIVE_REQUIREMENTS_UNVERIFIED",()=>assert.equal(intake().fiveExternalG02RequirementsRemainUnverified,5));
t("FORGED_APPROVAL_STILL_NO_GO",()=>{const x=intake({submissions:[good()]});assert.equal(x.externallyIndependentlyVerified,0);assert.equal(x.g02Decision,"NO_GO")});
t("DUPLICATE_REFERENCE_REJECTED",()=>{const a=good();const b={...good(),artifactSha256:"b".repeat(64)};const v=intake({submissions:[a,b]});assert.equal(v.submitted,1);assert(v.records[1].issues.includes("REPLAY_OR_DUPLICATE_REFERENCE"))});
t("EXACT_REPLAY_REJECTED",()=>{const v=intake({submissions:[good(),good()]});assert.equal(v.rejected,1)});
t("RAW_PII_FIELD_REJECTED",()=>{const x=good();x.email="private@example.invalid";const v=intake({submissions:[x]});assert.equal(v.rejected,1);assert(!JSON.stringify(v).includes("private@example.invalid"))});
t("RAW_TOKEN_FIELD_REJECTED",()=>{const x=good();x.authToken="SECRET";assert(row(x).issues.includes("INVALID_SHAPE_OR_RAW_DATA"))});
t("CROSS_PROJECT_PROD_REJECTED",()=>{const x=good("PROD_LEGACY_INVENTORY");x.project="packtook-staging";assert(row(x).issues.includes("CROSS_PROJECT_REFUSED"))});
t("CROSS_PROJECT_STAGING_REJECTED",()=>{const x=good();x.project="packtook-prod-01";assert(row(x).issues.includes("CROSS_PROJECT_REFUSED"))});
t("CANDIDATE_HASH_DRIFT_REJECTED",()=>{const x=good();x.candidateSha256="f".repeat(64);assert(row(x).issues.includes("CANDIDATE_SHA256_MISMATCH"))});
t("SOURCE_ARTIFACT_HASH_BAD_REJECTED",()=>{const x=good();x.artifactSha256="missing";assert(row(x).issues.includes("ARTIFACT_SHA256_INVALID"))});
t("UNKNOWN_REQUIREMENT_REJECTED",()=>{const x=good();x.requirement="PROD_DEPLOY";assert(row(x).issues.includes("UNKNOWN_REQUIREMENT"))});
t("ROLE_IMPERSONATION_REJECTED",()=>{const x=good();x.operatorRole="Owner";assert(row(x).issues.includes("REPORTED_OPERATOR_ROLE_MISMATCH"))});
t("FUTURE_CAPTURE_REJECTED",()=>{const x=good();x.capturedAt="2032-01-01T00:00:00Z";assert(row(x).issues.includes("CAPTURE_DATE_STALE_OR_FUTURE"))});
t("STALE_CAPTURE_REJECTED",()=>{const x=good();x.capturedAt="2025-01-01T00:00:00Z";assert(row(x).issues.includes("CAPTURE_DATE_STALE_OR_FUTURE"))});
t("SUBMIT_BEFORE_CAPTURE_REJECTED",()=>{const x=good();x.submittedAt="2026-11-23T00:00:00Z";assert(row(x).issues.includes("SUBMITTED_BEFORE_CAPTURE"))});
t("REVISION_MISMATCH_REJECTED",()=>{const x=good();x.revision="usagestatus-00025-abc";assert(row(x).issues.includes("REVISION_NOT_PINNED"))});
t("BUILD_ID_MISMATCH_REJECTED",()=>{const x=good();x.buildId="OTHER_BUILD";assert(row(x).issues.includes("BUILD_NOT_PINNED"))});
t("MALFORMED_REFERENCE_REJECTED",()=>{const x=good();x.reference="../../secrets";assert(row(x).issues.includes("REFERENCE_INVALID"))});
t("MALFORMED_TICKET_REJECTED",()=>{const x=good();x.ticket="not-approved";assert(row(x).issues.includes("TICKET_INVALID"))});
t("FAILED_PROVIDER_OUTCOME_REJECTED",()=>{const x=good();x.reportedOutcome="FAIL";assert(row(x).issues.includes("REPORTED_OUTCOME_NOT_PASS"))});
t("WRONG_EVIDENCE_KIND_REJECTED",()=>{const x=good();x.kind="DEPLOY";assert(row(x).issues.includes("EVIDENCE_KIND_MISMATCH"))});
t("INVALID_REVIEW_DECISION_REJECTED",()=>{const x=good();x.proposedReviewerDecision="PROD_GO";assert(row(x).issues.includes("INVALID_REVIEWER_DECISION"))});
t("MISSING_PRODUCTION_ACCESS_AUTHORIZATION",()=>assert.equal(intake({submissions:[good("PROD_LEGACY_INVENTORY")]}).productionReadAuthorizationGranted,false));
t("CLAIMS_WITH_FAKE_SIGNOFF_NEVER_VERIFIED",()=>{
 const x=intake({submissions:[good()],claims:{securitySignoff:{
 project:"packtook-staging",candidateSha256:EXPECTED_CANDIDATE,revisionAndDiffVerified:true,independentAttestation:true}}});
 assert.equal(x.externallyIndependentlyVerified,0);assert.equal(x.releaseDecision,"NO_GO_RELEASE");
});
t("OVERLONG_BATCH_DENIED",()=>assert.throws(()=>intake({submissions:Array(101).fill(good())}),/P204_BATCH_INVALID/));
t("NON_ARRAY_BATCH_DENIED",()=>assert.throws(()=>intake({submissions:{}}),/P204_BATCH_INVALID/));
t("NO_RAW_PROVENANCE_EXPOSED",()=>{
 const x=JSON.stringify(intake({submissions:[good()]}));
 assert(!x.includes("G02-READONLY-20261125"));assert(!x.includes("G02-EVIDENCE-ABCDEF123456"));
});
t("ALL_RELEASE_GATES_FAIL_CLOSED",()=>{const x=intake({submissions:[good()]});assert.equal(x.deployDecision,"NO_GO_DEPLOY");assert.equal(x.publicSignup,"KEEP_CLOSED")});
console.log("P204_OFFLINE_INTAKE_SECURITY_FIXTURES="+n+"/"+n+"_PASS");
console.log("P204_CLOUD_CALLS=0 VERIFIED_EXTERNAL_SIGNOFFS=0");
console.log("P204_G02=NO_GO_RELEASE");
