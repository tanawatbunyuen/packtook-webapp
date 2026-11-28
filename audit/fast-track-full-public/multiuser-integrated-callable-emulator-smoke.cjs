"use strict";
/**
 * LOCAL Firebase Emulator callable negative-auth smoke.
 * - Never accesses a real project.
 * - No writes.
 * - Verifies function wrapper exposure and reject behavior with missing auth
 *   and missing App Check. Does not certify valid App Check E2E.
 */
const assert=require("node:assert/strict");
const project="demo-packtook-integrated-01";
const host=process.env.FIREBASE_EMULATOR_HUB||"";
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST||"";
const firestoreHost=process.env.FIRESTORE_EMULATOR_HOST||"";
const cloudProject=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT||"";
if(cloudProject!==project||
 !/^(127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(host)||
 !/^(127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(authHost)||
 !/^(127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(firestoreHost)){
 console.error("PACKTOOK_LOCAL_EMULATOR_FAIL_CLOSED=INVALID_DEMO_ENV");
 process.exit(2);
}
const base="http://127.0.0.1:5001/"+project+"/asia-southeast1/";
const endpoints=["usageStatus","recordingStatus","accountRole","reserveCredit","finalizeCredit",
 "inviteOperator","acceptOperatorInvite","listOperators","requestDuplicate",
 "myDuplicateRequests","listDuplicateRequests","approveDuplicateRequest","operatorApprovalStatus",
 "subscriptionOverview"];
async function invoke(endpoint){
 const url=base+endpoint;
 const r=await fetch(url,{method:"POST",
  headers:{"content-type":"application/json"},body:JSON.stringify({data:{}}),
  signal:AbortSignal.timeout(12000)});
 const t=await r.text();
 return {status:r.status,text:t.slice(0,350)};
}
async function run(){
 let rejects=0;
 for(const name of endpoints){
  const r=await invoke(name);
  assert.ok([400,401,403].includes(r.status),
   name+" unexpected HTTP "+r.status+" response "+r.text);
  rejects++;
  console.log("CALLABLE_NEGATIVE "+name+" HTTP="+r.status);
 }
 console.log("PACKTOOK_CALLABLE_EMULATOR_NO_AUTH_REJECTIONS="+rejects+"/"+endpoints.length+"_PASS");
 console.log("PACKTOOK_EMULATOR_APPCHECK_VALID_TOKEN=NOT_TESTED");
 console.log("PACKTOOK_EMULATOR_AUTHORIZED_OWNER_OPERATOR=NOT_TESTED");
 console.log("PACKTOOK_CLOUD_WRITES=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}
run().catch(e=>{console.error("PACKTOOK_CALLABLE_EMULATOR_SMOKE_FAIL="+e.stack);process.exitCode=2});
