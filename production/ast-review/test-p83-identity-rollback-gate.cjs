"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {REQUIRED,template,classify}=require("./p83-identity-rollback-gate.cjs");
const m=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../staging-candidates/p82-remediation-package.json"),"utf8"));
const run=(e=template(),manifest=m)=>classify(e,manifest);
test("P83 initial 12 identity and rollback checks are unverified",()=>{
 const r=run();
 assert.equal(r.verifiedCount,0);assert.equal(r.requiredCount,12);
 assert.equal(r.unresolved.length,12);assert.equal(r.stagedDeploy,"BLOCKED");
});
test("P83 reported full evidence does not authorize deployment",()=>{
 const e=template();for(const k of REQUIRED)e.checks[k]="VERIFIED";
 const r=run(e);
 assert.equal(r.state,"EVIDENCE_REPORTED_UNATTESTED");
 assert.equal(r.stagedDeploy,"BLOCKED");assert.equal(r.release,"NO_GO_RELEASE");
});
test("P83 wrong project rejected",()=>{
 const e=template();e.project="packtook-prod-01";
 assert.equal(run(e).state,"INVALID_OR_UNTRUSTED_EVIDENCE");
});
test("P83 forbidden deployment manifest promotion rejected",()=>{
 assert.equal(run(template(),{...m,deployAllowed:true}).state,"INVALID_OR_UNTRUSTED_EVIDENCE");
});
test("P83 scope expansion to credit functions rejected",()=>{
 const updated={...m,scope:{...m.scope,existingCallableNames:["recordingStatus","reserveCredit"]}};
 assert.equal(run(template(),updated).state,"INVALID_OR_UNTRUSTED_EVIDENCE");
});
test("P83 missing rollback drill never ignored",()=>{
 const e=template();for(const k of REQUIRED)e.checks[k]="VERIFIED";
 e.checks.rollbackRestoreDrillPassed="NOT_VERIFIED";
 assert.ok(run(e).unresolved.includes("rollbackRestoreDrillPassed"));
});
test("P83 unknown evidence key rejected",()=>{
 const e=template();e.checks.debugToken="abc";
 assert.equal(run(e).state,"INVALID_OR_UNTRUSTED_EVIDENCE");
});
test("P83 false verified string fails closed",()=>{
 const e=template();e.checks.backendAppCheckEnforcementProven="PASS";
 assert.equal(run(e).state,"INVALID_OR_UNTRUSTED_EVIDENCE");
});
test("P83 DRIFT status still blocks deployment",()=>{
 const e=template();e.checks.statusFunctionsMappedToCodebase="DRIFT";
 assert.equal(run(e).stagedDeploy,"BLOCKED");
});
