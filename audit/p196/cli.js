"use strict";
const {observe}=require("./operator-readonly-runtime");
try{
 // Two literal required arguments; no arbitrary function, project or CLI option accepted.
 const options=process.argv.slice(2);
 if(options.length!==2||options[0]!=="--project=packtook-staging"||
    options[1]!=="--read-only")
  throw Error("P196_STRICT_CLI_USAGE");
 const env=process.env;
 const result=observe({env,project:"packtook-staging",
   ack:env.PACKTOOK_G02_P196_READ_ONLY_ACK,
   ticket:env.PACKTOOK_G02_OPERATOR_CHANGE_TICKET});
 // Do not expose revision, URL, user, headers, account IDs or provider response.
 console.log("P196_STAGING_RUNTIME_CLASSIFICATION="+JSON.stringify(result));
 console.log("P196_NO_GO_RELEASE=TRUE");
}catch(e){
 const known=[
 "P196_STRICT_CLI_USAGE","P196_STAGING_ONLY","P196_READ_ONLY_ACK_MISSING",
 "P196_CI_REAL_CLOUD_BLOCKED","P196_MIXED_EMULATOR_BLOCKED",
 "P196_INDEPENDENT_OPERATOR_APPROVAL_RECORD_MISSING","P196_WRONG_CLOUD_CONTEXT",
 "P196_INVALID_PROVIDER_RECORD","P196_PROVIDER_PROJECT_OR_FUNCTION_MISMATCH",
 "P196_UNEXPECTED_RESPONSE_SIZE","P196_UNPARSABLE_PROVIDER_RESPONSE"
 ];
 console.error("P196_BLOCK="+(known.includes(e.message)?e.message:"P196_OPERATOR_OR_PROVIDER_FAILURE_REDACTED"));
 process.exitCode=1;
}
