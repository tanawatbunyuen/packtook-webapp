// V7.0 — offline QA env safety regression (no Firebase/Cloud access)
import assert from "node:assert/strict";
import fs from "node:fs";
import {checkQaEnvironment} from "./check-v70-qa-preflight.mjs";
const now=Date.now();
const publicOff=[
 "PACKTOOK_PRODUCTION_PROJECT_ID=packtook-prod-01",
 "PACKTOOK_PUBLIC_SIGNUP_ENABLED=false",
 "PACKTOOK_PUBLIC_ACCESS_ENABLED=false",
 "PACKTOOK_PUBLIC_POLICIES_APPROVED=false"
].join("\n")+"\n";
const qaUid="qa_v70_authorized_uid_01234567890";
const appId="1:123456789:web:abcdef123456789";
const expires=new Date(now+5*60*60*1000).toISOString();
const env=publicOff+[
 "PACKTOOK_V7_QA_ENABLED=true",
 "PACKTOOK_V7_QA_UID="+qaUid,
 "PACKTOOK_V7_QA_APP_ID="+appId,
 "PACKTOOK_V7_QA_EXPIRES_AT="+expires
].join("\n")+"\n";
const okay=checkQaEnvironment({specific:env,mode:"--approved-qa",now});
assert.equal(okay.pass,true);
assert.equal(okay.publicFlagsOff,true);
assert.equal(okay.qaEnabled,true);
assert.equal(okay.qaUidConfigured,true);
assert(!JSON.stringify(okay).includes(qaUid));
assert(!JSON.stringify(okay).includes(appId));
console.log("PASS: short-lived single UID + Production App Check app and all Public flags OFF");

const testOff=checkQaEnvironment({specific:publicOff+"PACKTOOK_V7_QA_ENABLED=false",mode:"--qa-off"});
assert.equal(testOff.qaEnabled,false);
assert.equal(testOff.pass,true);
console.log("PASS: disabled deploy does not require an invited UID");

const rejects=(label,specific=env,generic="",mode="--approved-qa",environment={})=>{
 assert.throws(()=>checkQaEnvironment({specific,generic,mode,environment,now}),/SAFETY BLOCK|must/i);
 console.log("PASS: "+label+" rejected");
};
rejects("no approval flags",publicOff);
rejects("QA ON during disabled deploy",env,"","--qa-off");
rejects("public signup enabled",env.replace("PACKTOOK_PUBLIC_SIGNUP_ENABLED=false","PACKTOOK_PUBLIC_SIGNUP_ENABLED=true"));
rejects("public access enabled",env.replace("PACKTOOK_PUBLIC_ACCESS_ENABLED=false","PACKTOOK_PUBLIC_ACCESS_ENABLED=true"));
rejects("policy approval enabled",env.replace("PACKTOOK_PUBLIC_POLICIES_APPROVED=false","PACKTOOK_PUBLIC_POLICIES_APPROVED=true"));
rejects("incorrect project",env.replace("packtook-prod-01","packtook-staging"));
rejects("multiple UID list",env.replace(qaUid,qaUid+","+qaUid));
rejects("wrong App Check App ID",env.replace(appId,"1:777:web: invalid"));
rejects("expired lease",env.replace(expires,new Date(now-60000).toISOString()));
rejects("lease too long",env.replace(expires,new Date(now+50*60*60*1000).toISOString()));
rejects("generic env QA override",env,"PACKTOOK_V7_QA_ENABLED=true");
rejects("shell QA override",env,"","--approved-qa",{PACKTOOK_V7_QA_ENABLED:"false"});
rejects("non UTC timestamp",env.replace(expires,new Date(now+5*60*60*1000).toISOString().replace("Z","+00:00")));
rejects("duplicate QA enabled",env+"PACKTOOK_V7_QA_ENABLED=true\n");
console.log("RESULT: V7.0 invitation-only Production rollout env preflight SAFETY PASS.");
