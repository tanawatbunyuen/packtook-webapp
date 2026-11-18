"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {template,assess}=require("./p92-image-provenance-evidence-gate.cjs");
test("P92 owner P91 lineage 20/21 preserved; future checks unverified",()=>{
 const r=assess(template());
 assert.equal(r.state,"DIGEST_CLASSIFICATION_INCOMPLETE");
 assert.equal(r.inspectedCount,0);
 assert.equal(r.deploy,"BLOCKED");
});
test("P92 even two digest classifications do not prove known-good restore",()=>{
 const x=template();
 x.p92DigestClassification.recordingStatus="IMAGE_METADATA_CLASSIFIED_ONLY";
 x.p92DigestClassification.usageStatus="IMAGE_METADATA_CLASSIFIED_ONLY";
 const r=assess(x);
 assert.equal(r.state,"DIGEST_METADATA_REVIEW_ONLY");
 assert.equal(r.knownGoodImage,"NOT_SELECTED");
 assert.equal(r.imageAvailable,"NOT_VERIFIED");
 assert.equal(r.rollback,"NOT_VERIFIED");
 assert.equal(r.release,"NO_GO_RELEASE");
});
for(const [name,mutate] of [
 ["wrong project",x=>x.project="packtook-prod-01"],
 ["false known-good",x=>x.verifiedPriorKnownGoodImage=true],
 ["fabricated image availability",x=>x.imageRegistryRetrievability="VERIFIED"],
 ["fabricated source Git mapping",x=>x.sourceToGitCommit="MATCH"],
 ["fake rollback",x=>x.rollbackDryRun="PASS"],
 ["fake source-to-revision",x=>x.immutableSourceToRevisionMapping="VERIFIED"],
 ["fake App Check",x=>x.appCheckRuntime="VERIFIED"],
 ["fabricated IAM",x=>x.IAMLeastPrivilege="VERIFIED"],
 ["changed history",x=>x.p91Counts.recordingStatus=19],
 ["changed image counts",x=>x.p91UniqueImageReferences.usageStatus=20],
 ["missing current revision",x=>x.p91CurrentRevisionPresent.usageStatus=false],
 ["extra credit function",x=>x.p92DigestClassification.reserveCredit="IMAGE_METADATA_CLASSIFIED_ONLY"],
 ["unknown state",x=>x.p92DigestClassification.usageStatus="PASS"],
 ["deployment",x=>x.deployment=true],
 ["traffic change",x=>x.trafficChanges=true]
 ]){
  test("P92 rejects "+name,()=>{
   const x=template();mutate(x);
   assert.equal(assess(x).state,"INVALID_EVIDENCE");
  });
}
