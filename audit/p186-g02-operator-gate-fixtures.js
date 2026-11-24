"use strict";
const assert=require("node:assert/strict");
const {validateGate}=require("./p186-g02-operator-gate");
const yes="I_AUTHORIZE_READ_ONLY_G02_INVENTORY";
let n=0;function test(label,input,allowed,reason){
 const r=validateGate(input);
 assert.equal(r.allowed,allowed,label);
 if(reason)assert.equal(r.reason,reason,label);
 n++;console.log("P186_"+label+"=PASS");
}
test("REFUSE_UNLISTED_PROJECT",{project:"other-production",ack:yes,env:{}},false,"PROJECT_NOT_ALLOWLISTED");
test("REFUSE_MISSING_ACK",{project:"packtook-staging",env:{}},false,"EXPLICIT_READ_ACK_MISSING");
test("REFUSE_CI_LIVE",{project:"packtook-prod-01",ack:yes,env:{CI:"true"}},false,"CI_CLOUD_ACCESS_REFUSED");
test("REFUSE_GITHUB_ACTIONS",{project:"packtook-staging",ack:yes,env:{GITHUB_ACTIONS:"true"}},false,"CI_CLOUD_ACCESS_REFUSED");
test("REFUSE_LIVE_WITH_AUTH_EMULATOR",{project:"packtook-prod-01",ack:yes,env:{FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099"}},false,"LIVE_PROJECT_WITH_EMULATOR_ENV_REFUSED");
test("REFUSE_LIVE_WITH_STORE_EMULATOR",{project:"packtook-staging",ack:yes,env:{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080"}},false,"LIVE_PROJECT_WITH_EMULATOR_ENV_REFUSED");
test("REFUSE_NO_OPERATOR_TICKET",{project:"packtook-prod-01",ack:yes,env:{PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-prod-01"}},false,"INDEPENDENT_OPERATOR_APPROVAL_NOT_RECORDED");
test("REFUSE_OTHER_PROJECT_APPROVAL",{project:"packtook-prod-01",ack:yes,env:{PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-staging",PACKTOOK_G02_OPERATOR_CHANGE_TICKET:"G02-TICKET-12345"}},false,"INDEPENDENT_OPERATOR_APPROVAL_NOT_RECORDED");
test("APPROVED_STAGING_READ_ONLY",{project:"packtook-staging",ack:yes,env:{PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-staging",PACKTOOK_G02_OPERATOR_CHANGE_TICKET:"G02-TICKET-12345"}},true);
test("APPROVED_PROD_READ_ONLY",{project:"packtook-prod-01",ack:yes,env:{PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-prod-01",PACKTOOK_G02_OPERATOR_CHANGE_TICKET:"G02-TICKET-12345"}},true);
test("REFUSE_DEMO_MISSING_EMULATORS",{project:"demo-packtook-p186",ack:yes,env:{}},false,"DEMO_LOCALHOST_GUARD");
test("DEMO_LOCALHOST_ONLY",{project:"demo-packtook-p186",ack:yes,env:{FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:19096",FIRESTORE_EMULATOR_HOST:"127.0.0.1:18096"}},true);
console.log("P186_OPERATOR_GUARD_FIXTURES="+n+"/"+n+"_PASS");
console.log("P186_CI_LIVE_CLOUD_CALLS=0");
