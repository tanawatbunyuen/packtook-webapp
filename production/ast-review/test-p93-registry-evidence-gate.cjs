"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {template,classify}=require("./p93-registry-evidence-gate.cjs");
test("P93 starts without any live registry metadata attestation",()=>{
 const r=classify(template());assert.equal(r.inspected,0);
 assert.equal(r.state,"REGISTRY_LIVE_INSPECTION_INCOMPLETE");
 assert.equal(r.deploy,"BLOCKED");
});
test("P93 two matching digest metadata results never prove good rollback",()=>{
 const e=template();e.registry.recordingStatus="REGISTRY_DIGEST_METADATA_MATCHED_ONLY";
 e.registry.usageStatus="REGISTRY_DIGEST_METADATA_MATCHED_ONLY";
 const r=classify(e);
 assert.equal(r.state,"REGISTRY_METADATA_REVIEW_ONLY");
 assert.equal(r.priorKnownGood,"NOT_SELECTED");
 assert.equal(r.imagePullAndExecution,"NOT_VERIFIED");
 assert.equal(r.restoreDrill,"NOT_PERFORMED");
 assert.equal(r.release,"NO_GO_RELEASE");
});
for(const [name,mutate] of [
 ["wrong project",x=>x.project="packtook-prod-01"],
 ["forged source parity",x=>x.sourceToGitCommit="VERIFIED"],
 ["invented runnable image",x=>x.imagePullAndExecution="VERIFIED"],
 ["unapproved rollback drill",x=>x.testedRollback="PASSED"],
 ["prior known good claim",x=>x.knownGoodPriorImage="YES"],
 ["fake security gate",x=>x.backendAppCheck="VERIFIED"],
 ["false IAM review",x=>x.leastPrivilegeIAM="VERIFIED"],
 ["selected deploy selector",x=>x.safeDeploySelector="SAFE"],
 ["credit function scope expansion",x=>x.registry.reserveCredit="REGISTRY_DIGEST_METADATA_MATCHED_ONLY"],
 ["altered P92 count",x=>x.p92DigestPinnedCount.recordingStatus=19],
 ["historical current missing",x=>x.currentRevisionPresent.usageStatus=false],
 ["Staging deployment flag",x=>x.stagingDeploy=true],
 ["traffic change",x=>x.trafficChange=true],
 ["fabricated status",x=>x.registry.recordingStatus="PASS"]
]){
 test("P93 reject "+name,()=>{
  const e=template();mutate(e);
  assert.equal(classify(e).state,"INVALID_EVIDENCE");
 });
}
