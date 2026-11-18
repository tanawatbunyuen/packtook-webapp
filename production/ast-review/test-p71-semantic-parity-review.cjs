"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {assess}=require("./p71-semantic-parity-review.cjs");
const root=path.join(__dirname,"..");
const p=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const c=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/credit-handlers.cjs"),"utf8");
const r=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/index.js"),"utf8");
test("P71 source audit catches material behavior differences and remains NO_GO",()=>{
 const a=assess(p,c,r);
 assert.equal(a.release,"NO_GO_RELEASE");
 assert.equal(a.parityStatus,"REVIEW_REQUIRED");
 assert.equal(a.backendAppCheck,"NOT_PROVEN");
 for(const id of ["AUTO_PROVISION_EQUIVALENCE","SUBSCRIPTION_STATE_PARITY","USAGE_RESPONSE_SCHEMA",
 "REVIEWED_STAGING_APP_CHECK_PROOF","EXACT_HANDLER_SOURCE_PARITY"])
  assert.equal(a.checks.find(x=>x.id===id)?.verdict,"REVIEW_REQUIRED",id);
});
test("linked duplicate requests update restored in P71 candidate",()=>{
 const x=assess(p,c,r).checks.find(y=>y.id==="DUPLICATE_REQUEST_LINKAGE");
 assert.equal(x.verdict,"STATIC_MATCH_CANDIDATE");
});
test("audit detects absent duplicate-request linkage in a mutant",()=>{
 const mutant=c.replace(/tx\.update\(acc\.collection\("duplicateRequests"\)[\s\S]*?\{status:"consumed",consumedBy:op\}\);/,"void 0;");
 assert.equal(assess(p,mutant,r).checks.find(x=>x.id==="DUPLICATE_REQUEST_LINKAGE").verdict,
 "REVIEW_REQUIRED");
});
