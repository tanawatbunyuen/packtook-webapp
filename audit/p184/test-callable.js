"use strict";
// Real Firebase Auth + Functions + Firestore Emulator HTTP integration.
// No cloud IAM, no production token-signature attestation. Demo project/localhost only.
const assert=require("node:assert/strict"),crypto=require("node:crypto");
if(process.env.GCLOUD_PROJECT!=="demo-packtook-p184"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-p184"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19094"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18094")
 throw Error("P184_BLOCK_NON_DEMO_EMULATORS");
const admin=require("./runtime/node_modules/firebase-admin");
admin.initializeApp({projectId:"demo-packtook-p184"});
const db=admin.firestore(),auth=admin.auth();
const accounts=db.collection("accounts");
const URL="http://127.0.0.1:15084/demo-packtook-p184/asia-southeast1/";
const INPUT={barcode:"P184-BARCODE-001",reason:"Verified owner duplicate test reason"};
const lockKey=crypto.createHash("sha256").update(INPUT.barcode).digest("hex");
const users=[];
async function create(label,verified,owner){
 const uid="p184_"+label, email=uid+"@example.invalid",password="P184_demo_only_password_98765!";
 await auth.createUser({uid,email,password,emailVerified:verified});users.push(uid);
 if(owner!==null){
  const doc=accounts.doc(uid);
  await doc.set(owner===undefined?{plan:"Free"}:{plan:"Free",ownerUid:owner});
  await doc.collection("barcodeLocks").doc(lockKey).set({status:"completed",operationId:"synthetic_recording_001"});
 }
 const response=await fetch("http://127.0.0.1:19094/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-only",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({email,password,returnSecureToken:true})});
 assert.equal(response.status,200,"demo local sign-in");
 const body=await response.json();assert.equal(typeof body.idToken,"string");
 return {uid,token:body.idToken};
}
async function invoke(name,token,payload={}){
 const res=await fetch(URL+name,{method:"POST",headers:{
  "Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
  body:JSON.stringify({data:payload})});
 const body=await res.json();
 return {http:res.status,result:body.result,error:body.error?.status||null};
}
let n=0;
async function test(label,fn){await fn();n++;console.log("P184_"+label+"=PASS");}
(async()=>{
 try{
  const owner=await create("owner",true,"p184_owner");
  const legacy=await create("legacy",true,undefined);
  const other=await create("wrong",true,"p184_owner");
  const unverified=await create("unverified",false,"p184_unverified");
  const missing=await create("missing",true,null);
  const deny=async(name,token,payload,expected="PERMISSION_DENIED")=>{
   const r=await invoke(name,token,payload);
   assert.equal(r.error,expected,JSON.stringify({name,http:r.http,error:r.error}));
   assert([401,403].includes(r.http),JSON.stringify(r));
  };
  await test("OWNER_ACCOUNT_ROLE_HTTP_SUCCESS",async()=>{
   const x=await invoke("accountRole",owner.token);
   assert.equal(x.http,200);assert.equal(x.result.role,"admin");assert.equal(x.result.accountId,owner.uid);
  });
  await test("SIGNED_OUT_ROLE_HTTP_DENIED",()=>deny("accountRole",null,{},"UNAUTHENTICATED"));
  await test("UNVERIFIED_ROLE_HTTP_DENIED",()=>deny("accountRole",unverified.token,{}));
  await test("FOREIGN_OWNER_ROLE_HTTP_DENIED",()=>deny("accountRole",other.token,{}));
  await test("LEGACY_ROLE_HTTP_DENIED",()=>deny("accountRole",legacy.token,{ownerUid:legacy.uid,role:"admin"}));
  await test("MISSING_ACCOUNT_ROLE_HTTP_DENIED",async()=>{
   await deny("accountRole",missing.token,{});
   assert.equal((await accounts.doc(missing.uid).get()).exists,false);
  });
  await test("OWNER_APPROVAL_REAL_TRANSACTION_HTTP",async()=>{
   const x=await invoke("authorizeDuplicate",owner.token,INPUT);
   assert.equal(x.http,200,JSON.stringify(x));
   assert.equal(typeof x.result.approvalId,"string");
   const approval=await accounts.doc(owner.uid).collection("duplicateApprovals").doc(x.result.approvalId).get();
   assert.equal(approval.data().approvedBy,owner.uid);
   assert.equal((await accounts.doc(owner.uid).collection("audit").get()).size,1);
  });
  await test("SIGNED_OUT_APPROVAL_HTTP_DENIED",()=>deny("authorizeDuplicate",null,INPUT,"UNAUTHENTICATED"));
  await test("UNVERIFIED_APPROVAL_HTTP_DENIED",()=>deny("authorizeDuplicate",unverified.token,INPUT));
  await test("FOREIGN_OWNER_APPROVAL_HTTP_DENIED",()=>deny("authorizeDuplicate",other.token,INPUT));
  await test("LEGACY_APPROVAL_HTTP_DENIED_NO_BOOTSTRAP",async()=>{
   await deny("authorizeDuplicate",legacy.token,{...INPUT,ownerUid:legacy.uid,role:"admin"});
   assert.equal(Object.hasOwn((await accounts.doc(legacy.uid).get()).data(),"ownerUid"),false);
   assert.equal((await accounts.doc(legacy.uid).collection("duplicateApprovals").get()).empty,true);
  });
  await test("MISSING_ACCOUNT_APPROVAL_HTTP_DENIED",async()=>{
   await deny("authorizeDuplicate",missing.token,INPUT);
   assert.equal((await accounts.doc(missing.uid).get()).exists,false);
  });
  await test("LEGACY_USAGE_STATUS_HTTP_COMPATIBLE",async()=>{
   const x=await invoke("usageStatus",legacy.token);
   assert.equal(x.http,200,JSON.stringify(x));assert.equal(x.result.plan,"Free");
   assert.equal(Object.hasOwn((await accounts.doc(legacy.uid).get()).data(),"ownerUid"),false);
  });
  await test("INVALID_REASON_NO_APPROVAL_WRITES",async()=>{
   await deny("authorizeDuplicate",owner.token,{barcode:INPUT.barcode,reason:"short"},"INVALID_ARGUMENT");
   assert.equal((await accounts.doc(owner.uid).collection("duplicateApprovals").get()).size,1);
  });
  console.log("P184_FULL_CALLABLE_LOCAL_RUNTIME="+n+"/"+n+"_PASS");
  console.log("P184_LOCAL_EMULATOR_TOKEN_SIGNATURE_ATTESTED=FALSE");
  console.log("P184_INVALID_AUTH_TOKEN_HTTP_PROTOCOL=NOT_ATTESTED_SEPARATE_G03");
  console.log("P184_PRODUCTION_WRITES=0 DEPLOYS=0 OWNER_IMPORTS=0");
  console.log("P184_G02=NO_GO_LEGACY_OWNER_PROVENANCE_AND_SECURITY_SIGNOFF");
 }finally{
  let removed=0;
  for(const uid of users.reverse())try{await auth.deleteUser(uid);removed++;}catch{}
  console.log("P184_SYNTHETIC_AUTH_CLEANUP="+removed+"/"+users.length);
  await admin.app().delete();
 }
})().catch(e=>{console.error("P184_CALLABLE_TEST_FAILURE",e.message);process.exitCode=1;});
