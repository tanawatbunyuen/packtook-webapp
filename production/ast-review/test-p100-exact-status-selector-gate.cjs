"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {inspect,EXACT,TARGETS,CREDIT}=require("./p100-exact-status-selector-gate.cjs");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const firebase=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
const candidate=fs.readFileSync(path.join(root,"staging-candidates/p98/guarded-status-integration-candidate.cjs"),"utf8");
const base=()=>({source,firebase,candidate});
test("P100 exact two-function intent syntax allowed but no deployment approval",()=>{
 const r=inspect();
 assert.equal(EXACT,"functions:beta:recordingStatus,functions:beta:usageStatus");
 assert.equal(r.offlineSyntaxAllowlist,"PASS");
 assert.equal(r.selectorIntent,"TWO_EXACT_STATUS_EXPORTS");
 assert.deepEqual(r.targetFunctions,TARGETS);
 assert.deepEqual(r.excludedCreditFunctions,CREDIT);
 assert.equal(r.actualCliSelectorSemantics,"NOT_VERIFIED");
 assert.equal(r.multiFunctionCliRisk,"REVIEW_REQUIRED");
 assert.equal(r.stagingDeploy,"BLOCKED");
 assert.equal(r.release,"NO_GO_RELEASE");
});
test("P100 never infer deployment safety from fake CLI version or mapping",()=>{
 const x=inspect({runtimeCliVersion:"14.0.0",deployedMapping:{all:true},verifiedRollback:true});
 assert.equal(x.firebaseCliVersion,"UNVERIFIED_INPUT_IGNORED");
 assert.equal(x.deployedFunctionOwnership,"UNVERIFIED_INPUT_IGNORED");
 assert.equal(x.knownGoodRollback,"UNVERIFIED_INPUT_IGNORED");
 assert.equal(x.stagingDeploy,"BLOCKED");
});
for(const [label,selector] of [
 ["all functions","functions"],
 ["beta whole codebase","functions:beta"],
 ["only recording","functions:beta:recordingStatus"],
 ["only usage","functions:beta:usageStatus"],
 ["both unscoped","functions:recordingStatus,functions:usageStatus"],
 ["one unscoped","functions:beta:recordingStatus,functions:usageStatus"],
 ["duplicate recording","functions:beta:recordingStatus,functions:beta:recordingStatus"],
 ["reversed order","functions:beta:usageStatus,functions:beta:recordingStatus"],
 ["credit reserve target","functions:beta:recordingStatus,functions:beta:reserveCredit"],
 ["credit finalize target","functions:beta:finalizeCredit,functions:beta:usageStatus"],
 ["credit recovery target","functions:beta:recoverStaleVideoReservation"],
 ["production codebase","functions:owner:recordingStatus,functions:owner:usageStatus"],
 ["deploy force appended",EXACT+" --force"],
 ["delete appended",EXACT+";firebase functions:delete reserveCredit"],
 ["wildcard", "functions:beta:*"],
 ["extra target",EXACT+",functions:beta:reserveCredit"],
 ["empty selector",""],
 ["whitespace", " "+EXACT],
 ["shell expansion",EXACT+"$(echo fail)"],
 ["case changed","functions:beta:recordingstatus,functions:beta:usageStatus"]
]){
 test("P100 reject "+label,()=>{
  const r=inspect({selector});
  assert.equal(r.offlineSyntaxAllowlist,"FAIL",label);
  assert.ok(r.findings.length>0);
  assert.equal(r.stagingDeploy,"BLOCKED");
 });
}
for(const [label,changes,reason] of [
 ["wrong project",x=>x.project="packtook-prod-01","P100_PROJECT_MISMATCH"],
 ["missing beta codebase",x=>x.firebase={functions:[{source:"functions",codebase:"other"}]},"P100_BETA_CODEBASE_NOT_EXCLUSIVE"],
 ["duplicate beta codebase",x=>x.firebase={...x.firebase,functions:[...x.firebase.functions,{source:"functions",codebase:"beta"}]},"P100_BETA_CODEBASE_NOT_EXCLUSIVE"],
 ["missing recording export",x=>x.source=x.source.replace("exports.recordingStatus=","exports.otherRecordingStatus="),"P100_ORIGINAL_EXPORTS_NOT_FOUND"],
 ["missing reserve export",x=>x.source=x.source.replace("exports.reserveCredit=","exports.otherReserveCredit="),"P100_CREDIT_EXPORT_BOUNDARY_CHANGED"],
 ["integrated candidate",x=>x.source+='\ncreateP98GuardedStatusHandlers({});',"P100_CANDIDATE_ALREADY_REGISTERED"],
 ["candidate no P81",x=>x.candidate=x.candidate.replaceAll("createP81LegacyHandlers","unsafeCall"),"P100_CANDIDATE_MISSING"]
]){
 test("P100 fail closed "+label,()=>{
  const x={...base()};changes(x);
  const r=inspect(x);
  assert.equal(r.offlineSyntaxAllowlist,"FAIL");
  assert.ok(r.findings.includes(reason),JSON.stringify(r.findings));
  assert.equal(r.release,"NO_GO_RELEASE");
 });
}
