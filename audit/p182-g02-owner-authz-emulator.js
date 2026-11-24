"use strict";
const assert=require("node:assert/strict");
const admin=require("./p177-emulator/node_modules/firebase-admin");
const crypto=require("node:crypto");
const {accountRole,approveDuplicate}=require("./p182-g02-owner-authz-candidate");
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18087"||
 process.env.GCLOUD_PROJECT!=="demo-packtook-g02-p182"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-g02-p182")
 throw Error("P182_REJECT_NON_LOCAL_DEMO");
admin.initializeApp({projectId:"demo-packtook-g02-p182"});
const db=admin.firestore();db.settings({host:"127.0.0.1:18087",ssl:false});
const accounts=db.collection("p182_demo_accounts");
const request=(uid,verified=true,payload={})=>({auth:{uid,token:{email_verified:verified}},data:payload});
const input={barcode:"ABC-2026",reason:"Owner requests duplicate approval"};
const key=crypto.createHash("sha256").update(input.barcode).digest("hex");
async function seed(uid,ownerUid,completed=true){
 const doc=accounts.doc(uid);
 await doc.set(ownerUid===undefined?{plan:"Free"}:{plan:"Free",ownerUid});
 if(completed)await doc.collection("barcodeLocks").doc(key).set({operationId:"synthetic_rec_001",status:"completed"});
 else await doc.collection("barcodeLocks").doc(key).set({operationId:"synthetic_rec_001",status:"reserved"});
 return doc;
}
async function denied(fn,code){
 await assert.rejects(fn,e=>e&&e.code===code);
}
let n=0;
async function test(label,fn){await fn();n++;console.log("P182_"+label+"=PASS");}
(async()=>{
 try{
  await test("VERIFIED_OWNER_ROLE",async()=>{
   await seed("p182_alice","p182_alice");
   assert.equal((await accountRole(db,request("p182_alice"))).role,"admin");
  });
  await test("SIGNED_OUT_ROLE_DENIED",async()=>denied(()=>accountRole(db,{}),"unauthenticated"));
  await test("UNVERIFIED_ROLE_DENIED",async()=>denied(()=>accountRole(db,request("p182_alice",false)),"permission-denied"));
  await test("LEGACY_MISSING_OWNER_FAIL_CLOSED",async()=>{
   await seed("p182_legacy",undefined);
   await denied(()=>accountRole(db,request("p182_legacy")),"permission-denied");
   await denied(()=>approveDuplicate(db,request("p182_legacy"),input),"permission-denied");
   const d=(await accounts.doc("p182_legacy").get()).data();
   assert.equal(Object.hasOwn(d,"ownerUid"),false);
   assert.equal((await accounts.doc("p182_legacy").collection("duplicateApprovals").get()).empty,true);
  });
  await test("CONFLICTING_OWNER_DENIED",async()=>{
   await seed("p182_conflict","p182_other");
   await denied(()=>accountRole(db,request("p182_conflict")),"permission-denied");
   await denied(()=>approveDuplicate(db,request("p182_conflict"),input),"permission-denied");
  });
  await test("FORGED_ROLE_AND_OWNER_FIELDS_IGNORED",async()=>{
   await denied(()=>accountRole(db,request("p182_conflict",true,{role:"admin",ownerUid:"p182_conflict"})),"permission-denied");
  });
  await test("MISSING_ACCOUNT_ROLE_DENIED",async()=>{
   await denied(()=>accountRole(db,request("p182_nonexistent")),"permission-denied");
  });
  await test("VERIFIED_OWNER_APPROVAL_AND_AUDIT",async()=>{
   const res=await approveDuplicate(db,request("p182_alice"),input);
   assert.equal(res.approvedBy,"p182_alice");
   const account=accounts.doc("p182_alice");
   assert.equal((await account.collection("duplicateApprovals").doc(res.approvalId).get()).data().approvedBy,"p182_alice");
   assert.equal((await account.collection("audit").get()).size,1);
   assert.equal((await account.get()).data().ownerUid,"p182_alice");
  });
  await test("SIGNED_OUT_APPROVAL_DENIED",async()=>denied(()=>approveDuplicate(db,{},input),"unauthenticated"));
  await test("UNVERIFIED_APPROVAL_DENIED",async()=>denied(()=>approveDuplicate(db,request("p182_alice",false),input),"permission-denied"));
  await test("INCOMPLETE_BARCODE_DENIED",async()=>{
   await seed("p182_reserved","p182_reserved",false);
   await denied(()=>approveDuplicate(db,request("p182_reserved"),input),"failed-precondition");
   assert.equal((await accounts.doc("p182_reserved").collection("audit").get()).empty,true);
  });
  await test("MISSING_LOCK_DENIED",async()=>{
   await accounts.doc("p182_no_lock").set({ownerUid:"p182_no_lock"});
   await denied(()=>approveDuplicate(db,request("p182_no_lock"),input),"failed-precondition");
  });
  await test("BAD_REASON_DENIED",async()=>{
   await denied(()=>approveDuplicate(db,request("p182_alice"),{barcode:input.barcode,reason:"short"}),"invalid-argument");
  });
  await test("CROSS_TENANT_REQUEST_IGNORED",async()=>{
   await denied(()=>approveDuplicate(db,request("p182_conflict",true,{accountId:"p182_alice"}),input),"permission-denied");
  });
  console.log("P182_G02_REAL_FIRESTORE_EMULATOR="+n+"/"+n+"_PASS");
  console.log("P182_BACKEND_SOURCE=UNCHANGED_REVIEW_ONLY");
  console.log("P182_G02_GATE=NO_GO_PENDING_LEGACY_MIGRATION_AND_RELEASE_INTEGRATION");
  console.log("P182_NO_PRODUCTION_WRITES_NO_DEPLOY=PASS");
 }finally{await admin.app().delete();}
})().catch(e=>{console.error("P182_TEST_FAILED",e);process.exitCode=1;});
