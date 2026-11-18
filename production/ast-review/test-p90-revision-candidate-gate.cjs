"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {baseline,check}=require("./p90-revision-candidate-gate.cjs");
test("P90 user-confirmed history counts only, not rollback",()=>{
 const r=check(baseline());
 assert.equal(r.state,"HISTORY_COUNTS_CONFIRMED_ONLY");
 assert.equal(r.recordingStatusVisible,20);
 assert.equal(r.usageStatusVisible,21);
 assert.equal(r.rollback,"NOT_VERIFIED");
});
test("P90 never select a revision automatically",()=>{
 const x=baseline();x.candidateSelected=true;
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
test("P90 no false prior source mapping",()=>{
 const x=baseline();x.priorSourceGenerationMapping="VERIFIED";
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
test("P90 no fake known-good revision",()=>{
 const x=baseline();x.knownGoodPriorRevision="20";
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
test("P90 cannot claim safe selector",()=>{
 const x=baseline();x.safeDeploySelector="VERIFIED";
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
test("P90 rejects changed revision count without new provenance",()=>{
 const x=baseline();x.visibleRevisionCounts.usageStatus=22;
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
test("P90 forbids target scope expansion",()=>{
 const x=baseline();x.visibleRevisionCounts.reserveCredit=1;
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
test("P90 wrong project blocked",()=>{
 const x=baseline();x.project="packtook-prod-01";
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
test("P90 traffic changes cannot be hidden",()=>{
 const x=baseline();x.trafficChanged=true;
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
test("P90 deployment never allowed",()=>{
 const x=baseline();x.deployPerformed=true;
 assert.equal(check(x).state,"INVALID_EVIDENCE");
});
