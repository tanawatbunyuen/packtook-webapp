"use strict";
// P111 source-only regression. Run: node audit/p111-status-appcheck-candidate.test.cjs
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const src=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
const checks=[];
function check(name,fn){try{fn();checks.push([name,true])}catch(e){checks.push([name,false]);console.error("FAIL_DETAIL",name,e.message)}}
const opt=src.match(/const\s+options\s*=\s*(\{[^;]+\})\s*;/);
const guarded=src.match(/const\s+statusOptions\s*=\s*(\{[^;]+\})\s*;/);
const uid=src.match(/function\s+uid\s*\(req\)\s*\{([^}]+)\}/);
check("LEGACY_OPTIONS_PRESENT",()=>assert.ok(opt));
check("LEGACY_OPTIONS_UNCHANGED",()=>assert.match(opt?.[1]||"",/^\{region,maxInstances:20,timeoutSeconds:30\}$/));
check("STATUS_OPTIONS_APP_CHECK_ENABLED",()=>assert.match(guarded?.[1]||"",/^\{\.\.\.options,enforceAppCheck:true\}$/));
check("UID_REQUIRES_AUTH",()=>assert.match(uid?.[1]||"",/if\(!req\.auth\)/));
check("UID_REQUIRES_EMAIL_VERIFIED",()=>assert.match(uid?.[1]||"",/req\.auth\.token\.email_verified!==true/));
check("UID_FROM_AUTH_CONTEXT",()=>assert.match(uid?.[1]||"",/return req\.auth\.uid/));
const expected=["usageStatus","reserveCredit","finalizeCredit","pendingVideoReservations","recoverStaleVideoReservation","recordingStatus","registerDevice","deviceStatus","removeDevice","authorizeDuplicate","accountRole","subscriptionOverview","billingHistory","requestPlanChange","cancelUnpaidPlanRequest","omisePaymentConfig","createOmisePayment","recoverOmiseCharge","omisePaymentStatus","paymentAudit","ownerAnalyticsSummary","ownerAnalyticsCustomers"];
const calls=[...src.matchAll(/exports\.([\w]+)\s*=\s*onCall\((statusOptions|options|paymentSecrets|ownerOptions|\{region)/g)];
check("CALLABLE_INVENTORY_UNCHANGED",()=>assert.deepEqual(calls.map(m=>m[1]),expected));
for(const name of ["usageStatus","recordingStatus"]){
  const m=src.match(new RegExp("exports\\."+name+"\\s*=\\s*onCall\\(([^,]+),async req=>\\{([\\s\\S]*?)\\n\\}\\);"));
  check(name+"_GUARDED_OPTIONS",()=>assert.equal(m?.[1],"statusOptions"));
  check(name+"_USES_VERIFIED_UID",()=>assert.match(m?.[2]||"",/\buid\(req\)/));
  check(name+"_NOT_CLIENT_ACCOUNT_SELECTOR",()=>assert.doesNotMatch(m?.[2]||"",/\b(accountId|uid)\s*=\s*(?:data\(req\)|req\.data)/));
}
check("OTHER_CALLABLES_DO_NOT_USE_STATUS_OPTIONS",()=>{
 const extra=calls.filter(m=>m[2]==="statusOptions"&&!["recordingStatus","usageStatus"].includes(m[1]));assert.deepEqual(extra,[]);
});
console.log("P111_STATIC_REGRESSION",checks.filter(x=>x[1]).length+"/"+checks.length);
console.log("P111_RESULT",checks.every(x=>x[1])?"PASS_STATIC_ONLY":"FAIL_STATIC");
console.log("P111_STAGING_DEPLOY=NO P111_PRODUCTION_DEPLOY=NO P111_RUNTIME_E2E=NOT_RUN");
if(checks.some(x=>!x[1]))process.exitCode=1;
