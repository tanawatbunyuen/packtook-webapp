// PACKTOOK V7.0 — offline QA invite preparation safety regression.
// No filesystem writes, Firebase SDK calls or network connections.
import assert from "node:assert/strict";
import {replaceV7QaKeys,readVerifiedAppId,buildApprovedInvitation} from "./configure-v70-qa-invite.mjs";
import {checkQaEnvironment} from "./check-v70-qa-preflight.mjs";
const off=[
 "PACKTOOK_PRODUCTION_PROJECT_ID=packtook-prod-01",
 "PACKTOOK_PUBLIC_SIGNUP_ENABLED=false",
 "PACKTOOK_PUBLIC_ACCESS_ENABLED=false",
 "PACKTOOK_PUBLIC_POLICIES_APPROVED=false",
 "PACKTOOK_V7_QA_ENABLED=false",
 "OTHER_EXISTING_SETTING=preserved"
].join("\n")+"\n";
const appId="1:123456789:web:abcde123";
const uid="qa_test_one_user_0123456789";
const exp=new Date(Date.now()+3*3600000).toISOString();
assert.equal(readVerifiedAppId('export const firebaseConfig = {"projectId":"packtook-prod-01","authDomain":"packtook-prod-01.firebaseapp.com","appId":"'+appId+'"};'),appId);
const prepared=replaceV7QaKeys(off,{
 PACKTOOK_V7_QA_ENABLED:"true",PACKTOOK_V7_QA_UID:uid,
 PACKTOOK_V7_QA_APP_ID:appId,PACKTOOK_V7_QA_EXPIRES_AT:exp
});
assert(prepared.includes("OTHER_EXISTING_SETTING=preserved"));
assert.equal(prepared.match(/PACKTOOK_V7_QA_ENABLED=/g).length,1);
// Exercise the SAME production invitation builder used by the interactive CLI.
// This catches regressions where appId was read inside a branch but referenced
// outside its lexical scope (the former "appId is not defined" failure).
const configSource='export const firebaseConfig = {"projectId":"packtook-prod-01","authDomain":"packtook-prod-01.firebaseapp.com","appId":"'+appId+'"};';
const built=buildApprovedInvitation({
 existing:off,generic:"",environment:{},configSource,uid,now:Date.now()
});
assert.equal(built.result.pass,true);
assert.equal(built.result.qaEnabled,true);
assert.equal(built.result.publicFlagsOff,true);
assert(built.updated.includes("PACKTOOK_V7_QA_APP_ID="+appId));
assert(built.updated.includes("PACKTOOK_V7_QA_UID="+uid));
assert(built.updated.includes("OTHER_EXISTING_SETTING=preserved"));
assert.throws(()=>buildApprovedInvitation({
 existing:off,configSource,uid:"invalid",now:Date.now()
}),/SAFETY BLOCK/);
assert.throws(()=>buildApprovedInvitation({
 existing:off.replace("PACKTOOK_PUBLIC_SIGNUP_ENABLED=false","PACKTOOK_PUBLIC_SIGNUP_ENABLED=true"),
 configSource,uid,now:Date.now()
}),/SAFETY BLOCK/);
assert.throws(()=>buildApprovedInvitation({
 existing:off,configSource:configSource.replace("packtook-prod-01.firebaseapp.com","staging.firebaseapp.com"),
 uid,now:Date.now()
}),/SAFETY BLOCK/);
const check=checkQaEnvironment({specific:prepared,mode:"--approved-qa",expectedAppId:appId});
assert.equal(check.pass,true);assert.equal(check.qaEnabled,true);
assert.equal(check.publicFlagsOff,true);assert(!JSON.stringify(check).includes(uid));
const disabled=replaceV7QaKeys(prepared,{PACKTOOK_V7_QA_ENABLED:"false"});
const offReport=checkQaEnvironment({specific:disabled,mode:"--qa-off"});
assert.equal(offReport.qaEnabled,false);
assert(!disabled.includes(uid)&&!disabled.includes(appId)&&!disabled.includes(exp));
assert(disabled.includes("OTHER_EXISTING_SETTING=preserved"));
assert.throws(()=>replaceV7QaKeys(off+"\nPACKTOOK_V7_QA_ENABLED=true\n",{PACKTOOK_V7_QA_ENABLED:"false"}),/SAFETY BLOCK/);
assert.throws(()=>replaceV7QaKeys(off+"\nPACKTOOK_V7_QA_UNKNOWN=anything\n",{PACKTOOK_V7_QA_ENABLED:"false"}),/SAFETY BLOCK/);
assert.throws(()=>checkQaEnvironment({
 specific:replaceV7QaKeys(off.replace("PACKTOOK_PUBLIC_ACCESS_ENABLED=false","PACKTOOK_PUBLIC_ACCESS_ENABLED=true"),{
 PACKTOOK_V7_QA_ENABLED:"true",PACKTOOK_V7_QA_UID:uid,
 PACKTOOK_V7_QA_APP_ID:appId,PACKTOOK_V7_QA_EXPIRES_AT:exp
 }),mode:"--approved-qa",expectedAppId:appId
}),/SAFETY BLOCK/);
console.log("RESULT: PACKTOOK V7.0 SINGLE-UID INVITE PREPARATION SAFETY PASS (offline only)");
