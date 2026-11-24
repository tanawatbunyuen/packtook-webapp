"use strict";
// P187 staging-only App Check proof collector. No payment or DB operations.
// Hostname restricted, GET forbidden, prints classifications only, no tokens or response body.
const {URL}=require("node:url");
function validatedTarget(value){
 const u=new URL(value);
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||
    u.port||u.hostname!=="asia-southeast1-packtook-staging.cloudfunctions.net"||
    u.pathname!=="/usageStatus")
  throw Error("P187_UNAPPROVED_STAGING_ENDPOINT");
 return u.toString();
}
function guard({project,changeTicket,env={}}={}){
 if(project!=="packtook-staging")throw Error("P187_STAGING_ONLY");
 if(env.CI==="true"||env.GITHUB_ACTIONS==="true")throw Error("P187_CI_LIVE_REFUSED");
 if(env.FIRESTORE_EMULATOR_HOST||env.FIREBASE_AUTH_EMULATOR_HOST)throw Error("P187_EMULATOR_ENV_REFUSED");
 if(env.PACKTOOK_G02_OPERATOR_APPROVED_PROJECT!=="packtook-staging"||
    !/^G02-[A-Z0-9-]{8,60}$/.test(changeTicket||""))
  throw Error("P187_OPERATOR_APPROVAL_RECORD_MISSING");
 if(env.PACKTOOK_G02_APP_CHECK_READ_ONLY_ACK!=="I_AUTHORIZE_STAGING_READ_ONLY_PROBE")
  throw Error("P187_EXPLICIT_READ_ONLY_ACK_MISSING");
 return true;
}
async function request(fetchImpl,url,authToken,appCheckToken){
 const resp=await fetchImpl(url,{method:"POST",headers:{
  "Content-Type":"application/json","Authorization":"Bearer "+authToken,
  ...(appCheckToken?{"X-Firebase-AppCheck":appCheckToken}:{})
 },body:JSON.stringify({data:{}}),redirect:"error",signal:AbortSignal.timeout(8000)});
 // Read no response body for unauthorized requests. Never log it or export bearer tokens.
 return {http:resp.status,ok:resp.ok};
}
async function verify({fetchImpl,url,authToken,appCheckToken}={}){
 if(typeof fetchImpl!=="function"||typeof authToken!=="string"||
 authToken.length<20||typeof appCheckToken!=="string"||appCheckToken.length<20)
 throw Error("P187_REQUIRE_REAL_AUTH_AND_APPCHECK_TOKENS");
 const endpoint=validatedTarget(url);
 const without=await request(fetchImpl,endpoint,authToken,null);
 const withToken=await request(fetchImpl,endpoint,authToken,appCheckToken);
 // Never treat 404, 5xx or a 200 with no app check as a secure pass.
 const accepted=withToken.http===200;
 const deniedWithout=[401,403].includes(without.http);
 return {schema:"packtook-p187-appcheck-verification-v1",
 mode:"STAGING_READ_ONLY_PROBE",checks:{
  missingAppCheckDenied:deniedWithout,
  realAppCheckAccepted:accepted
 },http:{missingAppCheck:without.http,withRealAppCheck:withToken.http},
 passed:accepted&&deniedWithout, productionRuntimeAttested:false,
 authorizedToDeploy:false, ownerProvenanceVerified:false,
 releaseDecision:"NO_GO_RELEASE",scope:"G02_APP_CHECK_ONLY"};
}
module.exports={validatedTarget,guard,verify};
