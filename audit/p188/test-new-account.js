"use strict";
// Runs only against P188 isolated full backend via official Auth+Functions+Firestore emulators.
const assert=require("node:assert/strict");
if(process.env.GCLOUD_PROJECT!=="demo-packtook-p184"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-p184"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19094"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18094")
 throw Error("P188_DEMO_ONLY_GUARD");
const admin=require("../p184/runtime/node_modules/firebase-admin");
admin.initializeApp({projectId:"demo-packtook-p184"});
const auth=admin.auth(),db=admin.firestore();
const root="http://127.0.0.1:15084/demo-packtook-p184/asia-southeast1/";
const users=[];
async function login(uid){
 const password="p188_disposable_test_password_98765";
 await auth.createUser({uid,email:uid+"@example.invalid",emailVerified:true,password});
 users.push(uid);
 const response=await fetch("http://127.0.0.1:19094/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=p188-demo",
 {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:uid+"@example.invalid",password,returnSecureToken:true})});
 assert.equal(response.status,200);
 const json=await response.json();return json.idToken;
}
async function call(fn,token,data={}){
 const x=await fetch(root+fn,{method:"POST",headers:{"Content-Type":"application/json",
 Authorization:"Bearer "+token},body:JSON.stringify({data})});
 const j=await x.json();return {http:x.status,result:j.result,error:j.error?.status};
}
async function run(){
 let n=0;
 const test=async(label,task)=>{await task();n++;console.log("P188_"+label+"=PASS");};
 try{
  const fresh="p188_newaccount",t=await login(fresh);
  await test("FRESH_ACCOUNT_MISSING_BEFORE_FIRST_CALL",async()=>{
   assert.equal((await db.collection("accounts").doc(fresh).get()).exists,false);
  });
  await test("FRESH_AUTH_USER_CREATE_OWNS_NEW_ACCOUNT",async()=>{
   const res=await call("deviceStatus",t,{deviceId:"p188-device-identifier-0001"});
   assert.equal(res.http,200,JSON.stringify(res));
   const x=await db.collection("accounts").doc(fresh).get();
   assert.equal(x.data().ownerUid,fresh);
   assert.equal(x.data().plan,"Free");
  });
  await test("FRESH_OWNER_ACCOUNT_ROLE_HTTP_PASS",async()=>{
   const res=await call("accountRole",t);
   assert.equal(res.http,200,JSON.stringify(res));
   assert.equal(res.result.role,"admin");
   assert.equal(res.result.accountId,fresh);
  });
  await test("NEW_ACCOUNT_REPLAY_NO_DUPLICATE_OWNER_WRITE",async()=>{
   const ref=db.collection("accounts").doc(fresh);
   await ref.update({sentinel:"preserve"});
   const res=await call("deviceStatus",t,{});
   assert.equal(res.http,200,JSON.stringify(res));
   assert.equal((await ref.get()).data().sentinel,"preserve");
  });
  const legacy="p188_legacy",legacyToken=await login(legacy);
  await db.collection("accounts").doc(legacy).set({plan:"Free",period:"2026-11",used:0,reserved:0});
  await test("EXISTING_LEGACY_NOT_AUTOBACKFILLED",async()=>{
   const res=await call("deviceStatus",legacyToken,{});
   assert.equal(res.http,200,JSON.stringify(res));
   assert.equal((await db.collection("accounts").doc(legacy).get()).data().ownerUid,undefined);
  });
  await test("LEGACY_ADMIN_REJECTED",async()=>{
   const res=await call("accountRole",legacyToken);
   assert.equal(res.http,403,JSON.stringify(res));assert.equal(res.error,"PERMISSION_DENIED");
  });
  await test("LEGACY_NO_SILENT_DATA_MIGRATION",async()=>{
   const ref=db.collection("accounts").doc(legacy),s=await ref.get();
   assert.equal(s.data().ownerUid,undefined);
   assert.equal(s.data().plan,"Free");
   assert.equal((await ref.collection("duplicateApprovals").get()).empty,true);
  });
  console.log("P188_G02_NEW_ACCOUNT_AND_LEGACY_RUNTIME="+n+"/"+n+"_PASS");
  console.log("P188_PRODUCTION_WRITES=0 DEPLOYS=0 OWNER_IMPORTS=0");
  console.log("P188_G02_GATE=NO_GO_LIVE_PROVENANCE_AND_STAGING_APPCHECK_OUTSTANDING");
 }finally{
  for(const uid of users)try{await auth.deleteUser(uid);}catch{}
  await admin.app().delete();
 }
}
run().catch(e=>{console.error("P188_G02_RUNTIME_FAILURE",e.message);process.exitCode=1;});
