"use strict";
const assert=require("node:assert/strict");
const {dashboard,renderMarkdown}=require("./dashboard");
const {REQUIREMENTS,EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {BUILD,REVISION}=require("../p198/verify");
const {REQUIREMENT_ORDER}=require("../p203/handoff");
const role={STAGING_LEGACY_INVENTORY:"Staging Cloud Operator",
 PROD_LEGACY_INVENTORY:"Separately authorized Production Cloud Operator",
 STAGING_VALID_APPCHECK:"Staging App Check Operator",
 OWNER_PROVENANCE_REMEDIATION:"Independent Security Reviewer",
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:"Independent Security Reviewer"};
function submitted(id="STAGING_VALID_APPCHECK",ref="G02-EVIDENCE-ABCDEF123456"){
 return {requirement:id,project:REQUIREMENTS[id].project,kind:REQUIREMENTS[id].kind,
  candidateSha256:EXPECTED_CANDIDATE,artifactSha256:"a".repeat(64),reference:ref,
  ticket:"G02-READONLY-20261125",capturedAt:"2026-11-24T15:00:00Z",
  submittedAt:"2026-11-25T03:00:00Z",operatorRole:role[id],reportedOutcome:"PASS",
  proposedReviewerDecision:"APPROVED_FOR_REVIEW",revision:REVISION,buildId:BUILD};
}
let n=0;const test=(name,fn)=>{fn();n++;console.log("P205_"+name+"=PASS")};
test("FIVE_REQUIREMENTS_EXACT_P190",()=>assert.deepEqual(dashboard().lanes.map(x=>x.id),REQUIREMENT_ORDER));
test("ZERO_INDEPENDENT_VERIFICATIONS",()=>assert.equal(dashboard().stats.independentlyVerified,0));
test("ALL_EMPTY_MISSING",()=>assert.equal(dashboard().stats.missing,5));
test("PROD_INVENTORY_ALWAYS_SEPARATE_PROJECT",()=>assert.equal(dashboard().lanes.find(x=>x.id==="PROD_LEGACY_INVENTORY").project,"packtook-prod-01"));
test("PROD_READ_NOT_AUTHORIZED",()=>assert.equal(dashboard().productionReadAuthorizationGranted,false));
test("STAGING_SUBMITTED_UNVERIFIED",()=>{
 const x=dashboard({submissions:[submitted()]});
 assert.equal(x.stats.submittedUnverified,1);
 assert.equal(x.lanes.find(y=>y.id==="STAGING_VALID_APPCHECK").status,"SUBMITTED_UNVERIFIED");
 assert.equal(x.stats.independentlyVerified,0);
});
test("REJECTED_EVIDENCE_NOT_ACCEPTED",()=>{
 const s=submitted();s.project="packtook-prod-01";const x=dashboard({submissions:[s]});
 assert.equal(x.stats.rejected,1);assert.equal(x.stats.submittedUnverified,0);
});
test("DUPLICATE_REFERENCE_REPLAY_REJECTED",()=>{
 const x=dashboard({submissions:[submitted(),submitted()]});
 assert.equal(x.stats.intakeRejected,1);assert.equal(x.stats.intakeSubmitted,1);
});
test("MULTIPLE_ENTRIES_FOR_SAME_TRACK_NO_DOUBLE_PASS",()=>{
 const x=dashboard({submissions:[submitted("STAGING_VALID_APPCHECK","G02-EVIDENCE-ABCDEF123456"),
 submitted("STAGING_VALID_APPCHECK","G02-EVIDENCE-ABCDEF123457")]});
 assert.equal(x.stats.submittedUnverified,1);
 assert.equal(x.stats.intakeSubmitted,2);
});
test("FORGED_REVIEWER_STATUS_CANNOT_GO",()=>{
 const x=dashboard({submissions:[submitted()]});
 assert.equal(x.g02Decision,"NO_GO");assert.equal(x.releaseDecision,"NO_GO_RELEASE");
});
test("ALL_FIVE_SELF_SUBMISSIONS_STILL_ZERO_VERIFIED",()=>{
 const s=REQUIREMENT_ORDER.map((id,i)=>submitted(id,"G02-EVIDENCE-ABCDEF12345"+i));
 const x=dashboard({submissions:s});
 assert.equal(x.stats.submittedUnverified,5);assert.equal(x.stats.independentlyVerified,0);
});
test("WRONG_CANDIDATE_PIN_REJECTED",()=>{
 const s=submitted();s.candidateSha256="f".repeat(64);
 assert.equal(dashboard({submissions:[s]}).stats.rejected,1);
});
test("WRONG_BUILD_PIN_REJECTED",()=>{
 const s=submitted();s.buildId="build-other";
 assert.equal(dashboard({submissions:[s]}).stats.rejected,1);
});
test("WRONG_REVISION_PIN_REJECTED",()=>{
 const s=submitted();s.revision="usagestatus-00022-nob";
 assert.equal(dashboard({submissions:[s]}).stats.rejected,1);
});
test("PII_FIELD_DENIED_NO_LEAK",()=>{
 const s=submitted();s.email="private@example.invalid";
 const out=JSON.stringify(dashboard({submissions:[s]}));
 assert(!out.includes("private@example.invalid"));
});
test("SECRET_FIELD_DENIED_NO_LEAK",()=>{
 const s=submitted();s.token="PRIVATE_TOKEN";
 assert(!JSON.stringify(dashboard({submissions:[s]})).includes("PRIVATE_TOKEN"));
});
test("NO_RAW_TICKET_OR_EVIDENCE_REFERENCE_LEAK",()=>{
 const out=JSON.stringify(dashboard({submissions:[submitted()]}));
 assert(!out.includes("G02-READONLY-20261125"));
 assert(!out.includes("G02-EVIDENCE-ABCDEF123456"));
});
test("PRODUCTION_INVENTORY_CANNOT_BE_MARKED_VERIFIED",()=>{
 const x=dashboard({submissions:[submitted("PROD_LEGACY_INVENTORY")]});
 assert.equal(x.lanes.find(z=>z.id==="PROD_LEGACY_INVENTORY").independentlyVerified,false);
});
test("EVERY_LANE_HAS_ACTION_AND_PREREQUISITES",()=>{
 assert(dashboard().lanes.every(x=>x.nextAction.length>20&&x.prerequisites.length>0));
});
test("REVIEWER_NOT_AUTOMATICALLY_AUTHENTICATED",()=>assert.equal(dashboard().independentReviewAvailableInOfflineMode,false));
test("MARKDOWN_REPORT_MATCHES_NO_GO",()=>{
 const md=renderMarkdown(dashboard({submissions:[submitted()]}));
 assert(md.includes("NO_GO_RELEASE"));assert(md.includes("SUBMITTED_UNVERIFIED"));
 assert(md.includes("0/5"));assert(md.includes("0/8"));
});
test("REPORT_NEVER_WRITES_CLOUD",()=>{const x=dashboard();assert.equal(x.cloudCalls,0);assert.equal(x.cloudWrites,0)});
test("PUBLIC_SIGNUP_ALWAYS_CLOSED",()=>assert.equal(dashboard({submissions:[submitted()]}).publicSignup,"KEEP_CLOSED"));
test("ALL_RELEASE_GATES_STILL_BLOCKED",()=>assert.equal(dashboard().stats.releaseGatesPassed,0));
console.log("P205_EVIDENCE_GAP_DASHBOARD_FIXTURES="+n+"/"+n+"_PASS");
console.log("P205_REAL_CLOUD_CALLS=0 INDEPENDENT_ATTESTATIONS=0");
console.log("P205_G02=NO_GO_RELEASE");
