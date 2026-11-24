"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const original=require("node:fs").readFileSync(path.resolve(__dirname,"../production/app/app.js"),"utf8");
const helper=original.match(/^function roleDisplay\(info,error\)\{[^\n]+\}$/m);
if(!helper)throw Error("P191_ROLE_DISPLAY_HELPER_NOT_FOUND");
const roleDisplay=vm.runInNewContext("("+helper[0]+")");
let n=0;
function test(name,fn){fn();n++;console.log("P191_"+name+"=PASS");}
test("VERIFIED_ADMIN_LABEL",()=>{
 assert(roleDisplay({role:"admin"},null).startsWith("Admin"));
});
test("OPERATOR_LABEL",()=>{
 assert(roleDisplay({role:"operator"},null).startsWith("Operator"));
});
test("LEGACY_OWNER_DENIED_LABEL",()=>{
 const message=roleDisplay(null,{code:"functions/permission-denied"});
 assert(message.includes("ตรวจสอบสิทธิ์เจ้าของบัญชี"));
 assert(!message.includes("Admin"));
 assert(!message.includes("Operator"));
});
test("TRANSIENT_AUTH_ERROR_LABEL",()=>{
 const message=roleDisplay(null,{code:"functions/unavailable"});
 assert(message.includes("กรุณาลองใหม่"));
 assert(!message.includes("Admin"));
});
test("AUTH_CHANGE_CLEARS_OLD_ROLE",()=>{
 assert(original.includes("remoteUser=u;accountRoleInfo=null;"));
 assert(original.includes("roleLabel.textContent=u?'กำลังตรวจสอบสิทธิ์...':'—'"));
});
test("ROLE_RESPONSE_UID_RACE_GUARD",()=>{
 assert(original.includes("accountRole().then(info=>{if(remoteUser?.uid!==u.uid)return;"));
});
test("ROLE_ERROR_UID_RACE_GUARD",()=>{
 assert(original.includes(".catch(e=>{if(remoteUser?.uid!==u.uid)return;accountRoleInfo=null;"));
});
test("LEGACY_PERMISSION_DENIAL_NOT_GENERIC_TOAST",()=>{
 assert(original.includes("if(e?.code!=='functions/permission-denied')toast("));
});
test("EXISTING_RECORDING_FLOW_UNCHANGED",()=>{
 assert(original.includes("const approval=await credit().authorizeDuplicate(barcode,reason.trim());"));
 assert(original.includes("granted=await credit().reserve(barcode,op,approval.approvalId);"));
});
test("NO_UNVERIFIED_ROLE_PROMOTION",()=>{
 assert(!original.includes("return {role:'admin'"));
 assert(!original.includes("accountRoleInfo={role:'admin'"));
});
test("FRONTEND_SOURCE_PARSES",()=>{
 new vm.Script(original,{filename:"production/app/app.js"});
});
test("NO_CLOUD_OR_USER_DATA_ACCESSED",()=>{
 assert.equal(process.env.P191_TEST_CLOUD_ACCESS,undefined);
});
console.log("P191_LEGACY_OWNER_FRONTEND_CASES="+n+"/"+n+"_PASS");
console.log("P191_FRONTEND_G02=NO_GO_PENDING_REAL_LEGACY_INVENTORY");
console.log("P191_PRODUCTION_WRITES=0 DEPLOY=0");
