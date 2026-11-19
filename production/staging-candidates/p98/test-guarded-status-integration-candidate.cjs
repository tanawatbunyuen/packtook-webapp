"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createP98GuardedStatusHandlers}=require("./guarded-status-integration-candidate.cjs");
const {projectUsageStatus}=require("../p97/status-contract-projection.cjs");
const USER="p98DemoStagingUid001",SESSION="s65_1234567890abcdef",
 OP="p98_recording000001",APP="1:123:web:abcdef1234";
const NOW=Date.parse("2026-11-19T09:00:00.000Z");
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const DATA={plan:"Free",period:"2026-11",used:4,reserved:2};
function fixture(account=DATA,{blocked=false,wrongProject=false,missingAccount=false}={}){
 const calls=[],writes=[],config=[];
 let revoked=false,disabled=false,liveEmailVerified=true;
 const env={GCLOUD_PROJECT:wrongProject?"packtook-prod-01":"packtook-staging",
  GCP_PROJECT:"packtook-staging",PACKTOOK_STAGING_PILOT_ENABLED:"true",
  PACKTOOK_STAGING_PUBLIC_SIGNUP_ENABLED:"false",
  PACKTOOK_STAGING_PUBLIC_ACCESS_ENABLED:"false",
  PACKTOOK_STAGING_PILOT_APP_ID:APP};
 const control=()=>({enabled:!revoked,ownerApproved:true,legalApproved:true,
  policyVersion:"p65-staging-review-only",sessionId:SESSION,
  startedAt:new Date(NOW-60000).toISOString(),expiresAt:new Date(NOW+3600000).toISOString(),
  maxInvitedUsers:3,invitedUids:[USER]});
 const db={
  doc:p=>{calls.push("pilot:"+p);return{get:async()=>({exists:true,data:control})}},
  collection:p=>{calls.push("collection:"+p);return{
   doc:id=>{calls.push("account:"+id);return{
    get:async()=>{calls.push("accountRead:"+id);return missingAccount?{exists:false}:{exists:true,data:()=>account}},
    create:async()=>{writes.push("create");throw Error("write forbidden");},
    set:async()=>{writes.push("set");throw Error("write forbidden");},
    update:async()=>{writes.push("update");throw Error("write forbidden");},
    collection:collection=>{calls.push("subcollection:"+collection);return {
     doc:op=>{calls.push("operation:"+op);return {
      get:async()=>({exists:true,data:()=>({status:"completed",barcode:"P98-DEMO",period:"2026-11",file:null})}),
      set:async()=>{writes.push("recording set");throw Error("write forbidden");}
     }}
    }}
   }}
  }}
 };
 const auth={getUser:async uid=>{calls.push("liveAuth:"+uid);return {uid,
  email:"test@example.invalid",emailVerified:liveEmailVerified,disabled,
  customClaims:{packtookStagingPilot:true,p65Session:SESSION}}}};
 const onCall=(opts,handler)=>{config.push(opts);return handler};
 const create=()=>createP98GuardedStatusHandlers({db,auth,onCall,HttpsError,env,now:()=>NOW});
 const handlers=blocked?null:create();
 const req=()=>({auth:{uid:USER,token:{email_verified:true,packtookStagingPilot:true,p65Session:SESSION}},
  app:{appId:APP},data:{operationId:OP}});
 return {create,handlers,req,calls,writes,config,env,
  revoke:()=>{revoked=true},disable:()=>{disabled=true},
  unverify:()=>{liveEmailVerified=false}};
}
function denyCase(name,modify,{handler="usageStatus",denyCode="permission-denied"}={}){
 test("P98 deny "+name+" before account read",async()=>{
  const x=fixture(),r=x.req();modify(x,r);
  await assert.rejects(x.handlers[handler](r),e=>e.code===denyCode);
  assert.equal(x.calls.some(y=>y.startsWith("account:")),false,name);
  assert.equal(x.writes.length,0);
 });
}
test("P98 exports exactly 2 guarded original names",()=>{
 const x=fixture();
 assert.deepEqual(Object.keys(x.handlers).sort(),["recordingStatus","usageStatus"]);
 assert.equal(x.config.length,2);
 assert.ok(x.config.every(o=>o.enforceAppCheck===true&&o.region==="asia-southeast1"&&o.consumeAppCheckToken===false));
});
test("P98 existing Free account matches P97 projection exactly",async()=>{
 const x=fixture();
 const result=await x.handlers.usageStatus(x.req());
 assert.deepEqual(result,projectUsageStatus(DATA,{now:NOW,HttpsError}));
 assert.equal(result.remaining,14);
 assert.ok(x.calls.indexOf("liveAuth:"+USER)<x.calls.indexOf("account:"+USER));
 assert.equal(x.writes.length,0);
});
for(const [name,account] of [
 ["wallet",{plan:"Free",period:"2026-10",used:14,reserved:3,creditWalletV1:true,creditWalletRemaining:7,walletStartingCredits:30}],
 ["paid active",{plan:"Starter",period:"2026-11",used:12,reserved:5,planExpiresAt:"2027-01-01T00:00:00.000Z"}],
 ["paid expired",{plan:"Basic",period:"2026-11",used:70,reserved:2,planExpiresAt:"2026-10-01T00:00:00.000Z"}],
 ["Pro unlimited",{plan:"Pro",period:"2026-11",used:100,reserved:2,planExpiresAt:"2027-01-01T00:00:00.000Z"}],
 ["prior period",{plan:"Free",period:"2026-10",used:18,reserved:2}]
]){
 test("P98 guarded usage matches P97 "+name,async()=>{
  const x=fixture(account);
  const a=await x.handlers.usageStatus(x.req());
  assert.deepEqual(a,projectUsageStatus(account,{now:NOW,HttpsError}));
  assert.equal(x.writes.length,0);
 });
}
denyCase("missing App Check context",(_,r)=>{delete r.app});
denyCase("wrong Firebase App ID",(_,r)=>{r.app.appId="1:999:web:wrong"});
denyCase("missing Auth",(_,r)=>{delete r.auth},{handler:"recordingStatus"});
denyCase("missing verified email",(_,r)=>{r.auth.token.email_verified=false});
denyCase("wrong session",(_,r)=>{r.auth.token.p65Session="s65_wrong123456789abcdef"});
denyCase("production beta claim",(_,r)=>{r.auth.token.packtookProductionBeta=true});
denyCase("not invited uid",(_,r)=>{r.auth.uid="otherStagingUid999"});
denyCase("revoked pilot lease",(x)=>x.revoke(),{handler:"recordingStatus"});
denyCase("disabled live user",(x)=>x.disable());
denyCase("unverified live user",(x)=>x.unverify());
test("P98 wrong project fails closed before registration",()=>{
 const x=fixture(DATA,{blocked:true,wrongProject:true});
 assert.throws(()=>x.create(),/PERMISSION_DENIED|StagingAuthorizationError|P65/);
 assert.equal(x.writes.length,0);
});
test("P98 no account denies without provisioning credit or account",async()=>{
 const x=fixture(DATA,{missingAccount:true});
 await assert.rejects(x.handlers.usageStatus(x.req()),e=>e.code==="failed-precondition");
 assert.equal(x.writes.length,0);
});
test("P98 invalid unknown plan does not return misleading credits",async()=>{
 const x=fixture({...DATA,plan:"NotAPlan"});
 await assert.rejects(x.handlers.usageStatus(x.req()),e=>e.code==="failed-precondition");
 assert.equal(x.writes.length,0);
});
test("P98 recording ignores spoofed uid field",async()=>{
 const x=fixture(),r=x.req();r.data.uid="someoneElse001";
 const result=await x.handlers.recordingStatus(r);
 assert.deepEqual(result,{recordingId:OP,status:"completed",barcode:"P98-DEMO",period:"2026-11",file:null});
 assert.ok(x.calls.includes("account:"+USER));
 assert.equal(x.calls.includes("account:someoneElse001"),false);
 assert.equal(x.writes.length,0);
});
test("P98 invalid recording operation rejected before recording read",async()=>{
 const x=fixture(),r=x.req();r.data.operationId="../wrong";
 await assert.rejects(x.handlers.recordingStatus(r),e=>e.code==="invalid-argument");
 assert.equal(x.calls.some(v=>v.startsWith("operation:")),false);
 assert.equal(x.writes.length,0);
});
test("P98 candidate cannot register with missing dependencies",()=>{
 assert.throws(()=>createP98GuardedStatusHandlers(),/P98_DEPENDENCIES_REQUIRED/);
});
