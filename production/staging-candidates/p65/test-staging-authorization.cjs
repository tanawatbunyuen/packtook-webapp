"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createStagingGate,verifyEnvironment,validLease,StagingAuthorizationError}=require("./staging-authorization.cjs");
const now=Date.parse("2026-11-17T12:00:00Z");
const sid="s65_1234567890abcdef";const id="stagingUser123";
const env=()=>({GCLOUD_PROJECT:"packtook-staging",PACKTOOK_STAGING_PILOT_ENABLED:"true",
 PACKTOOK_STAGING_PUBLIC_SIGNUP_ENABLED:"false",PACKTOOK_STAGING_PUBLIC_ACCESS_ENABLED:"false",
 PACKTOOK_STAGING_PILOT_APP_ID:"1:123:web:abcdef1234"});
function control(){return {enabled:true,ownerApproved:true,legalApproved:true,
 policyVersion:"p65-staging-review-only",sessionId:sid,
 startedAt:"2026-11-17T11:30:00Z",expiresAt:"2026-11-17T13:00:00Z",
 maxInvitedUsers:3,invitedUids:[id]};}
function user(){return {uid:id,disabled:false,emailVerified:true,email:"test@example.invalid",
 customClaims:{packtookStagingPilot:true,p65Session:sid}};}
function req(){return {app:{appId:"1:123:web:abcdef1234"},
 auth:{uid:id,token:{email_verified:true,packtookStagingPilot:true,p65Session:sid}}};}
