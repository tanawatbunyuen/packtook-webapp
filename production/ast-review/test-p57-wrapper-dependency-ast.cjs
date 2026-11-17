"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {compare}=require("./p57-wrapper-dependency-ast.cjs");
const fs=require("node:fs"),path=require("node:path");
const real=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
test("real branch source matches itself but cannot clear release",()=>{
 const r=compare(real,real);
 assert.equal(r.state,"EXACT_SCOPED_TOKENS_REVIEW_REQUIRED");
 assert.equal(r.backendEnforcement,"NOT_PROVEN");
 assert.equal(r.release,"NO_GO_RELEASE");
});
test("removal of pilot lease is fail closed",()=>{
 const broken=real.replace("await requirePilotLease(req,{claimRequired:true});","void 0;");
 assert.throws(()=>compare(real,broken),/P57_NOT_VERIFIABLE/);
});
test("removal of validated request membership is fail closed",()=>{
 const broken=real.replace("PILOT_VALIDATED_REQUESTS.add(req);","void 0;");
 assert.throws(()=>compare(real,broken),/P57_NOT_VERIFIABLE/);
});
test("authorization helper drift needs review",()=>{
 const broken=real.replace('req.auth.token.packtookProductionBeta!==true','req.auth.token.packtookProductionBeta===true');
 assert.equal(compare(real,broken).state,"DRIFT_REVIEW_REQUIRED");
});
test("function export bypass is fail closed",()=>{
 const broken=real.replace("exports.recordingStatus=guardedCall(options,","exports.recordingStatus=onCall(options,");
 assert.throws(()=>compare(real,broken),/P57_NOT_VERIFIABLE/);
});
test("shared callable options drift needs review",()=>{
 const broken=real.replace("const options={region,maxInstances:5,timeoutSeconds:30}","const options={region,maxInstances:6,timeoutSeconds:30}");
 assert.equal(compare(real,broken).state,"DRIFT_REVIEW_REQUIRED");
});
test("pilot environment flags drift needs review",()=>{
 const broken=real.replace('const V72_PILOT_ENABLED=process.env.PACKTOOK_V72_PILOT_ENABLED==="true";',
   'const V72_PILOT_ENABLED=process.env.PACKTOOK_V72_PILOT_ENABLED!=="true";');
 assert.equal(compare(real,broken).state,"DRIFT_REVIEW_REQUIRED");
});
test("syntax error blocks",()=>{
 assert.throws(()=>compare(real,real+"\nfunction ("),/P57_NOT_VERIFIABLE/);
});
test("unrelated comment does not cause drift",()=>{
 assert.equal(compare(real,real+"\n// isolated documentation").state,
  "EXACT_SCOPED_TOKENS_REVIEW_REQUIRED");
});
