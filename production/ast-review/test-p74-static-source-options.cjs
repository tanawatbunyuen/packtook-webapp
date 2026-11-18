"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {compare,read}=require("./p74-static-source-options.cjs");
const root=path.join(__dirname,"..");
const review=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const candidate=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/index.js"),"utf8");
test("P74 review options not explicit, candidate explicitly enables App Check",()=>{
 const a=compare(review,candidate);
 assert.equal(a.reviewAppCheck,"NOT_EXPLICIT");
 assert.equal(a.candidateAppCheck,"EXPLICIT_TRUE");
 assert.equal(a.backendAppCheck,"NOT_PROVEN");
 assert.equal(a.liveIam,"NOT_VERIFIED");assert.equal(a.release,"NO_GO_RELEASE");
});
test("P74 changing explicit true to false is detected",()=>{
 const x=read(candidate.replace("enforceAppCheck:true","enforceAppCheck:false"));
 assert.equal(x.staticAppCheck,"EXPLICIT_FALSE");
});
test("P74 multiple option declarations are refused",()=>{
 assert.throws(()=>read(candidate+"\nconst options={enforceAppCheck:true};"),/OPTIONS_NOT_UNIQUE/);
});
test("P74 source drift cannot be closed by local option setting",()=>{
 const a=compare(review,candidate);assert.equal(a.p63DeployedGuardDrift,"REVIEW_REQUIRED");
 assert.equal(a.stagingDeploy,"BLOCKED");
});
