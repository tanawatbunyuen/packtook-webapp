"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {inspect}=require("./p68-appcheck-preflight.cjs");
const src=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
test("production review module uses five static guards but App Check not proven",()=>{
 const a=inspect(src);
 assert.equal(a.staticGuardedCall,"FIVE_FIVE_STATIC");
 assert.equal(a.reviewOptionsEnforceAppCheckLiteral,"NOT_EXPLICIT_TRUE");
 assert.equal(a.backendAppCheckEnforcement,"NOT_PROVEN");
 assert.equal(a.stagingDeploy,"BLOCKED_REVIEW_REQUIRED");
 assert.equal(a.productionRelease,"NO_GO_RELEASE");
});
test("even explicit literal App Check does NOT prove backend enforcement",()=>{
 const a=inspect(src.replace("const options={region,maxInstances:5,timeoutSeconds:30};",
  "const options={region,maxInstances:5,timeoutSeconds:30,enforceAppCheck:true};"));
 assert.equal(a.reviewOptionsEnforceAppCheckLiteral,"TRUE");
 assert.equal(a.backendAppCheckEnforcement,"NOT_PROVEN");
 assert.equal(a.stagingDeploy,"BLOCKED_REVIEW_REQUIRED");
});
test("unguarded callable detected",()=>{
 const a=inspect(src.replace("exports.usageStatus=guardedCall(options,","exports.usageStatus=onCall(options,"));
 assert.equal(a.staticGuardedCall,"REVIEW_REQUIRED");
});
