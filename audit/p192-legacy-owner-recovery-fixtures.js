"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"../production/app/app.js"),"utf8");
const html=fs.readFileSync(path.resolve(__dirname,"../production/app/index.html"),"utf8");
const extract=name=>{
 const m=source.match(new RegExp("^function "+name+"\\([^\\n]*$", "m"));
 if(!m)throw Error("P192_MISSING_HELPER_"+name);
 return vm.runInNewContext("("+m[0]+")");
};
const duplicateOwnerReviewError=extract("duplicateOwnerReviewError");
const ownerRecoveryStatus=extract("ownerRecoveryStatus");
let n=0;function test(label,fn){fn();n++;console.log("P192_"+label+"=PASS");}
test("OWNER_DENIAL_RETURNS_PERMISSION_ERROR",()=>{
 const e=duplicateOwnerReviewError("owner_review");assert.equal(e.code,"functions/permission-denied");assert(e.message.includes("ติดต่อผู้ดูแล"));
});
test("TEMPORARY_AUTH_FAILURE_DOES_NOT_DISABLE_DUPLICATE_FLOW",()=>assert.equal(duplicateOwnerReviewError("temporary"),null));
test("UNRESOLVED_ROLE_IS_SERVER_AUTHORIZED",()=>assert.equal(duplicateOwnerReviewError(null),null));
test("OWNER_HELP_NO_PASSWORD_REQUEST",()=>{
 const s=ownerRecoveryStatus("owner_review");assert(s.includes("ไม่ต้องส่งรหัสผ่าน"));assert(s.includes("ไม่ต้องสมัครบัญชีใหม่"));assert(!s.includes("ทำรายการยืนยันเอง"));
});
test("TEMPORARY_ROLE_RETRY_GUIDANCE",()=>assert(ownerRecoveryStatus("temporary").includes("ตรวจสอบอีกครั้ง")));
test("NORMAL_ROLE_HIDES_RECOVERY",()=>assert.equal(ownerRecoveryStatus(null),""));
test("RECOVERY_GUIDANCE_ACCESSIBLE",()=>{
 assert(html.includes('id="ownerRecoveryHint" role="status" aria-live="polite" hidden'));
 assert(html.includes('id="ownerRoleRetry" class="secondary" hidden'));
});
test("RECOVERY_ROLE_STATE_RESET_ON_USER_CHANGE",()=>{
 assert(source.includes("remoteUser=u;accountRoleInfo=null;accountRoleIssue=null;"));
 assert(source.includes("roleLabel.textContent=u?'กำลังตรวจสอบสิทธิ์...':'—';showOwnerRecovery();"));
});
test("RETRY_ONLY_ON_TRANSIENT_ERROR",()=>{
 assert(source.includes("retry.hidden=accountRoleIssue!=='temporary'"));
 assert(source.includes("void refreshOwnerRole(remoteUser)"));
});
test("RETRY_CANNOT_APPLY_OLD_USER_ROLE",()=>{
 assert(source.includes("if(remoteUser?.uid!==user.uid)return;accountRoleInfo=info;"));
 assert(source.includes("if(remoteUser?.uid!==user.uid)return;accountRoleInfo=null;"));
});
test("DUPLICATE_DENIAL_CHECK_BEFORE_CONFIRMATION",()=>{
 const ix=source.indexOf("const duplicate=err.code==='functions/already-exists'");
 assert(ix>=0);
 const snippet=source.slice(ix,ix+1350);
 const guard=snippet.indexOf("const ownerBlocked=duplicateOwnerReviewError(accountRoleIssue)");
 const confirm=snippet.indexOf("if(!confirm(");
 assert(guard>=0&&confirm>guard);
});
test("EXISTING_CREDIT_RESERVATION_AND_APPROVAL_UNCHANGED",()=>{
 assert(source.includes("setPendingOperation(op,barcode,'reserving',filename)"));
 assert(source.includes("const approval=await credit().authorizeDuplicate(barcode,reason.trim());"));
 assert(source.includes("granted=await credit().reserve(barcode,op,approval.approvalId);"));
});
test("SERVER_DETERMINISTIC_DENIAL_CLEARS_PENDING",()=>{
 assert(source.includes("if(denied.includes(e.code))clearPending();"));
 assert(source.includes("'functions/permission-denied'"));
});
test("UNCERTAIN_RESERVATION_RECOVERY_UNCHANGED",()=>{
 assert(source.includes("const check=await credit().recordingStatus(attemptedOperationId)"));
 assert(source.includes("if(check.status==='reserved')recordingOp=attemptedOperationId"));
});
test("DONT_AUTOGRANT_OWNER",()=>{
 assert(!source.includes("accountRoleInfo={role:'admin'"));
 assert(!source.includes("ownerUid:remoteUser.uid"));
});
test("JS_PARSE_AND_APP_ISOLATION",()=>new vm.Script(source,{filename:"production/app/app.js"}));
console.log("P192_G02_LEGACY_OWNER_RECOVERY="+n+"/"+n+"_PASS");
console.log("P192_ACTUAL_BROWSER_E2E=NOT_TESTED");
console.log("P192_PRODUCTION_WRITES=0 DEPLOY=0 MIGRATION=0");
console.log("P192_G02=NO_GO_EXTERNAL_EVIDENCE_REQUIRED");
