"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {VERSION,loadPinned,audit}=require("./p101-pinned-cli-parser.cjs");
const {EXACT}=require("./p100-exact-status-selector-gate.cjs");
const helper=loadPinned(process.env.P101_FIREBASE_TOOLS_ROOT||"");
test("P101 verified exact installed published Firebase CLI "+VERSION,()=>{
 assert.equal(VERSION,"15.29.0");
 const result=audit(helper);
 assert.equal(result.offlineSyntheticSelectorCheck,"PASS");
 assert.deepEqual(result.targetedIds,["recordingStatus","usageStatus"]);
 assert.equal(result.targetedIds.length,2);
 assert.equal(result.threeCreditFunctionsExcluded,true);
 assert.equal(result.fullDeployPlanner,"NOT_EXECUTED");
 assert.equal(result.deletionPlan,"NOT_VERIFIED");
 assert.equal(result.release,"NO_GO_RELEASE");
});
test("P101 parser confirms two scoped codebase filters",()=>{
 const cfg=[{source:"functions",codebase:"beta"},{source:"owner-functions",codebase:"owner"},{source:"payment-functions",codebase:"promptpay"}];
 const f=helper.getEndpointFilters({only:EXACT},cfg);
 assert.deepEqual(f.map(x=>x.codebase),["beta","beta"]);
 assert.deepEqual(f.map(x=>x.idChunks.join("-")),["recordingStatus","usageStatus"]);
 assert.deepEqual(helper.targetCodebases(cfg,f),["beta"]);
});
test("P101 uncovers prefix matching by real Firebase CLI parser",()=>{
 const config=[{codebase:"beta",source:"functions"}];
 const f=helper.getEndpointFilters({only:EXACT},config);
 assert.equal(helper.endpointMatchesAnyFilter({id:"recordingStatus-shadow",codebase:"beta"},f),true);
 assert.equal(helper.endpointMatchesAnyFilter({id:"recordingStatusShadow",codebase:"beta"},f),false);
 assert.equal(helper.endpointMatchesAnyFilter({id:"reserveCredit",codebase:"beta"},f),false);
 assert.equal(helper.endpointMatchesAnyFilter({id:"usageStatus-shadow",codebase:"owner"},f),false);
});
test("P101 synthetic extra prefix endpoint blocks deploy",()=>{
 assert.throws(()=>audit(helper,{inventory:[
  ...["recordingStatus","usageStatus","reserveCredit","finalizeCredit","recoverStaleVideoReservation","recordingStatus-extra"].map(id=>({id,codebase:"beta"}))
 ]}),/P101_PREFIX_OR_EXTRA_TARGET_DETECTED/);
});
test("P101 inventory missing usage target blocks safe proof",()=>{
 assert.throws(()=>audit(helper,{inventory:[
  ...["recordingStatus","reserveCredit","finalizeCredit","recoverStaleVideoReservation","extraStatus"].map(id=>({id,codebase:"beta"}))
 ]}),/P101_PREFIX_OR_EXTRA_TARGET_DETECTED/);
});
for(const [label,selector] of [
 ["whole codebase","functions:beta"],
 ["all functions","functions"],
 ["only one","functions:beta:recordingStatus"],
 ["an added credit function",EXACT+",functions:beta:reserveCredit"],
 ["other codebase","functions:owner:recordingStatus,functions:owner:usageStatus"],
 ["shell whitespace",EXACT+" --force"],
 ["unscoped","functions:recordingStatus,functions:usageStatus"],
 ["duplicate", "functions:beta:recordingStatus,functions:beta:recordingStatus"]
]){
 test("P101 pin parser rejects "+label,()=>{
  assert.throws(()=>audit(helper,{selector}),/P101_/);
 });
}
test("P101 source configuration mismatch blocks parser approval",()=>{
 assert.throws(()=>audit(helper,{configSource:{functions:[{codebase:"owner",source:"functions"}]}}),/P101_BETA_CONFIG_MISSING/);
});
test("P101 CLI no function deletion planning executed",()=>{
 const x=audit(helper);
 assert.equal(x.actualDeployedInventory,"NOT_VERIFIED");
 assert.equal(x.deletionPlan,"NOT_VERIFIED");
 assert.equal(x.cloudCalls,0);
 assert.equal(x.trafficChanges,0);
 assert.equal(x.deploy,0);
});
