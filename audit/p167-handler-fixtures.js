#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const a=require("./p167-owner-handler-mock.js");
const source=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
const {suffix}=a.extract(source);
assert(suffix.includes("exports.ownerAnalyticsSummary=onCall"));
assert(suffix.includes("exports.ownerAnalyticsCustomers=onCall"));
console.log("P167_BOTH_COMPLETE_HANDLERS_EXTRACTED=PASS");
assert.throws(()=>a.extract(source+" "),/source_drift/);
console.log("P167_REJECT_SOURCE_DRIFT=PASS");
const lab=a.sandboxFor(source);
assert.equal(typeof lab.handlers.ownerAnalyticsSummary,"function");
assert.equal(typeof lab.handlers.ownerAnalyticsCustomers,"function");
assert.deepEqual(lab.counters(),{databaseOperations:0,authDirectoryOperations:0});
console.log("P167_NO_PRIVILEGED_READ_ON_LOAD=PASS");
(async()=>{
  let failed=false;
  try{await lab.handlers.ownerAnalyticsCustomers({auth:{
    uid:"demo",token:{email_verified:true}},data:{accountId:"any"}});}
  catch(e){failed=e.code==="permission-denied";}
  assert(failed);
  assert.equal(lab.counters().databaseOperations,0);
  console.log("P167_FORGED_REQUEST_NO_DB_READ=PASS");
  console.log("P167_OFFLINE_FIXTURES=4/4_PASS");
})().catch(()=>{process.exitCode=1;});
