"use strict";
const assert=require("node:assert/strict"),{test}=require("node:test");
const {baseline,evaluate}=require("./p95-source-first-recovery-gate.cjs");
test("owner P94 evidence source first not a rollout approval",()=>{
 const r=evaluate(baseline());
 assert.equal(r.state,"SOURCE_FIRST_RECOVERY_PREFLIGHT_ONLY");
 assert.equal(r.knownGood,"NOT_SELECTED");assert.equal(r.action,"NO_DEPLOY");
});
test("registry not found does not imply lost source",()=>{
 const r=evaluate(baseline());assert.equal(r.sourceAvailability,"P88_CURRENT_SOURCE_READABLE");
 assert.equal(r.priorImageRestorability,"NOT_VERIFIED");
});
for(const [label,modify] of [
 ["production scope",x=>x.project="packtook-prod-01"],
 ["credit target",x=>x.statusFunctions.push("reserveCredit")],
 ["credit exclusion removed",x=>x.excludedCreditFunctions=[]],
 ["unsafe selector",x=>x.exactDeploySelector="PASS"],
 ["false guard fix",x=>x.statusGuardDrift="FIXED"],
 ["false source mapping",x=>x.candidateSourceToCurrentRevision="MATCH"],
 ["false Git mapping",x=>x.sourceToGitCommit="MATCH"],
 ["false rollback",x=>x.restoreDrill="PASSED"],
 ["false known-good",x=>x.priorKnownGood="selected"],
 ["false IAM",x=>x.IAMLeastPrivilege="PASS"],
 ["false App Check",x=>x.liveAppCheck="PASS"],
 ["registry outcome forged",x=>x.currentRegistryLookups.recordingStatus="IMAGE_DELETED"],
 ["zero source revoked",x=>x.currentStatusSourceArchives.usageStatus="MISSING"],
 ["deploy",x=>x.deployed=true],
 ["traffic change",x=>x.trafficChanges=1],
 ["cloud write",x=>x.cloudWrites=1],
 ["candidate promoted",x=>x.proposedPatch="DEPLOYED"]
]){
 test("P95 reject "+label,()=>{
  const e=baseline();modify(e);assert.equal(evaluate(e).state,"INVALID_EVIDENCE");
 });
}
