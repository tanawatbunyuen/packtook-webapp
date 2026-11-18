"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {inspect:selector,STRATEGIES}=require("./p86-selector-risk-matrix.cjs");
const {empty,inspect:rollback,REQUIRED}=require("./p86-rollback-evidence.cjs");
const {EXPECTED}=require("./p85-repository-codebase-ownership.cjs");
const root=path.resolve(__dirname,"..");
const config=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
const sources=Object.fromEntries(EXPECTED.map(x=>[x.source,fs.readFileSync(path.join(root,x.source,"index.js"),"utf8")]));
const package82=JSON.parse(fs.readFileSync(path.join(root,"staging-candidates/p82-remediation-package.json"),"utf8"));
const observation84=JSON.parse(fs.readFileSync(path.join(root,"staging-candidates/p84-p83-operator-observation.json"),"utf8"));
const run=(changes={})=>selector({config,sources,package82,observation84,...changes});
test("P86 catalogues three strategies; no deployment selected",()=>{
 const r=run();assert.equal(r.state,"OFFLINE_SELECTOR_RISK_MATRIX_PREPARED");
 assert.equal(r.strategies.length,3);assert.equal(r.candidateSelector,"NOT_SELECTED");
 assert.equal(r.safeSelectorVerified,false);assert.equal(r.stagingDeploy,"BLOCKED");
});
test("P86 full beta source replacement classified high risk",()=>{
 const s=STRATEGIES.find(x=>x.id==="REPLACE_BETA_SOURCE_DIRECTORY");
 assert.equal(s.risk,"BLOCKED_UNRELATED_EXPORTS");
});
test("P86 function-scoped selection remains unverified",()=>{
 const s=STRATEGIES.find(x=>x.id==="TARGET_TWO_EXISTING_FUNCTIONS");
 assert.equal(s.risk,"REVIEW_REQUIRED_SELECTOR_NOT_PROVEN");
});
test("P86 a new alias would not automatically remediate original API",()=>{
 const s=STRATEGIES.find(x=>x.id==="REGISTER_NEW_ALIAS_CODEBASE");
 assert.equal(s.risk,"BLOCKED_CONTRACT_AND_LIFECYCLE");
});
test("P86 do not equate source-pin separation with codebase isolation",()=>{
 const r=run();assert.equal(r.sourcePinNotEquivalentToCodebaseOwnership,true);
 assert.equal(r.repositoryStatusAndCreditShareCodebase,true);
 assert.equal(r.liveCodebaseOwnership,"NOT_VERIFIED");
});
test("P86 forbid release manifest bypass",()=>{
 assert.equal(run({package82:{...package82,deployAllowed:true}}).state,"INVALID_REVIEW_INPUT");
});
test("P86 forbid wrong environment",()=>{
 assert.equal(run({observation84:{...observation84,project:"packtook-prod-01"}}).state,"INVALID_REVIEW_INPUT");
});
test("P86 forbid invented verified backend App Check",()=>{
 assert.equal(run({observation84:{...observation84,backendAppCheck:"VERIFIED"}}).state,"INVALID_REVIEW_INPUT");
});
test("P86 standard rollback evidence begins at 0 of 12",()=>{
 const r=rollback(empty());assert.equal(r.verifiedCount,0);
 assert.equal(r.requiredCount,12);assert.equal(r.restorableRollback,"NOT_VERIFIED");
});
test("P86 marked VERIFIED evidence does not independently prove a restore",()=>{
 const e=empty();for(const k of REQUIRED)e.fields[k]="VERIFIED";e.completedRestore=true;
 const r=rollback(e);assert.equal(r.state,"REPORTED_EVIDENCE_NEEDS_INDEPENDENT_ATTESTATION");
 assert.equal(r.restorableRollback,"NOT_VERIFIED");assert.equal(r.deploy,"BLOCKED");
});
test("P86 partial rollback evidence cannot unlock deploy",()=>{
 const e=empty();e.fields.sourceGenerationReadability="VERIFIED";
 assert.equal(rollback(e).deploy,"BLOCKED");
});
test("P86 extra rollback key invalidates evidence",()=>{
 const e=empty();e.fields.foo="VERIFIED";
 assert.equal(rollback(e).state,"EVIDENCE_INVALID");
});
test("P86 impossible status string not accepted",()=>{
 const e=empty();e.fields.isolatedStagingRestoreDryRun="PASS";
 assert.equal(rollback(e).state,"EVIDENCE_INVALID");
});
test("P86 can't flip deployment allowed flag",()=>{
 const e=empty();e.stagingDeployAllowed=true;
 assert.equal(rollback(e).state,"EVIDENCE_INVALID");
});
test("P86 can't replace Staging project with Production",()=>{
 const e=empty();e.project="packtook-prod-01";
 assert.equal(rollback(e).state,"EVIDENCE_INVALID");
});
test("P86 rollback evidence cannot omit credit functions",()=>{
 const e=empty();e.functions=["recordingStatus","usageStatus"];
 assert.equal(rollback(e).state,"EVIDENCE_INVALID");
});
