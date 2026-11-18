"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {blank,assess}=require("./p91-image-lineage-gate.cjs");
test("P91 base evidence is unverified and blocks release",()=>{
 const r=assess(blank());assert.equal(r.checkedCount,0);
 assert.equal(r.state,"LIVE_LINEAGE_INCOMPLETE");
 assert.equal(r.deploy,"BLOCKED");
});
test("P91 observed image family does not identify safe prior binary",()=>{
 const x=blank();x.lineage.recordingStatus="METADATA_OBSERVED_ONLY";
 x.lineage.usageStatus="METADATA_OBSERVED_ONLY";
 const r=assess(x);
 assert.equal(r.state,"IMAGE_LINEAGE_OBSERVED_ONLY");
 assert.equal(r.knownGoodImage,"NOT_SELECTED");
 assert.equal(r.rollbackRestorable,"NOT_VERIFIED");
 assert.equal(r.release,"NO_GO_RELEASE");
});
for(const [name,modify] of [
 ["wrong project",x=>x.project="packtook-prod-01"],
 ["fake rollback",x=>x.rollbackRestorable="VERIFIED"],
 ["fake Git lineage",x=>x.sourceToGitCommit="MATCH"],
 ["fake App Check",x=>x.liveAppCheck="VERIFIED"],
 ["additional credit scope",x=>x.lineage.reserveCredit="METADATA_OBSERVED_ONLY"],
 ["historic count mismatch",x=>x.historyCounts.usageStatus=22],
 ["fake deploy",x=>x.deployment=true],
 ["traffic change",x=>x.trafficChanged=true],
 ["fake prior image",x=>x.priorKnownGoodImage="VERIFIED"],
 ["unrecognized evidence",x=>x.lineage.recordingStatus="PASS"]
 ]){
 test("P91 reject "+name,()=>{
  const x=blank();modify(x);
  assert.equal(assess(x).state,"INVALID_EVIDENCE");
 });
}
