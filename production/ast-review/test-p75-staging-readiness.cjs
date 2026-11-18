"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {inspect}=require("./p75-staging-readiness.cjs");
const root=path.join(__dirname,"..");
const evidence=JSON.parse(fs.readFileSync(path.join(root,"staging-candidates/p74-evidence-template.json"),"utf8"));
const manifest=JSON.parse(fs.readFileSync(path.join(root,"staging-candidates/p70-deployment-manifest.json"),"utf8"));
const candidate=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/index.js"),"utf8");
const legacy=fs.readFileSync(path.join(root,"staging-candidates/p75/legacy-status-guard-candidate.cjs"),"utf8");
const check=(e=evidence,m=manifest,c=candidate,l=legacy)=>inspect({evidence:e,manifest:m,candidate:c,legacy:l});
test("P75 default 17 evidence gaps, guard drift unresolved, no staging deployment",()=>{
 const v=check();
 assert.equal(v.state,"REVIEW_CANDIDATE_ONLY");
 assert.equal(v.unresolvedEvidenceCount,17);
 assert.equal(v.guardDrift,"UNRESOLVED");
 assert.equal(v.stageDeployment,"BLOCKED");
 assert.equal(v.release,"NO_GO_RELEASE");
});
test("P75 all evidence flagged verified still cannot automatically deploy",()=>{
 const e=structuredClone(evidence);
 for(const k of Object.keys(e.observations))e.observations[k]="VERIFIED";
 const r=check(e);
 assert.equal(r.stageDeployment,"BLOCKED");
 assert.equal(r.guardDrift,"UNRESOLVED");
});
test("P75 malicious manifest enabling deploy invalidates result",()=>{
 const r=check(evidence,{...manifest,deployAllowed:true});
 assert.equal(r.state,"NOT_VERIFIABLE");assert.equal(r.stageDeployment,"BLOCKED");
});
test("P75 staging cloud deployment claim in manifest invalidates result",()=>{
 const r=check(evidence,{...manifest,stagingDeploymentPerformed:true});
 assert.equal(r.state,"NOT_VERIFIABLE");
});
test("P75 missing protect wrapper on legacy status detected",()=>{
 const r=check(evidence,manifest,candidate,legacy.replace("const recordingStatus=protect(","const recordingStatus=onCall("));
 assert.equal(r.issue,"SCOPED_GUARD_MISSING");
});
test("P75 source without explicit App Check option detected",()=>{
 const r=check(evidence,manifest,candidate.replace("enforceAppCheck:true","enforceAppCheck:false"));
 assert.equal(r.issue,"STATIC_APPCHECK_NOT_TRUE");
});
test("P75 source containing deployed legacy alias registration forbidden",()=>{
 const r=check(evidence,manifest,candidate+"\nexports.usageStatus=protect(()=>null);");
 assert.equal(r.issue,"LEGACY_NAMES_ALREADY_REGISTERED");
});
test("P75 production-bound auth dependencies in legacy candidate rejected",()=>{
 const r=check(evidence,manifest,candidate,legacy+'\nconst x="packtookProductionBeta"');
 assert.equal(r.issue,"LEGACY_CANDIDATE_BOUNDARY_INVALID");
});
test("P75 invalid P74 evidence refused without escalation",()=>{
 const e=structuredClone(evidence);e.project="packtook-prod-01";
 assert.equal(check(e).state,"NOT_VERIFIABLE");
});
test("P75 untouched candidate still does not prove live App Check",()=>{
 const r=check();assert.equal(r.backendAppCheck,"NOT_PROVEN");
 assert.equal(r.sourceAttestation,"REQUIRED_POST_APPROVED_DEPLOY");
});
