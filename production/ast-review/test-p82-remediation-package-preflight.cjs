"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {FILES,validate}=require("./p82-remediation-package-preflight.cjs");
const root=path.resolve(__dirname,"../..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"production/staging-candidates/p82-remediation-package.json"),"utf8"));
const source=Object.fromEntries(FILES.map(f=>[f,fs.readFileSync(path.join(root,f),"utf8")]));
const run=(m=manifest,s=source)=>validate(m,s);
const mutate=(group,key,value)=>({...manifest,[group]:{...manifest[group],[key]:value}});
test("P82 exact two callable source package validates as blocked review candidate",()=>{
 const r=run();
 assert.equal(r.state,"PACKAGE_REVIEW_CANDIDATE_VALIDATED");
 assert.equal(r.deployment,"BLOCKED");
 assert.equal(r.stagedRemediation,"NOT_DEPLOYED");
 assert.equal(r.p80DeployedGuardDrift,"CONFIRMED_UNREMEDIATED");
 assert.match(r.sourceBundleDigestSha256,/^[a-f0-9]{64}$/);
});
test("P82 artifact deterministic local digest",()=>{
 assert.equal(run().sourceBundleDigestSha256,run().sourceBundleDigestSha256);
});
test("P82 forbids changing target project or region",()=>{
 assert.equal(run({...manifest,project:"packtook-prod-01"}).state,"PACKAGE_INVALID");
 assert.equal(run({...manifest,region:"us-central1"}).state,"PACKAGE_INVALID");
});
test("P82 forbids enabling cloud deploy or registering replacements",()=>{
 assert.equal(run({...manifest,deployAllowed:true}).state,"PACKAGE_INVALID");
 assert.equal(run(mutate("scope","replacementRegistered",true)).state,"PACKAGE_INVALID");
});
test("P82 blocks changing reserve/finalize/recover endpoints",()=>{
 assert.equal(run(mutate("scope","creditCallableNamesUnaffected",["reserveCredit"])).state,"PACKAGE_INVALID");
});
test("P82 rejects forged owner approvals",()=>{
 assert.equal(run(mutate("approvals","ownerDeploymentApproval","GRANTED")).state,"PACKAGE_INVALID");
});
test("P82 rejects pretending deployed App Check verified",()=>{
 assert.equal(run(mutate("runtimeEvidence","deployedAppCheck","VERIFIED")).state,"PACKAGE_INVALID");
});
test("P82 rejects invented known-good rollback revision",()=>{
 assert.equal(run(mutate("runtimeEvidence","rollbackImmutableRevision","APPROVED")).state,"PACKAGE_INVALID");
});
test("P82 rejects changed source package path",()=>{
 assert.equal(run(mutate("candidate","entrypoint","production/functions/index.js")).state,"PACKAGE_INVALID");
});
test("P82 detects missing live Auth validation in source",()=>{
 const changed={...source,[FILES[2]]:source[FILES[2]].replace("readLiveUser(req.auth.uid)","null")};
 assert.equal(run(manifest,changed).reason,"GUARD_STATIC_REQUIREMENTS_NOT_MET");
});
test("P82 detects missing App Check option",()=>{
 const changed={...source,[FILES[0]]:source[FILES[0]].replace("enforceAppCheck:true","enforceAppCheck:false")};
 assert.equal(run(manifest,changed).reason,"GUARD_STATIC_REQUIREMENTS_NOT_MET");
});
test("P82 detects removal of status protection",()=>{
 const changed={...source,[FILES[1]]:source[FILES[1]].replace("const usageStatus=protect(","const usageStatus=async(")};
 assert.equal(run(manifest,changed).reason,"GUARD_STATIC_REQUIREMENTS_NOT_MET");
});
test("P82 forbids direct legacy export registration by candidate",()=>{
 const changed={...source,[FILES[0]]:source[FILES[0]]+"\nexports.recordingStatus=1;"};
 assert.equal(run(manifest,changed).reason,"GUARD_STATIC_REQUIREMENTS_NOT_MET");
});
test("P82 missing supporting file blocks preflight",()=>{
 const changed={...source};delete changed[FILES[3]];
 assert.equal(run(manifest,changed).state,"PACKAGE_INVALID");
});
test("P82 forbidden-action list is immutable",()=>{
 assert.equal(run({...manifest,actionsForbidden:[]}).state,"PACKAGE_INVALID");
});
test("P82 release cannot be silently promoted",()=>{
 assert.equal(run({...manifest,release:"GO_RELEASE"}).state,"PACKAGE_INVALID");
});
