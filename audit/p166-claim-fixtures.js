#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const t=require("./p166-owner-claim-negative.js");
const src=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
const exact=t.auditedFragments(src);
assert(exact.uid.includes("email_verified"));
console.log("P166_EXACT_PINNED_SOURCE=PASS");
assert.throws(()=>t.auditedFragments(src+" "),/backend_source_drift/);
console.log("P166_FAIL_CLOSED_SOURCE_DRIFT=PASS");
assert.throws(()=>t.auditedFragments(src.replace(
  "req.auth.token.packtookPlatformOwner!==true",
  "req.auth.token.packtookPlatformOwner===true"
)),/backend_source_drift/);
console.log("P166_FAIL_CLOSED_MUTATED_CLAIM=PASS");
const guard=t.makeGuard(exact);
assert.equal(guard({auth:{uid:"unit-owner",token:{
  email_verified:true,packtookPlatformOwner:true}}}),"unit-owner");
assert.throws(()=>guard({auth:{uid:"unit-user",token:{
  email_verified:true,packtookPlatformOwner:"true"}}}),
  (e)=>e.code==="permission-denied");
console.log("P166_EXTRACTED_MOCK_FUNCTION_BEHAVIOR=PASS");
console.log("P166_OFFLINE_FIXTURES=4/4_PASS");
