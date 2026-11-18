"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {assess}=require("./p81-confirmed-drift-gate.cjs");
const evidence=require("../staging-candidates/p81/p80-operator-drift-evidence.json");
const source=fs.readFileSync(path.join(__dirname,"../staging-candidates/p81/legacy-status-live-gate-candidate.cjs"),"utf8");
test("P81 operator evidence confirms drift, candidate not deployed",()=>{
 const r=assess(evidence,source);
 assert.equal(r.state,"GUARD_DRIFT_CONFIRMED_CANDIDATE_ONLY");
 assert.equal(r.deployedGuardStatus,"UNREMEDIATED");
 assert.equal(r.stagingDeploy,"BLOCKED");
 assert.equal(r.release,"NO_GO_RELEASE");
});
test("P81 unproven backend App Check cannot be silently promoted",()=>{
 assert.equal(assess({...evidence,appCheck:"VERIFIED"},source).state,"INVALID_EVIDENCE");
});
test("P81 evidence cannot change drift to fixed",()=>{
 assert.equal(assess({...evidence,usageStatus:"MATCH_REVIEW_ONLY"},source).state,"INVALID_EVIDENCE");
});
test("P81 rejects unprotected callable source mutation",()=>{
 assert.equal(assess(evidence,source.replace("gate.assertAuthorized(request)","request.auth.uid")).state,"INVALID_EVIDENCE");
});
test("P81 rejects accidental legacy export registration",()=>{
 assert.equal(assess(evidence,source+"\nexports.recordingStatus=1;").state,"INVALID_EVIDENCE");
});
test("P81 wrong project not accepted",()=>{
 assert.equal(assess({...evidence,project:"packtook-prod-01"},source).state,"INVALID_EVIDENCE");
});
