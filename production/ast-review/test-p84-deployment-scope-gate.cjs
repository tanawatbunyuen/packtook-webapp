"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {verify}=require("./p84-deployment-scope-gate.cjs");
const root=path.resolve(__dirname,"../staging-candidates");
const m=JSON.parse(fs.readFileSync(path.join(root,"p82-remediation-package.json"),"utf8"));
const e=JSON.parse(fs.readFileSync(path.join(root,"p83-identity-rollback-evidence.json"),"utf8"));
const o=JSON.parse(fs.readFileSync(path.join(root,"p84-p83-operator-observation.json"),"utf8"));
const check=(a=m,b=e,c=o)=>verify(a,b,c);
test("P84 operator report supports metadata only and never unlocks deploy",()=>{
 const r=check();assert.equal(r.state,"OBSERVED_METADATA_ONLY_REVIEW_REQUIRED");
 assert.equal(r.deploy,"BLOCKED");assert.equal(r.release,"NO_GO_RELEASE");
 assert.equal(r.rollbackRestorable,"NOT_VERIFIED");
});
test("P84 no App Check promotion from static configuration",()=>{
 assert.equal(check(m,e,{...o,backendAppCheck:"VERIFIED"}).state,"INVALID_OR_INCOMPLETE");
});
test("P84 Codebase label absence cannot be fabricated as known",()=>{
 assert.equal(check(m,e,{...o,p83CodebaseLabelsPresent:true}).state,"INVALID_OR_INCOMPLETE");
});
test("P84 shared service identities must not silently disappear",()=>{
 assert.equal(check(m,e,{...o,p83RuntimeIdentitiesShared:false}).state,"INVALID_OR_INCOMPLETE");
});
test("P84 no fake rollback proof",()=>{
 assert.equal(check(m,e,{...o,rollbackRestorable:"VERIFIED"}).state,"INVALID_OR_INCOMPLETE");
});
test("P84 scope expansion blocked",()=>{
 const changed={...m,scope:{...m.scope,existingCallableNames:["recordingStatus","usageStatus","reserveCredit"]}};
 assert.equal(check(changed).state,"INVALID_OR_INCOMPLETE");
});
test("P84 staging deploy flag cannot be switched",()=>{
 assert.equal(check({...m,deployAllowed:true}).state,"INVALID_OR_INCOMPLETE");
});
test("P84 project mismatch rejected",()=>{
 assert.equal(check(m,e,{...o,project:"packtook-prod-01"}).state,"INVALID_OR_INCOMPLETE");
});
test("P84 incomplete functions results fail closed",()=>{
 assert.equal(check(m,e,{...o,functions:["recordingStatus"]}).state,"INVALID_OR_INCOMPLETE");
});
test("P84 operator evidence cannot claim live deployment",()=>{
 assert.equal(check(m,e,{...o,deployPerformed:true}).state,"INVALID_OR_INCOMPLETE");
});
test("P84 unverified P83 evidence must not be forged complete",()=>{
 const changed=structuredClone(e);changed.checks.rollbackRestoreDrillPassed="VERIFIED";
 assert.equal(check(m,changed).state,"INVALID_OR_INCOMPLETE");
});
