"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {check}=require("./p63-guarded-call-security.cjs");
const fs=require("node:fs"),path=require("node:path");
const real=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
function mutate(before,after){
 assert.ok(real.includes(before),"Test fixture must exist");
 const changed=real.replace(before,after);
 assert.notEqual(changed,real);
 return changed;
}
test("review matches itself ONLY as static security; never releases",()=>{
 const r=check(real,real);
 assert.equal(r.state,"STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY");
 assert.equal(r.backendAppCheck,"NOT_PROVEN");
 assert.equal(r.release,"NO_GO_RELEASE");
 for(const n of ["recordingStatus","usageStatus"]){
  assert.equal(r[n].reviewGuarded,true);assert.equal(r[n].deployedGuarded,true);
 }
});
test("direct-onCall recordingStatus fails static guard attestation",()=>{
 const r=check(real,mutate("exports.recordingStatus=guardedCall(options,","exports.recordingStatus=onCall(options,"));
 assert.equal(r.recordingStatus.deployedGuarded,false);
 assert.equal(r.state,"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED");
});
test("direct-onCall usageStatus fails static guard attestation",()=>{
 const r=check(real,mutate("exports.usageStatus=guardedCall(options,","exports.usageStatus=onCall(options,"));
 assert.equal(r.usageStatus.deployedGuarded,false);
 assert.equal(r.state,"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED");
});
test("changed guardedCall helper fails scoped match",()=>{
 const r=check(real,mutate("await requirePilotLease(req,{claimRequired:true});","void 0;"));
 assert.equal(r.state,"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED");
});
test("changed uid authorization fails scoped match",()=>{
 const r=check(real,mutate("req.auth.token.packtookProductionBeta!==true","req.auth.token.packtookProductionBeta===true"));
 assert.equal(r.state,"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED");
});
test("changed shared options declaration fails scoped match",()=>{
 const r=check(real,mutate("maxInstances:5,timeoutSeconds:30","maxInstances:6,timeoutSeconds:30"));
 assert.equal(r.state,"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED");
});
test("unrelated source comments are not a security clearance",()=>{
 const r=check(real,real+"\n// p63 fixture\n");
 assert.equal(r.state,"STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY");
 assert.equal(r.release,"NO_GO_RELEASE");
});
test("invalid JS fail-closed",()=>{
 assert.throws(()=>check(real,"function ("),/P63_NOT_VERIFIABLE/);
});

test("legacy direct onCall object-literal options classified as DRIFT, not parser exception",()=>{
 const altered=mutate("exports.recordingStatus=guardedCall(options,",
   "exports.recordingStatus=onCall({region,maxInstances:5},");
 const result=check(real,altered);
 assert.equal(result.state,"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED");
 assert.equal(result.recordingStatus.deployedGuarded,false);
 assert.equal(result.recordingStatus.optionsIdentifierMatch,false);
 assert.equal(result.release,"NO_GO_RELEASE");
});
test("legacy direct onCall spread options classified as DRIFT",()=>{
 const altered=mutate("exports.usageStatus=guardedCall(options,",
   "exports.usageStatus=onCall({...options},");
 const result=check(real,altered);
 assert.equal(result.state,"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED");
 assert.equal(result.usageStatus.deployedGuarded,false);
});
test("dynamic callable options classified as DRIFT without bypass",()=>{
 const altered=mutate("exports.recordingStatus=guardedCall(options,",
   "exports.recordingStatus=onCall(resolveOptions(),");
 const result=check(real,altered);
 assert.equal(result.state,"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED");
 assert.equal(result.recordingStatus.deployedGuarded,false);
});
