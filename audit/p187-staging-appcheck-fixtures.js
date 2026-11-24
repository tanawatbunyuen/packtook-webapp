"use strict";
const assert=require("node:assert/strict");
const {validatedTarget,guard,verify}=require("./p187-staging-appcheck-probe");
const token="synthetic-demo-token-not-real-123456";
const env={PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-staging",
 PACKTOOK_G02_APP_CHECK_READ_ONLY_ACK:"I_AUTHORIZE_STAGING_READ_ONLY_PROBE"};
const ticket="G02-STAGING-APP-CHECK-20261124";
const url="https://asia-southeast1-packtook-staging.cloudfunctions.net/usageStatus";
let n=0;
async function test(label,fn){await fn();n++;console.log("P187_"+label+"=PASS");}
function mock(status){
 return async(_url,options)=>{
  assert.equal(options.method,"POST");assert.equal(options.redirect,"error");
  return {status,ok:status>=200&&status<300};
 };
}
(async()=>{
 await test("STAGING_GUARD_ACCEPTS_OPERATOR",()=>assert.equal(guard({project:"packtook-staging",changeTicket:ticket,env}),true));
 await test("PRODUCTION_DENIED",()=>assert.throws(()=>guard({project:"packtook-prod-01",changeTicket:ticket,env}),/STAGING_ONLY/));
 await test("CI_DENIED",()=>assert.throws(()=>guard({project:"packtook-staging",changeTicket:ticket,env:{...env,CI:"true"}}),/CI_LIVE_REFUSED/));
 await test("NO_TICKET_DENIED",()=>assert.throws(()=>guard({project:"packtook-staging",env}),/APPROVAL_RECORD_MISSING/));
 await test("NO_READ_ACK_DENIED",()=>assert.throws(()=>guard({project:"packtook-staging",changeTicket:ticket,env:{PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-staging"}}),/READ_ONLY_ACK/));
 await test("HTTP_AND_LOCALHOST_BLOCKED",()=>{
  for(const x of ["http://localhost/usageStatus","http://127.0.0.1/usageStatus"])
   assert.throws(()=>validatedTarget(x));
 });
 await test("EXTERNAL_HOST_BLOCKED",()=>assert.throws(()=>validatedTarget("https://evil.example/usageStatus")));
 await test("OTHER_PROJECT_CLOUDFUNCTIONS_HOST_DENIED",()=>assert.throws(()=>validatedTarget("https://asia-southeast1-other-project.cloudfunctions.net/usageStatus")));
 await test("ARBITRARY_RUN_APP_HOST_DENIED",()=>assert.throws(()=>validatedTarget("https://fraudulent-123.a.run.app/usageStatus")));
 await test("REDIRECT_QUERY_BLOCKED",()=>assert.throws(()=>validatedTarget(url+"?token=SECRET")));
 await test("VALID_HOST_ALLOWLISTED",()=>assert.equal(validatedTarget(url),url));
 await test("REAL_TOKEN_REQUIRED",async()=>{await assert.rejects(verify({fetchImpl:mock(200),url,authToken:"bad",appCheckToken:token}),/REQUIRE_REAL/);});
 await test("SECURE_SUCCESS_CLASSIFICATION",async()=>{
  let requests=0;
  const result=await verify({url,authToken:token,appCheckToken:token,
   fetchImpl:async(_u,options)=>{
    const has=Object.hasOwn(options.headers,"X-Firebase-AppCheck");requests++;
    return {status:has?200:401,ok:has};
   }});
  assert.equal(requests,2);assert.equal(result.passed,true);
  assert.equal(result.productionRuntimeAttested,false);
  assert(!JSON.stringify(result).includes(token));
 });
 await test("MISSING_APPCHECK_ACCEPTED_FAILS",async()=>{
  const x=await verify({url,authToken:token,appCheckToken:token,fetchImpl:mock(200)});
  assert.equal(x.passed,false);
 });
 await test("APPCHECK_REJECTED_FAILS",async()=>{
  const x=await verify({url,authToken:token,appCheckToken:token,fetchImpl:mock(401)});
  assert.equal(x.passed,false);
 });
 await test("HTTP_500_FAILS",async()=>{
  const x=await verify({url,authToken:token,appCheckToken:token,fetchImpl:mock(500)});
  assert.equal(x.passed,false);
 });
 console.log("P187_G02_APPCHECK_OFFLINE_FIXTURES="+n+"/"+n+"_PASS");
 console.log("P187_REAL_APPCHECK_STAGING=NOT_ATTESTED");
 console.log("P187_PRODUCTION_WRITES=0 P187_DEPLOY=0 P187_NO_GO_RELEASE=TRUE");
})().catch(e=>{console.error("P187_FIXTURE_FAILED",e.message);process.exitCode=1;});
