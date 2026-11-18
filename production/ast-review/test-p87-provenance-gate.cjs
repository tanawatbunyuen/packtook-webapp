"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {REQUIRED,blank,classify}=require("./p87-provenance-gate.cjs");
test("P87 exact 12 checks start unverified and deployment blocked",()=>{
 const r=classify(blank());assert.equal(r.verifiedCount,0);
 assert.equal(r.requiredCount,12);assert.equal(r.deployment,"BLOCKED");
 assert.equal(r.statusGuardDrift,"CONFIRMED_UNREMEDIATED");
});
test("P87 all claimed VERIFIED is still not attested rollout approval",()=>{
 const e=blank();for(const x of REQUIRED)e.checks[x]="VERIFIED";
 const r=classify(e);assert.equal(r.state,"CLAIMED_EVIDENCE_REQUIRES_INDEPENDENT_REVIEW");
 assert.equal(r.safeDeploySelector,"NOT_VERIFIED");
 assert.equal(r.priorKnownGoodRestore,"NOT_PROVEN");
 assert.equal(r.release,"NO_GO_RELEASE");
});
test("P87 fake approved staging deployment must fail",()=>{
 const e=blank();e.stagingDeployAllowed=true;assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P87 production context rejected",()=>{
 const e=blank();e.project="packtook-prod-01";assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P87 reported fixed guard rejected without live proof",()=>{
 const e=blank();e.statusGuardDrift="FIXED";assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P87 changing shared source observation rejected",()=>{
 const e=blank();e.sourcePinAcrossScopes="SHARED";assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P87 shared runtime service account cannot be falsely cleared",()=>{
 const e=blank();e.runtimeIdentitiesShared=false;assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P87 missing required check rejected",()=>{
 const e=blank();delete e.checks.rollbackRestoreDryRunPassed;
 assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P87 arbitrary additional assertion rejected",()=>{
 const e=blank();e.checks.securityPassed="VERIFIED";
 assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P87 unknown evidence status rejected",()=>{
 const e=blank();e.checks.backendAppCheckRuntimeVerified="PASS";
 assert.equal(classify(e).state,"EVIDENCE_INVALID");
});
test("P87 verified pins alone are not restore proof",()=>{
 const e=blank();e.checks.pinnedSourceGenerationReadable="VERIFIED";
 const r=classify(e);
 assert.equal(r.priorKnownGoodRestore,"NOT_PROVEN");
 assert.equal(r.deployment,"BLOCKED");
});
