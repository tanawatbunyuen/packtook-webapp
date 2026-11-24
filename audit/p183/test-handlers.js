"use strict";
// Full pinned backend candidate executed with stub onCall transport but real Firestore Emulator.
// This does not attest Firebase Auth/Functions wire protocol.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const Module=require("node:module"),crypto=require("node:crypto");
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18087"||
 process.env.GCLOUD_PROJECT!=="demo-packtook-g02-p183"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-g02-p183")
 throw Error("P183_EMULATOR_PROJECT_AND_HOST_GUARD");
const admin=require("./p177-emulator/node_modules/firebase-admin");
const inherited=Module._load;
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
Module._load=function(name,parent,main){
 if(name==="firebase-admin")return admin;
 if(name==="firebase-functions/v2/https")return {
  onCall:(options,handler)=>handler,onRequest:(options,handler)=>handler,HttpsError};
 if(name==="firebase-functions/params")return {
  defineSecret:()=>({value:()=>{throw Error("P183_TEST_SECRET_UNAVAILABLE");}})};
 return inherited.apply(this,arguments);
};
const candidate=path.resolve(__dirname,".generated-index.js");
if(!fs.existsSync(candidate))throw Error("P183_CANDIDATE_MUST_BE_BUILT");
let handlers;
try{handlers=require(candidate);}finally{Module._load=inherited;}
const db=admin.firestore();db.settings({host:"127.0.0.1:18087",ssl:false});
const accounts=db.collection("accounts"),barcode="P183-REC-001";
const key=crypto.createHash("sha256").update(barcode).digest("hex");
const input={barcode,reason:"Verified owner duplicate request"};
const req=(id,verified=true,extra={})=>({auth:{uid:id,token:{email_verified:verified}},data:extra});
async function seed(id,ownerUid,lock="completed"){
 const ref=accounts.doc(id);
 await ref.set(ownerUid===undefined?{plan:"Free"}:{plan:"Free",ownerUid});
 if(lock)await ref.collection("barcodeLocks").doc(key).set({status:lock,operationId:"synthetic_rec_001"});
 return ref;
}
async function denied(fn,code){await assert.rejects(fn,e=>e&&e.code===code);}
let n=0;async function test(label,fn){await fn();n++;console.log("P183_"+label+"=PASS");}
(async()=>{
 try{
  await test("REAL_ACCOUNT_ROLE_OWNER_PASS",async()=>{
   await seed("p183_alice","p183_alice");
   assert.equal((await handlers.accountRole(req("p183_alice"))).role,"admin");
  });
  await test("REAL_ACCOUNT_ROLE_SIGNED_OUT_DENY",async()=>denied(()=>handlers.accountRole({}),"unauthenticated"));
  await test("REAL_ACCOUNT_ROLE_UNVERIFIED_DENY",async()=>denied(()=>handlers.accountRole(req("p183_alice",false)),"permission-denied"));
  await test("REAL_ACCOUNT_ROLE_MISSING_ACCOUNT_DENY",async()=>{
   await denied(()=>handlers.accountRole(req("p183_missing")),"permission-denied");
   assert.equal((await accounts.doc("p183_missing").get()).exists,false);
  });
  await test("REAL_ACCOUNT_ROLE_LEGACY_DENY_WITHOUT_WRITE",async()=>{
   const ref=await seed("p183_legacy",undefined);
   await denied(()=>handlers.accountRole(req("p183_legacy",true,{ownerUid:"p183_legacy",role:"admin"})),"permission-denied");
   assert.equal(Object.hasOwn((await ref.get()).data(),"ownerUid"),false);
  });
  await test("REAL_ACCOUNT_ROLE_FOREIGN_OWNER_DENY",async()=>{
   await seed("p183_wrong","other_user");
   await denied(()=>handlers.accountRole(req("p183_wrong")),"permission-denied");
  });
  await test("REAL_DUPLICATE_OWNER_AND_AUDIT",async()=>{
   const result=await handlers.authorizeDuplicate(req("p183_alice",true,input));
   assert.equal(typeof result.approvalId,"string");
   const ref=accounts.doc("p183_alice");
   const approval=(await ref.collection("duplicateApprovals").doc(result.approvalId).get()).data();
   assert.equal(approval.approvedBy,"p183_alice");
   assert.equal((await ref.collection("audit").get()).size,1);
   assert.equal((await ref.get()).data().ownerUid,"p183_alice");
  });
  await test("REAL_DUPLICATE_LEGACY_REJECTED_NO_BOOTSTRAP",async()=>{
   const ref=accounts.doc("p183_legacy");
   await denied(()=>handlers.authorizeDuplicate(req("p183_legacy",true,input)),"permission-denied");
   assert.equal(Object.hasOwn((await ref.get()).data(),"ownerUid"),false);
   assert.equal((await ref.collection("duplicateApprovals").get()).empty,true);
  });
  await test("REAL_DUPLICATE_FOREIGN_OWNER_REJECTED",async()=>{
   await denied(()=>handlers.authorizeDuplicate(req("p183_wrong",true,input)),"permission-denied");
   assert.equal((await accounts.doc("p183_wrong").collection("audit").get()).empty,true);
  });
  await test("REAL_DUPLICATE_MISSING_ACCOUNT_REJECTED_NO_CREATE",async()=>{
   await denied(()=>handlers.authorizeDuplicate(req("p183_missing",true,input)),"permission-denied");
   assert.equal((await accounts.doc("p183_missing").get()).exists,false);
  });
  await test("REAL_DUPLICATE_FORGED_PAYLOAD_DENIED",async()=>{
   await denied(()=>handlers.authorizeDuplicate(req("p183_wrong",true,{...input,accountId:"p183_alice",ownerUid:"p183_wrong",role:"admin"})),"permission-denied");
  });
  await test("REAL_DUPLICATE_UNVERIFIED_DENIED",async()=>denied(()=>handlers.authorizeDuplicate(req("p183_alice",false,input)),"permission-denied"));
  await test("REAL_DUPLICATE_NO_COMPLETED_LOCK_DENIED",async()=>{
   await seed("p183_no_lock","p183_no_lock","reserved");
   await denied(()=>handlers.authorizeDuplicate(req("p183_no_lock",true,input)),"failed-precondition");
  });
  await test("REAL_DUPLICATE_BAD_REASON_DENIED",async()=>denied(()=>handlers.authorizeDuplicate(req("p183_alice",true,{barcode,reason:"short"})),"invalid-argument"));
  await test("REAL_LEGACY_ACCOUNT_REMAINS_READABLE_VIA_STATUS",async()=>{
   const out=await handlers.usageStatus(req("p183_legacy"));
   assert.equal(out.plan,"Free");
   assert.equal(Object.hasOwn((await accounts.doc("p183_legacy").get()).data(),"ownerUid"),false);
  });
  console.log("P183_FULL_BACKEND_HANDLER_FIRESTORE_EMULATOR="+n+"/"+n+"_PASS");
  console.log("P183_CALLABLE_TRANSPORT=STUBBED_NOT_AUTH_ATTESTED");
  console.log("P183_G02=NO_GO_PENDING_LEGACY_PROVENANCE_AND_FULL_CALLABLE_AUTH_RUNTIME");
  console.log("P183_PRODUCTION_WRITES=0 P183_DEPLOY=0");
 }finally{await admin.app().delete();}
})().catch(async e=>{console.error("P183_FAIL",e);try{await admin.app().delete();}catch{}process.exitCode=1;});
