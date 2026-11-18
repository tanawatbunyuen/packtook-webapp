"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {audit,EXPECTED,ALL}=require("./p85-repository-codebase-ownership.cjs");
const root=path.resolve(__dirname,"..");
const c=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
const s=Object.fromEntries(EXPECTED.map(x=>[x.source,fs.readFileSync(path.join(root,x.source,"index.js"),"utf8")]));
const check=(config=c,sources=s)=>audit(config,sources);
test("P85 checked-out repo maps all five original callables to beta codebase",()=>{
 const r=check();
 assert.equal(r.state,"CHECKED_OUT_REPOSITORY_OWNERSHIP_VERIFIED_ONLY");
 assert.equal(r.inspectedExports,5);
 assert.equal(r.repositoryCodebaseForTargets,"beta");
 assert.equal(r.sharedCodebaseAcrossStatusAndCredit,true);
 assert.equal(r.safeFirebaseCliSelector,"NOT_VERIFIED");
 assert.equal(r.deploy,"BLOCKED");
});
test("P85 repository codebase not proof of live deployed codebase",()=>{
 const r=check();
 assert.equal(r.exactDeployedCodebaseOwnership,"NOT_VERIFIED");
 assert.equal(r.codebaseVsSourcePinInterpretation,"NOT_EQUIVALENT");
 assert.equal(r.release,"NO_GO_RELEASE");
});
test("P85 reject accidental function source change",()=>{
 const modified=structuredClone(c);modified.functions[0].source="production";
 assert.equal(check(modified).state,"REVIEW_BLOCKED");
});
test("P85 reject missing status export",()=>{
 const changed={...s,functions:s.functions.replace(/exports\.recordingStatus\s*=/,"exports.otherStatus=")};
 assert.equal(check(c,changed).state,"REVIEW_BLOCKED");
});
test("P85 reject duplicate status export",()=>{
 const changed={...s,functions:s.functions+"\nexports.usageStatus=()=>null;"};
 assert.equal(check(c,changed).state,"REVIEW_BLOCKED");
});
test("P85 reject credit export moving across codebases",()=>{
 const changed={...s,functions:s.functions.replace(/exports\.reserveCredit\s*=/,"exports.otherCredit="),
   "owner-functions":s["owner-functions"]+"\nexports.reserveCredit=()=>null;"};
 assert.equal(check(c,changed).state,"REVIEW_BLOCKED");
});
test("P85 reject missing functions codebase",()=>{
 const changed=structuredClone(c);changed.functions.pop();
 assert.equal(check(changed).state,"REVIEW_BLOCKED");
});
test("P85 reject unknown extra source file",()=>{
 assert.equal(check(c,{...s,malicious:"exports.usageStatus=1;"}).state,"REVIEW_BLOCKED");
});
test("P85 forbid production release based on source ownership",()=>{
 const r=check();assert.equal(r.deployedGuardDrift,"UNREMEDIATED");
 assert.equal(r.rollbackRestorable,"NOT_VERIFIED");
 assert.equal(r.backendAppCheck,"NOT_PROVEN");
});
