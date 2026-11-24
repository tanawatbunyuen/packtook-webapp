"use strict";
// P186: explicit operator boundary. No cloud APIs, no writes, pure validation.
// Live read-only inventory requires a separately authorized human operator.
const PROJECTS=new Set(["packtook-staging","packtook-prod-01","demo-packtook-p186"]);
function validateGate({project,ack,env={}}={}){
 const fail=reason=>({allowed:false,reason});
 if(!PROJECTS.has(project))return fail("PROJECT_NOT_ALLOWLISTED");
 if(ack!=="I_AUTHORIZE_READ_ONLY_G02_INVENTORY")return fail("EXPLICIT_READ_ACK_MISSING");
 const emu=(project==="demo-packtook-p186");
 if(!emu&&(env.CI==="true"||env.GITHUB_ACTIONS==="true"))return fail("CI_CLOUD_ACCESS_REFUSED");
 const auth=env.FIREBASE_AUTH_EMULATOR_HOST,store=env.FIRESTORE_EMULATOR_HOST;
 if(emu){
  if(auth!=="127.0.0.1:19096"||store!=="127.0.0.1:18096")return fail("DEMO_LOCALHOST_GUARD");
 }else{
  if(auth||store)return fail("LIVE_PROJECT_WITH_EMULATOR_ENV_REFUSED");
  if(env.PACKTOOK_G02_OPERATOR_APPROVED_PROJECT!==project||
     env.PACKTOOK_G02_OPERATOR_CHANGE_TICKET?.match(/^G02-[A-Z0-9-]{8,60}$/)==null)
   return fail("INDEPENDENT_OPERATOR_APPROVAL_NOT_RECORDED");
 }
 return {allowed:true,mode:emu?"DEMO_LOCALHOST":"AUTHORIZED_OPERATOR_READ_ONLY",project};
}
module.exports={validateGate};
