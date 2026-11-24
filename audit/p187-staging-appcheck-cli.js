"use strict";
// Explicitly human-invoked staging HTTP read-only call, never run in GitHub CI.
// Requires real auth token and valid App Check token via protected process environment.
const {guard,verify}=require("./p187-staging-appcheck-probe");
(async()=>{
 try{
  const env=process.env;
  guard({project:env.PACKTOOK_G02_TARGET_PROJECT,
   changeTicket:env.PACKTOOK_G02_OPERATOR_CHANGE_TICKET,env});
  const result=await verify({fetchImpl:fetch,url:env.PACKTOOK_G02_STAGING_USAGE_STATUS_URL,
   authToken:env.PACKTOOK_G02_STAGING_AUTH_ID_TOKEN,
   appCheckToken:env.PACKTOOK_G02_STAGING_APP_CHECK_TOKEN});
  // Suppress raw URL, credentials, response bodies, UIDs and all headers.
  console.log("P187_APPCHECK_STAGING_CLASSIFICATION="+JSON.stringify(result));
  if(!result.passed)process.exitCode=2;
 }catch(e){
  const allowed=["P187_STAGING_ONLY","P187_CI_LIVE_REFUSED","P187_EMULATOR_ENV_REFUSED",
   "P187_OPERATOR_APPROVAL_RECORD_MISSING","P187_EXPLICIT_READ_ONLY_ACK_MISSING",
   "P187_REQUIRE_REAL_AUTH_AND_APPCHECK_TOKENS","P187_UNAPPROVED_STAGING_ENDPOINT"];
  console.error("P187_BLOCK="+(allowed.includes(e.message)?e.message:"PROBE_FAILED_REDACTED"));
  process.exitCode=1;
 }
})();
