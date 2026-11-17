"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {check}=require("./p64-staging-deploy-preflight.cjs");
const source=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
function change(a,b){
 assert.ok(source.includes(a),"fixture missing");
 return source.replace(a,b);
}
test("real production branch is rejected as direct Staging deploy candidate",()=>{
 const r=check(source);
 assert.equal(r.staticGuardCompleteness,"ALL_FIVE_GUARDED");
 assert.equal(r.stagingAuthorization,"PRODUCTION_BOUND_REVIEW_REQUIRED");
 assert.equal(r.stagingDeployment,"BLOCKED_REVIEW_REQUIRED");
 assert.equal(r.candidateReadyForDeployment,false);
 assert.equal(r.productionRelease,"NO_GO_RELEASE");
});
test("recordingStatus direct onCall yields guard gap",()=>{
 const r=check(change("exports.recordingStatus=guardedCall(options,","exports.recordingStatus=onCall(options,"));
 assert.equal(r.callableGuards.recordingStatus,"NOT_GUARDED_STATIC");
 assert.equal(r.staticGuardCompleteness,"GUARD_GAP");
 assert.equal(r.stagingDeployment,"BLOCKED_REVIEW_REQUIRED");
});
test("usageStatus literal-options direct onCall yields guard gap",()=>{
 const r=check(change("exports.usageStatus=guardedCall(options,","exports.usageStatus=onCall({region},"));
 assert.equal(r.callableGuards.usageStatus,"NOT_GUARDED_STATIC");
});
test("credit reservation direct onCall cannot bypass gate",()=>{
 const r=check(change("exports.reserveCredit=guardedCall(options,","exports.reserveCredit=onCall(options,"));
 assert.equal(r.callableGuards.reserveCredit,"NOT_GUARDED_STATIC");
 assert.equal(r.stagingDeployment,"BLOCKED_REVIEW_REQUIRED");
});
test("pilot lease removal is reported",()=>{
 const r=check(change("await requirePilotLease(req,{claimRequired:true});","void 0;"));
 assert.equal(r.pilotLeaseReference,"MISSING");
 assert.equal(r.candidateReadyForDeployment,false);
});
test("Production bound auth flagged even if callable guards pass",()=>{
 const r=check(source);
 assert.equal(r.staticGuardCompleteness,"ALL_FIVE_GUARDED");
 assert.equal(r.stagingAuthorization,"PRODUCTION_BOUND_REVIEW_REQUIRED");
});
test("appcheck never inferred from guarded call",()=>{
 const r=check(source);
 assert.equal(r.appCheck,"NOT_PROVEN");
});
test("broken source rejected",()=>{
 assert.throws(()=>check("function ("),/P64_PARSE_BLOCKED/);
});
