"use strict";
const assert=require("node:assert/strict");
const domain=require("../../functions/operator-domain-v1.cjs");
const {createOperatorCallables}=require("../../functions/operator-callables-v1.cjs");
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const db={collection:()=>{throw Error("DB_ACCESS_UNEXPECTED")}};
const options={enforceAppCheck:true};
assert.throws(()=>createOperatorCallables({db,FieldValue:{},HttpsError,onCall:(_o,fn)=>fn,options:{}}),/enforceAppCheck/);
const c=createOperatorCallables({db,FieldValue:{serverTimestamp:()=>null},HttpsError,onCall:(_o,fn)=>fn,options});
const expected=["inviteOperator","acceptOperatorInvite","listOperators","requestDuplicate",
 "myDuplicateRequests","listDuplicateRequests","approveDuplicateRequest","operatorApprovalStatus"].sort();
assert.deepEqual(Object.keys(c).sort(),expected);
(async()=>{
 for(const name of expected){
  await assert.rejects(c[name]({auth:null,data:{}}),err=>err instanceof HttpsError&&err.code==="unauthenticated",name+" must require Auth");
  await assert.rejects(c[name]({auth:{uid:"fake-id",token:{email_verified:false,email:"a@example.com"}},data:{}}),
   err=>err instanceof HttpsError&&err.code==="permission-denied",name+" must require verified email");
 }
 console.log("PACKTOOK_OPERATOR_CALLABLE_EXPORTS=8/8");
 console.log("PACKTOOK_OPERATOR_AUTH_NEGATIVES=16/16_PASS");
 console.log("PACKTOOK_OPERATOR_DOMAIN_VALIDATORS=SEPARATE_UNIT_TEST");
 console.log("PACKTOOK_OPERATOR_MODULE_WIRED_TO_INDEX=NO");
 console.log("PACKTOOK_MULTIUSER_CREDIT_ROUTING=NOT_IMPLEMENTED");
 console.log("PACKTOOK_REAL_FIREBASE_CALLS=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
})().catch(e=>{console.error("PACKTOOK_OPERATOR_TEST_FAIL="+e.message);process.exitCode=2});
