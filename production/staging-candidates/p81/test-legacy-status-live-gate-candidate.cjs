"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createP81LegacyHandlers}=require("./legacy-status-live-gate-candidate.cjs");
const user="p81DemoStagingUid001",session="s65_1234567890abcdef",
      op="p81_recording000001",appId="1:123:web:abcdef1234";
function f(){
 const calls=[],env={
  GCLOUD_PROJECT:"packtook-staging",GCP_PROJECT:"packtook-staging",
  PACKTOOK_STAGING_PILOT_ENABLED:"true",
  PACKTOOK_STAGING_PUBLIC_SIGNUP_ENABLED:"false",
  PACKTOOK_STAGING_PUBLIC_ACCESS_ENABLED:"false",
  PACKTOOK_STAGING_PILOT_APP_ID:appId
 };
 const now=Date.now();
 let revoked=false,disabled=false;
 const control=()=>({
  enabled:!revoked,ownerApproved:true,legalApproved:true,
  policyVersion:"p65-staging-review-only",sessionId:session,
  startedAt:new Date(now-60000).toISOString(),
  expiresAt:new Date(now+3600000).toISOString(),
  maxInvitedUsers:3,invitedUids:[user]
 });
 const db={
  doc:p=>{calls.push("pilotControl:"+p);return{get:async()=>({exists:true,data:control})}},
  collection:p=>{calls.push("collection:"+p);return{
   doc:id=>{calls.push("account:"+id);return{
    get:async()=>({exists:true,data:()=>({plan:"Free",remaining:5})}),
    collection:p=>{calls.push("recordingCollection:"+p);return{
     doc:id=>{calls.push("operation:"+id);return{
      get:async()=>({exists:true,data:()=>({
       status:"completed",barcode:"P81-DEMO",period:"2026-11",file:null})})
     }}
    }}
   }}
  }}
 };
 const auth={getUser:async uid=>{
  calls.push("liveAuth:"+uid);
  return {uid,email:"test@example.invalid",emailVerified:true,disabled,
   customClaims:{packtookStagingPilot:true,p65Session:session}};
 }};
 const onCall=(opts,cb)=>{calls.push("onCallRegistration");
  assert.equal(opts.enforceAppCheck,true);
  return cb;
 };
 class HttpsError extends Error{constructor(code,msg){super(msg);this.code=code;}}
 const handlers=createP81LegacyHandlers({db,auth,onCall,HttpsError,
  usageResponse:x=>x,env,now:()=>now});
 const req=()=>({auth:{uid:user,token:{email_verified:true,
  packtookStagingPilot:true,p65Session:session}},app:{appId},data:{operationId:op}});
 return {handlers,req,calls,setRevoked:()=>{revoked=true;},
  disable:()=>{disabled=true;}};
}
test("P81 only original legacy names exported behind explicit App Check options",()=>{
 const x=f();assert.deepEqual(Object.keys(x.handlers).sort(),
  ["recordingStatus","usageStatus"]);
});
test("P81 missing App Check context denies before account read",async()=>{
 const x=f(),r=x.req();delete r.app;
 await assert.rejects(x.handlers.usageStatus(r),e=>e.code==="permission-denied");
 assert.equal(x.calls.some(v=>v.startsWith("account:")),false);
});
test("P81 missing Auth denies before account read",async()=>{
 const x=f(),r=x.req();delete r.auth;
 await assert.rejects(x.handlers.recordingStatus(r),e=>e.code==="permission-denied");
 assert.equal(x.calls.some(v=>v.startsWith("account:")),false);
});
test("P81 wrong session denies without account read",async()=>{
 const x=f(),r=x.req();r.auth.token.p65Session="s65_other123456789abcdef";
 await assert.rejects(x.handlers.usageStatus(r),e=>e.code==="permission-denied");
 assert.equal(x.calls.some(v=>v.startsWith("account:")),false);
});
test("P81 disabled Firebase Auth user denied before account read",async()=>{
 const x=f();x.disable();
 await assert.rejects(x.handlers.usageStatus(x.req()),e=>e.code==="permission-denied");
 assert.equal(x.calls.some(v=>v.startsWith("account:")),false);
});
test("P81 revoked lease denies before account read",async()=>{
 const x=f();x.setRevoked();
 await assert.rejects(x.handlers.recordingStatus(x.req()),e=>e.code==="permission-denied");
 assert.equal(x.calls.some(v=>v.startsWith("account:")),false);
});
test("P81 authorized status requires live Auth before account lookup",async()=>{
 const x=f(),r=await x.handlers.usageStatus(x.req());
 assert.equal(r.remaining,5);
 assert.ok(x.calls.indexOf("liveAuth:"+user)<x.calls.indexOf("account:"+user));
});
test("P81 authorized recording enforces authenticated uid",async()=>{
 const x=f(),r=x.req();r.data.uid="other-user";
 const response=await x.handlers.recordingStatus(r);
 assert.equal(response.status,"completed");
 assert.ok(x.calls.includes("account:"+user));
 assert.equal(x.calls.includes("account:other-user"),false);
});
test("P81 fail closed without dependencies",()=>{
 assert.throws(()=>createP81LegacyHandlers({}),/P81_STAGING_DEPENDENCIES_REQUIRED/);
});