function fixture(options={}){
 let calls=0,liveReads=0;let state=options.control||control();let live=options.user||user();
 const gate=createStagingGate({env:options.env||env(),
 readControl:async()=>{calls++;return state;},
 readLiveUser:async()=>{liveReads++;return live;},
 now:options.now||(()=>now)});
 return {gate,controlCount:()=>calls,liveCount:()=>liveReads,
 revoke:()=>{state={...state,enabled:false};},setLive:x=>{live=x;}};
}
async function denied(p){await assert.rejects(p,e=>e instanceof StagingAuthorizationError&&e.code==="PERMISSION_DENIED");}
test("valid invitation can access guarded read-only handler",async()=>{
 const f=fixture(),request=req();
 const result=await f.gate.wrapReadOnly(async (_,{uid})=>uid())(request);
 assert.equal(result,id);assert.equal(f.controlCount(),1);assert.equal(f.liveCount(),1);
});
test("no request can use uid without validation",()=>{
 const f=fixture();assert.throws(()=>f.gate.uid(req()),/PERMISSION_DENIED/);
});
test("anonymous denied before any lease read",async()=>{
 const f=fixture();await denied(f.gate.assertAuthorized({app:req().app}));
 assert.equal(f.controlCount(),0);
});
test("missing App Check app identifier denied",async()=>{
 const f=fixture(),r=req();delete r.app;await denied(f.gate.assertAuthorized(r));
});
test("wrong App Check app id denied",async()=>{
 const f=fixture(),r=req();r.app.appId="1:456:web:wrong";await denied(f.gate.assertAuthorized(r));
});
test("email verification required",async()=>{
 const f=fixture(),r=req();r.auth.token.email_verified=false;await denied(f.gate.assertAuthorized(r));
});
test("Staging pilot claim required",async()=>{
 const f=fixture(),r=req();delete r.auth.token.packtookStagingPilot;await denied(f.gate.assertAuthorized(r));
});
test("Production Beta claim denied",async()=>{
 const f=fixture(),r=req();r.auth.token.packtookProductionBeta=true;await denied(f.gate.assertAuthorized(r));
});
test("Production pilot claim denied",async()=>{
 const f=fixture(),r=req();r.auth.token.packtookPilotV72=true;await denied(f.gate.assertAuthorized(r));
});
test("QA claim denied",async()=>{
 const f=fixture(),r=req();r.auth.token.packtookControlledQa=true;await denied(f.gate.assertAuthorized(r));
});
test("Public claim denied",async()=>{
 const f=fixture(),r=req();r.auth.token.packtookPublicCustomer=true;await denied(f.gate.assertAuthorized(r));
});
test("missing owner/legal approval rejected",async()=>{
 const c=control();c.ownerApproved=false;const f=fixture({control:c});await denied(f.gate.assertAuthorized(req()));
});
test("expired lease rejected",async()=>{
 const c=control();c.expiresAt="2026-11-17T11:59:59Z";const f=fixture({control:c});
 await denied(f.gate.assertAuthorized(req()));
});
test("revoked lease rejected on next request",async()=>{
 const f=fixture();await f.gate.assertAuthorized(req());f.revoke();
 await denied(f.gate.assertAuthorized(req()));assert.equal(f.controlCount(),2);
});
test("different session claim rejected",async()=>{
 const f=fixture(),r=req();r.auth.token.p65Session="s65_otherotherother123";await denied(f.gate.assertAuthorized(r));
});
test("not invited rejected",async()=>{
 const c=control();c.invitedUids=["someoneElse123"];const f=fixture({control:c});await denied(f.gate.assertAuthorized(req()));
});
test("disabled account rejected",async()=>{
 const u=user();u.disabled=true;const f=fixture({user:u});await denied(f.gate.assertAuthorized(req()));
});
test("live email unverified rejected",async()=>{
 const u=user();u.emailVerified=false;const f=fixture({user:u});await denied(f.gate.assertAuthorized(req()));
});
test("live custom claim revoked rejected",async()=>{
 const u=user();u.customClaims.packtookStagingPilot=false;const f=fixture({user:u});await denied(f.gate.assertAuthorized(req()));
});
test("live session mismatch rejected",async()=>{
 const u=user();u.customClaims.p65Session="s65_wrongwrongwrong1";const f=fixture({user:u});await denied(f.gate.assertAuthorized(req()));
});
test("Production project environment blocked",()=>{
 assert.throws(()=>verifyEnvironment({...env(),GCLOUD_PROJECT:"packtook-prod-01"}),/PERMISSION_DENIED/);
});
test("Production project environment variable blocked",()=>{
 assert.throws(()=>verifyEnvironment({...env(),PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01"}),/PERMISSION_DENIED/);
});
test("public rollout flag blocked",()=>{
 assert.throws(()=>verifyEnvironment({...env(),PACKTOOK_STAGING_PUBLIC_ACCESS_ENABLED:"true"}),/PERMISSION_DENIED/);
});
test("missing explicit Staging flag blocked",()=>{
 const v=env();delete v.PACKTOOK_STAGING_PILOT_ENABLED;
 assert.throws(()=>verifyEnvironment(v),/PERMISSION_DENIED/);
});
test("lease maximum four hours",()=>{
 const c=control();c.expiresAt="2026-11-17T16:00:01Z";
 assert.equal(validLease(c,now),false);
});
test("duplicate invite UID denied",()=>{
 const c=control();c.invitedUids=[id,id];assert.equal(validLease(c,now),false);
});
test("validate again after awaited reads if lease expires mid-call",async()=>{
 const c=control();let clock=now;const f=fixture({control:c,now:()=>{clock+=60*60*1000;return clock;}});
 await denied(f.gate.assertAuthorized(req()));
});
test("each new request performs a fresh lease and live user read",async()=>{
 const f=fixture();await f.gate.assertAuthorized(req());await f.gate.assertAuthorized(req());
 assert.equal(f.controlCount(),2);assert.equal(f.liveCount(),2);
});
test("handler not invoked for denied request",async()=>{
 const f=fixture(),r=req();r.app.appId="wrong";let used=false;
 await denied(f.gate.wrapReadOnly(async()=>{used=true;})(r));assert.equal(used,false);
});
test("read-only wrapper cannot be a production release proof",async()=>{
 const f=fixture();assert.equal(typeof f.gate.wrapReadOnly,"function");
 assert.equal(f.gate.deployReady,undefined);
});
