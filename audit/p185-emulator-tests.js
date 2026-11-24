"use strict";
const assert=require("node:assert/strict");
const admin=require("./p177-emulator/node_modules/firebase-admin");
const {inventory}=require("./p185-legacy-inventory");
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18087"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19095"||
 process.env.GCLOUD_PROJECT!=="demo-packtook-p185"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-p185")
 throw Error("P185_DEMO_ONLY_GUARD");
admin.initializeApp({projectId:"demo-packtook-p185"});
const db=admin.firestore(),auth=admin.auth();
const coll=db.collection("p185_synthetic_accounts");
const fixtures=[
 ["p185_a_owner",{ownerUid:"p185_a_owner"},true,true,false],
 ["p185_b_legacy",{},true,true,false],
 ["p185_c_missingauth",{},false,false,false],
 ["p185_d_disabled",{},true,true,true],
 ["p185_e_unverified",{},true,false,false],
 ["p185_f_foreign",{ownerUid:"other_account"},true,true,false],
 ["p185_g_malformed",{ownerUid:"bad/uid"},true,true,false],
 ["p185_h_legacy2",{ownerUid:null},true,true,false],
 ["p185_i_owner",{ownerUid:"p185_i_owner"},true,true,false],
 ["p185_j_owner",{ownerUid:"p185_j_owner"},true,true,false],
 ["p185_k_legacy3",{},true,true,false]
];
let n=0;
async function test(name,fn){await fn();n++;console.log("P185_"+name+"=PASS");}
async function list(cursor,limit){
 let q=coll.orderBy(admin.firestore.FieldPath.documentId()).limit(limit);
 if(cursor)q=q.startAfter(cursor);
 const s=await q.get();return s.docs.map(x=>({id:x.id,data:x.data()}));
}
async function lookup(uid){
 try{
  const u=await auth.getUser(uid);
  return {exists:true,emailVerified:u.emailVerified,disabled:u.disabled};
 }catch(e){
  if(e.code==="auth/user-not-found")return {exists:false};
  throw e;
 }
}
(async()=>{
 try{
  for(const [id,data,exists,verified,disabled] of fixtures){
   await coll.doc(id).set(data);
   if(exists)await auth.createUser({uid:id,email:id+"@example.invalid",
     emailVerified:verified,disabled});
  }
  const result=await inventory({listAccounts:list,lookupUser:lookup,pageSize:3});
  await test("PAGINATED_READ_ONLY_COUNTS",async()=>{
   assert.equal(result.scanned,11);assert.equal(result.complete,true);
   assert.equal(result.counts.legacyMissingOwner,6);
   assert.equal(result.counts.ownerVerifiedShape,3);
   assert.equal(result.counts.foreignOwner,1);
   assert.equal(result.counts.malformedOwner,1);
  });
  await test("AUTH_CLASSIFICATION",async()=>{
   assert.equal(result.counts.missingAuthUser,1);
   assert.equal(result.counts.disabledAuthUser,1);
   assert.equal(result.counts.unverifiedAuthEmail,1);
   assert.equal(result.counts.legacyManualReview,3);
   assert.equal(result.counts.authLookupError,0);
  });
  await test("NO_ACCOUNT_MUTATION",async()=>{
   for(const [id,data] of fixtures){
    const now=(await coll.doc(id).get()).data();assert.deepEqual(now,data);
   }
  });
  await test("NO_AUTH_MUTATION",async()=>{
   const u=await auth.getUser("p185_d_disabled");assert.equal(u.disabled,true);
  });
  await test("NO_PII_IN_REPORT",async()=>{
   const s=JSON.stringify(result);
   for(const [id] of fixtures)assert(!s.includes(id));
   assert.match(result.inventoryFingerprint,/^[a-f0-9]{64}$/);
  });
  await test("NO_AUTO_OWNER_MIGRATION",async()=>{
   assert.equal(result.authorizedToWrite,false);
   assert.equal(result.releaseGate,"G02_NO_GO");
   assert.equal(result.provenanceVerified,false);
  });
  await test("TRUNCATION_FAIL_CLOSED",async()=>{
   const x=await inventory({listAccounts:list,lookupUser:lookup,pageSize:3,maxDocs:5});
   assert.equal(x.complete,false);assert.equal(x.truncated,true);assert.equal(x.scanned,5);
  });
  await test("MISSING_ADAPTER_REJECT",async()=>{
   await assert.rejects(()=>inventory({listAccounts:list}),/P185_INVALID/);
  });
  await test("BAD_CURSOR_ORDER_REJECT",async()=>{
   await assert.rejects(()=>inventory({listAccounts:async()=>[{id:"z",data:{}},{id:"a",data:{}}],lookupUser:lookup}),/P185_PAGE_ORDER/);
  });
  await test("INCOMPLETE_LOOKUP_REPORTED",async()=>{
   const x=await inventory({listAccounts:list,lookupUser:async()=>{throw Error("network");},pageSize:5});
   assert.equal(x.counts.authLookupError,6);
   assert.equal(x.authorizedToWrite,false);
  });
  await test("STABLE_FINGERPRINT",async()=>{
   const x=await inventory({listAccounts:list,lookupUser:lookup,pageSize:5});
   assert.equal(x.inventoryFingerprint,result.inventoryFingerprint);
  });
  await test("EMPTY_COLLECTION",async()=>{
   const x=await inventory({listAccounts:async()=>[],lookupUser:lookup});
   assert.equal(x.complete,true);assert.equal(x.scanned,0);
  });
  console.log("P185_INVENTORY_EMULATOR="+n+"/"+n+"_PASS");
  console.log("P185_FIXTURE_TOTAL="+result.scanned);
  console.log("P185_OUTPUT=AGGREGATES_ONLY");
  console.log("P185_G02=NO_GO_INDEPENDENT_PROVENANCE_NOT_VERIFIED");
  console.log("P185_PRODUCTION_READS=0 PRODUCTION_WRITES=0 MIGRATIONS=0");
 }finally{
  for(const [id,,exists] of fixtures)if(exists)try{await auth.deleteUser(id);}catch{}
  await admin.app().delete();
 }
})().catch(e=>{console.error("P185_FAILURE",e);process.exitCode=1;});
