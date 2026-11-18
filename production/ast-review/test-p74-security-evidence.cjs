"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {KEYS,template,strictShape,classify}=require("./p74-security-evidence.cjs");
test("P74 no runtime evidence defaults to blocked with all gaps reported",()=>{
 const v=classify(template());
 assert.equal(v.verifiedCount,0);assert.equal(v.blockerCount,KEYS.length);
 assert.equal(v.backendAppCheck,"NOT_PROVEN");
 assert.equal(v.stagingDeploy,"BLOCKED");assert.equal(v.release,"NO_GO_RELEASE");
});
test("P74 reported verified evidence never authorizes deployment",()=>{
 const e=template();
 for(const k of KEYS)e.observations[k]="VERIFIED";
 const r=classify(e);
 assert.equal(r.state,"EVIDENCE_COMPLETE_REVIEW_ONLY");
 assert.equal(r.stagingDeploy,"BLOCKED");
 assert.equal(r.p63StagingGuardDrift,"UNRESOLVED");
});
test("P74 App Check evidence requires both positive setting and two negative denial checks",()=>{
 const e=template();e.observations.backendAppCheckEnforced="VERIFIED";
 assert.equal(classify(e).backendAppCheck,"NOT_PROVEN");
 e.observations.negativeInvalidAppCheckDenied="VERIFIED";
 assert.equal(classify(e).backendAppCheck,"NOT_PROVEN");
 e.observations.negativeMissingAppCheckDenied="VERIFIED";
 assert.equal(classify(e).backendAppCheck,"EVIDENCE_REPORTED_NOT_INDEPENDENTLY_ATTESTED");
});
test("P74 project mismatch fails schema",()=>{
 const e=template();e.project="packtook-prod-01";
 assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P74 unknown evidence fields fail schema",()=>{
 const e=template();e.observations.secretValue="exfiltrate";
 assert.equal(strictShape(e),false);
});
test("P74 invalid statuses fail schema",()=>{
 const e=template();e.observations.ownerApproval="YES";
 assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P74 deliberate DRIFT and NOT_APPLICABLE always block",()=>{
 const e=template();e.observations.pilotClosed="DRIFT";
 e.observations.ownerApproval="NOT_APPLICABLE";
 assert.ok(classify(e).blockerFields.includes("pilotClosed"));
 assert.ok(classify(e).blockerFields.includes("ownerApproval"));
});
test("P74 invalid or missing evidence never returns GO",()=>{
 for(const x of [null,{},[],{project:"packtook-staging"}]){
  const r=classify(x);assert.equal(r.release,"NO_GO_RELEASE");
 }
});
