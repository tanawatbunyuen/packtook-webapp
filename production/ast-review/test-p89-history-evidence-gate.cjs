"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {baseline,classify}=require("./p89-history-evidence-gate.cjs");
test("P89 recorded P88 current archive success cannot imply rollback",()=>{
 const r=classify(baseline());
 assert.equal(r.currentSourceReadability,"2_OF_2_P88_CONFIRMED");
 assert.equal(r.priorArchiveRestorable,"NOT_VERIFIED");
 assert.equal(r.stagingDeploy,"BLOCKED");
});
test("P89 two checked histories remain observational not restore proof",()=>{
 const x=baseline();x.history.recordingStatus="HISTORY_METADATA_ONLY";x.history.usageStatus="HISTORY_METADATA_ONLY";
 const r=classify(x);assert.equal(r.state,"HISTORY_METADATA_OBSERVED_ONLY");
 assert.equal(r.knownGoodPreviousRevision,"NOT_VERIFIED");
 assert.equal(r.rollback,"NOT_VERIFIED");assert.equal(r.release,"NO_GO_RELEASE");
});
test("P89 wrong project rejected",()=>{
 const x=baseline();x.project="packtook-prod-01";assert.equal(classify(x).state,"INVALID_EVIDENCE");
});
test("P89 forged backup restores rejected",()=>{
 const x=baseline();x.restoreDrillPerformed=true;assert.equal(classify(x).state,"INVALID_EVIDENCE");
});
test("P89 prior source generation unverified cannot be promoted",()=>{
 const x=baseline();x.sourceGenerationToPreviousRevision="VERIFIED";
 assert.equal(classify(x).state,"INVALID_EVIDENCE");
});
test("P89 missing P88 source evidence rejected",()=>{
 const x=baseline();x.currentArchiveReadable.usageStatus=false;
 assert.equal(classify(x).state,"INVALID_EVIDENCE");
});
test("P89 no third function may be included",()=>{
 const x=baseline();x.history.reserveCredit="HISTORY_METADATA_ONLY";
 assert.equal(classify(x).state,"INVALID_EVIDENCE");
});
test("P89 drift/invalid history is never history pass",()=>{
 const x=baseline();x.history.recordingStatus="METADATA_CHANGED_REVIEW_REQUIRED";
 assert.equal(classify(x).revisionHistoryInspected,0);
});
test("P89 backend App Check is not assumed",()=>{
 const x=baseline();x.backendAppCheck="VERIFIED";assert.equal(classify(x).state,"INVALID_EVIDENCE");
});
test("P89 deploy flag blocked",()=>{
 const x=baseline();x.deployment=true;assert.equal(classify(x).state,"INVALID_EVIDENCE");
});
