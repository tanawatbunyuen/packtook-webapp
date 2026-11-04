// PACKTOOK V7.2 — Executable mocked callable integration negative suite.
// Runs actual production/functions/index.js in a Node VM with stubbed Firebase SDK.
// NO network, no emulator, no Production calls, no real identity or secret payload.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
const code=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const APP="1:267344264661:web:abcdef123456",UID="pilotuser_001";
const now=Date.now();
const baseControl={
 enabled:true,legalApproved:true,ownerApproved:true,policyVersion:"2026-11-v1",
 startedAt:new Date(now-60_000).toISOString(),expiresAt:new Date(now+60*60_000).toISOString(),
 invitedUids:[UID],maxInvitedUsers:3,sessionId:"v72_abcdefghijklmnop1234"
};
const liveBase={disabled:false,emailVerified:true,email:"pilot-test@example.invalid",customClaims:{}};
function makeHarness({pilotEnabled=true,publicSignup=false,publicAccess=false,qaEnabled=false,
 control=baseControl,live=liveBase,secretValue="a".repeat(64),appId=APP,project="packtook-prod-01"}={}){
 const metrics={reads:0,authReads:0,writes:0,transactions:0,secretReads:0};
 const operations={
  create(){metrics.writes++;throw Error("UNEXPECTED_WRITE")},
  update(){metrics.writes++;throw Error("UNEXPECTED_WRITE")},
  set(){metrics.writes++;throw Error("UNEXPECTED_WRITE")},
  delete(){metrics.writes++;throw Error("UNEXPECTED_WRITE")}
 };
 function docFor(coll,id){
  return {id,
   async get(){metrics.reads++;return coll==="pilotControls"?
      {exists:control!==null,data:()=>control}:
      {exists:false,data:()=>null}},
   ...operations,
   collection:(name)=>({doc:(x)=>docFor(coll+"/"+id+"/"+name,x)})};
 }
 const db={
  collection:(name)=>({doc:(id)=>docFor(name,id)}),
  async runTransaction(){metrics.transactions++;throw Error("UNEXPECTED_TRANSACTION")}
 };
 const admin={
  initializeApp(){},
  firestore:Object.assign(()=>db,{FieldValue:{serverTimestamp:()=>null,increment:()=>null}}),
  auth:()=>({
   async getUser(){metrics.authReads++;return live},
   async setCustomUserClaims(){metrics.writes++;throw Error("UNEXPECTED_AUTH_WRITE")}
  })
 };
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
 const exports={},module={exports};
 const environ={
  PACKTOOK_PRODUCTION_PROJECT_ID:project,
  PACKTOOK_PUBLIC_CUSTOMER_APP_ID:appId,
  PACKTOOK_V72_PILOT_ENABLED:String(pilotEnabled),
  PACKTOOK_PUBLIC_SIGNUP_ENABLED:String(publicSignup),
  PACKTOOK_PUBLIC_ACCESS_ENABLED:String(publicAccess),
  PACKTOOK_PUBLIC_POLICIES_APPROVED:"false",
  PACKTOOK_V7_QA_ENABLED:String(qaEnabled),
  PACKTOOK_PUBLIC_FREE_NEW_DAY_CAP:"3",
  PACKTOOK_PUBLIC_FREE_NEW_15M_CAP:"2"
 };
 const mocks={
  "firebase-functions/v2/https":{
   HttpsError,
   onCall:(options,fn)=>async req=>{
    if(options.enforceAppCheck===true&&!req.app)throw new HttpsError("unauthenticated","App Check required");
    return fn(req);
   }
  },
  "firebase-functions/params":{defineSecret:()=>({value:()=>{metrics.secretReads++;return secretValue}})},
  "firebase-functions/logger":{info(){}},
  "firebase-admin":admin,
  "node:crypto":crypto
 };
 const context={module,exports,process:{env:environ},require:(name)=>{
  if(!Object.hasOwn(mocks,name))throw Error("Unexpected require "+name);
  return mocks[name];
 },Date,Buffer,console};
 vm.runInNewContext(code,context,{filename:"production/functions/index.js",timeout:3000});
 return {fn:module.exports,metrics};
}
const auth=(token={})=>({uid:UID,token:{email_verified:true,...token}});
const req=(token={},app={appId:APP})=>({auth:auth(token),app,data:{}});
let passed=0;
async function denied(label,config,call,expectedCode="permission-denied"){
 const h=makeHarness(config);
 const pre={...h.metrics};
 await assert.rejects(()=>call(h.fn),err=>err.code===expectedCode,
   label+" expected "+expectedCode);
 assert.equal(h.metrics.writes,0,label+" must not write");
 assert.equal(h.metrics.transactions,0,label+" must not enter Firestore transaction");
 passed++;
 console.log("PASS: "+label);
}
async function run(){
 await denied("App Check missing",{},f=>f.pilotInvitationStatus(req({},undefined)),"unauthenticated");
 await denied("Pilot switch OFF",{pilotEnabled:false},f=>f.pilotInvitationStatus(req()));
 await denied("Public signup ON",{publicSignup:true},f=>f.pilotInvitationStatus(req()));
 await denied("Public access ON",{publicAccess:true},f=>f.pilotInvitationStatus(req()));
 await denied("QA ON",{qaEnabled:true},f=>f.pilotInvitationStatus(req()));
 await denied("wrong project",{project:"test-other"},f=>f.pilotInvitationStatus(req()));
 await denied("wrong App ID",{},f=>f.pilotInvitationStatus(req({}, {appId:"1:123:web:wrong"})));
 await denied("unauthenticated",{},f=>f.pilotInvitationStatus({app:{appId:APP},data:{}}));
 await denied("missing control",{control:null},f=>f.pilotInvitationStatus(req()));
 await denied("disabled control",{control:{...baseControl,enabled:false}},f=>f.pilotInvitationStatus(req()));
 await denied("unapproved legal",{control:{...baseControl,legalApproved:false}},f=>f.pilotInvitationStatus(req()));
 await denied("unapproved owner",{control:{...baseControl,ownerApproved:false}},f=>f.pilotInvitationStatus(req()));
 await denied("wrong UID",{control:{...baseControl,invitedUids:["someone_else"]}},f=>f.pilotInvitationStatus(req()));
 await denied("expired lease",{control:{...baseControl,startedAt:new Date(now-5*60*60_000).toISOString(),
   expiresAt:new Date(now-60_000).toISOString()}},f=>f.pilotInvitationStatus(req()));
 await denied("future lease",{control:{...baseControl,startedAt:new Date(now+60_000).toISOString()}},f=>f.pilotInvitationStatus(req()));
 await denied("over 4h lease",{control:{...baseControl,expiresAt:new Date(now+5*60*60_000).toISOString()}},f=>f.pilotInvitationStatus(req()));
 await denied("more than 3 invites",{control:{...baseControl,invitedUids:[UID,"pilot_002","pilot_003","pilot_004"]}},f=>f.pilotInvitationStatus(req()));
 await denied("duplicate invite UID",{control:{...baseControl,invitedUids:[UID,UID]}},f=>f.pilotInvitationStatus(req()));
 await denied("disabled Firebase Auth user",{live:{...liveBase,disabled:true}},f=>f.pilotInvitationStatus(req()));
 await denied("conflicting Beta claim",{live:{...liveBase,customClaims:{packtookProductionBeta:true}}},f=>f.pilotInvitationStatus(req()));
 await denied("unverified email cannot activate",{live:{...liveBase,emailVerified:false}},
  f=>f.completePilotFreeSignup({...req(),data:{acceptTestTerms:true,acceptPrivacy:true,policyVersion:"2026-11-v1"}}));
 await denied("no Pilot claim for guarded recording",{},f=>f.usageStatus(req({packtookPilotV72:true})));
 await denied("wrong session for guarded recording",{},f=>f.reserveCredit(req({packtookPilotV72:true,packtookPilotV72Session:"v72_wrong_session_012345"})));
 await denied("revoked guarded recording lease",{control:{...baseControl,enabled:false}},
  f=>f.finalizeCredit(req({packtookPilotV72:true,packtookPilotV72Session:baseControl.sessionId})));
 await denied("no admission consent",{},f=>f.completePilotFreeSignup({...req(),data:{}}),"invalid-argument");
 const h=makeHarness({live:{...liveBase,emailVerified:false}});
 const status=await h.fn.pilotInvitationStatus(req());
 assert.equal(status.enabled,true);
 assert.equal(status.verified,false);
 assert.equal(status.active,false);
 assert.equal(h.metrics.writes,0);
 passed++;console.log("PASS: invited unverified user receives status only, zero entitlements");
 console.log(JSON.stringify({mode:"MOCKED_PRODUCTION_SOURCE_CALLABLES",passed,
  productionWrites:false,remoteRuntimeVerified:false,realAppCheckVerified:false,
  emulatorVerified:false,decision:"NO_GO_CONTROLLED_PILOT"},null,2));
}
await run();
