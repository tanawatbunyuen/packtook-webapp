"use strict";
/**
 * P213 G02 — run pinned P188 actual handler code plus intentionally WEAKENED
 * variants against local Firebase Auth + Firestore emulators.
 * Mutants are NEVER release candidates. They exist only to prove tests fail
 * when authorization checks are removed. No cloud access, credentials or deploy.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),
 vm=require("node:vm"),{createRequire}=require("node:module");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const demo="demo-packtook-p184";
const required={CI:"true",GCLOUD_PROJECT:demo,GOOGLE_CLOUD_PROJECT:demo,
 FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:19099"};
for(const [k,v] of Object.entries(required))if(process.env[k]!==v)throw Error("P213_DEMO_ONLY_"+k);
const source=fs.readFileSync(path.resolve(__dirname,"../p188/candidate-index.js"),"utf8");
assert.equal(crypto.createHash("sha256").update(source).digest("hex"),EXPECTED_CANDIDATE);
const reqFns=createRequire(path.resolve(__dirname,"../../functions/index.js"));
const admin=reqFns("firebase-admin");
const safeAdmin=new Proxy(admin,{get(target,prop){
 if(prop==="initializeApp")return ()=>target.apps.length?target.app():target.initializeApp();
 return Reflect.get(target,prop);
}});
const fields=reqFns("firebase-admin/firestore");
const HttpsError=class HttpsError extends Error{
 constructor(code,message){super(message);this.code=code;}
};
const deps=name=>{
 if(name==="firebase-functions/v2/https")return {
  onCall:(options,handler)=>handler,onRequest:(options,handler)=>handler,HttpsError};
 if(name==="firebase-functions/params")return {defineSecret:()=>({
  value(){throw Error("P213_SECRET_ACCESS_DENIED")}})};
 if(name==="firebase-admin")return safeAdmin;
 if(name==="firebase-admin/firestore")return fields;
 if(name==="node:crypto")return crypto;
 throw Error("P213_UNEXPECTED_IMPORT");
};
function handlerModule(text){
 const out={};
 vm.compileFunction(text,["exports","require","module"],
 {filename:"p213-isolated-emulator-authz-candidate.js"})(out,deps,{exports:out});
 return out;
}
const baseline=handlerModule(source);
const db=admin.firestore(),auth=admin.auth();
const account=id=>db.collection("accounts").doc(id);
const barcode="P213-DEMO-BARCODE";
const lockKey=crypto.createHash("sha256").update(barcode).digest("hex");
const request=(context)=>({auth:context.auth,data:{
 barcode,reason:"P213 local approval test only"}});
async function identity(id,emailVerified=true){
 const email=id+"@example.invalid",password="P213-Isolated-Emulator-Password-2026!";
 await auth.createUser({uid:id,email,password,emailVerified});
 const res=await fetch("http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({email,password,returnSecureToken:true})});
 assert.equal(res.status,200,"P213_AUTH_EMULATOR_SIGNIN");
 const json=await res.json();
 assert.equal(typeof json.idToken,"string");
 const claims=await auth.verifyIdToken(json.idToken);
 assert.equal(claims.uid,id);
 assert.equal(claims.email_verified,emailVerified);
 return {auth:{uid:claims.uid,token:{email_verified:claims.email_verified}},data:{}};
}
async function seed(id,ownerUid,withLock=true){
 await account(id).set({plan:"Free",period:"2026-11",used:0,reserved:0,
 ...(ownerUid===undefined?{}:{ownerUid})});
 if(withLock)await account(id).collection("barcodeLocks").doc(lockKey).set({
  operationId:"prior-p213-recording",status:"completed"});
}
async function denial(call,code="permission-denied"){
 let actual;
 try{await call()}catch(e){actual=e}
 assert(actual,"P213_BASELINE_UNAUTHORIZED_REQUEST_NOT_DENIED");
 assert.equal(actual.code,code,"P213_UNEXPECTED_DENIAL_TYPE");
}
async function approvalCount(id){
 return (await account(id).collection("duplicateApprovals").get()).size;
}
function mutant(name,from,to){
 const times=source.split(from).length-1;
 assert.equal(times,1,"P213_MUTATION_CONTEXT_NOT_EXACT_"+name);
 const text=source.replace(from,to);
 assert.notEqual(text,source);
 return handlerModule(text);
}
const ownerGuard='if(!snap.exists||snap.data().ownerUid!==id)throw new HttpsError("permission-denied","Explicit account owner required");';
const dupGuard='if(!aSnap.exists||aSnap.data().ownerUid!==accountId)throw new HttpsError("permission-denied","Explicit account owner required");';
const verifiedGuard='if(req.auth.token.email_verified!==true)throw new HttpsError("permission-denied","Verify your email");';
const createdOwner='ref.create({ownerUid:id,plan:"Free"';
let pass=0;async function test(name,fn){
 await fn();pass++;console.log("P213_"+name+"=PASS");
}
(async()=>{
 await test("EXACT_SOURCE_HASH_AND_REAL_HANDLER_LOAD",async()=>{
  assert.equal(crypto.createHash("sha256").update(source).digest("hex"),EXPECTED_CANDIDATE);
  assert.equal(typeof baseline.authorizeDuplicate,"function");
 });
 const legacy=await identity("p213-legacy");
 const foreign=await identity("p213-foreign");
 const owner=await identity("p213-owner");
 const unverified=await identity("p213-unverified",false);
 const fresh=await identity("p213-fresh");
 await seed(legacy.auth.uid,undefined);
 await seed(foreign.auth.uid,owner.auth.uid);
 await seed(owner.auth.uid,owner.auth.uid);
 await seed(unverified.auth.uid,unverified.auth.uid);
 await test("REAL_FIREBASE_AUTH_EMULATOR_CONTEXTS",async()=>{
  assert.equal(owner.auth.token.email_verified,true);
  assert.equal(unverified.auth.token.email_verified,false);
 });
 await test("BASELINE_LEGACY_ROLE_DENY",async()=>denial(()=>baseline.accountRole(legacy)));
 await test("BASELINE_FOREIGN_ROLE_DENY",async()=>denial(()=>baseline.accountRole(foreign)));
 await test("BASELINE_UNVERIFIED_ROLE_DENY",async()=>denial(()=>baseline.accountRole(unverified)));
 await test("BASELINE_LEGACY_DUPLICATE_DENY",async()=>denial(()=>baseline.authorizeDuplicate(request(legacy))));
 await test("BASELINE_FOREIGN_DUPLICATE_DENY",async()=>denial(()=>baseline.authorizeDuplicate(request(foreign))));
 await test("BASELINE_NO_LEGACY_OWNER_AUTOBACKFILL",async()=>{
  assert.equal((await account(legacy.auth.uid).get()).data().ownerUid,undefined);
  assert.equal(await approvalCount(legacy.auth.uid),0);
 });
 await test("BASELINE_NO_FOREIGN_OWNER_APPROVAL",async()=>{
  assert.equal(await approvalCount(foreign.auth.uid),0);
 });
 await test("BASELINE_OWNER_DUPLICATE_ACCEPT",async()=>{
  const r=await baseline.authorizeDuplicate(request(owner));
  assert.equal(typeof r.approvalId,"string");assert.equal(await approvalCount(owner.auth.uid),1);
 });
 await test("BASELINE_MISSING_ACCOUNT_ROLE_DENIED_NO_CREATE",async()=>{
  await denial(()=>baseline.accountRole(fresh));
  assert.equal((await account(fresh.auth.uid).get()).exists,false);
 });
 let killed=0;
 async function kill(name,fn){
  await test("MUTANT_"+name+"_KILLED",async()=>{await fn();killed++});
 }
 await kill("ACCOUNT_ROLE_MISSING_OWNER_CHECK",async()=>{
  const m=mutant("role-missing",ownerGuard,ownerGuard.replace(
   'if(!snap.exists||snap.data().ownerUid!==id)','if(!snap.exists)'));
  const role=await m.accountRole(legacy);
  assert.equal(role.role,"admin");
  assert.equal((await account(legacy.auth.uid).get()).data().ownerUid,undefined);
 });
 await kill("ACCOUNT_ROLE_FOREIGN_OWNER_CHECK",async()=>{
  const m=mutant("role-foreign",ownerGuard,ownerGuard.replace(
   'if(!snap.exists||snap.data().ownerUid!==id)','if(!snap.exists)'));
  const role=await m.accountRole(foreign);
  assert.equal(role.role,"admin");
 });
 await kill("ACCOUNT_ROLE_LEGACY_TRUTHY_BYPASS",async()=>{
  const m=mutant("role-truthy",ownerGuard,ownerGuard.replace(
   'snap.data().ownerUid!==id','snap.data().ownerUid&&snap.data().ownerUid!==id'));
  assert.equal((await m.accountRole(legacy)).role,"admin");
 });
 await kill("DUPLICATE_MISSING_OWNER_CHECK",async()=>{
  const m=mutant("dup-missing",dupGuard,dupGuard.replace(
   'if(!aSnap.exists||aSnap.data().ownerUid!==accountId)','if(!aSnap.exists)'));
  const r=await m.authorizeDuplicate(request(legacy));
  assert.equal(typeof r.approvalId,"string");
  assert.equal(await approvalCount(legacy.auth.uid),1);
 });
 await kill("DUPLICATE_FOREIGN_OWNER_CHECK",async()=>{
  const m=mutant("dup-foreign",dupGuard,dupGuard.replace(
   'if(!aSnap.exists||aSnap.data().ownerUid!==accountId)','if(!aSnap.exists)'));
  const r=await m.authorizeDuplicate(request(foreign));
  assert.equal(typeof r.approvalId,"string");
  assert.equal(await approvalCount(foreign.auth.uid),1);
 });
 await kill("DUPLICATE_LEGACY_TRUTHY_BYPASS",async()=>{
  const m=mutant("dup-truthy",dupGuard,dupGuard.replace(
   'aSnap.data().ownerUid!==accountId','aSnap.data().ownerUid&&aSnap.data().ownerUid!==accountId'));
  const r=await m.authorizeDuplicate(request(legacy));
  assert.equal(typeof r.approvalId,"string");
  assert.equal(await approvalCount(legacy.auth.uid),2);
 });
 await kill("EMAIL_VERIFICATION_BYPASS",async()=>{
  const m=mutant("email-bypass",verifiedGuard,'if(false)throw new HttpsError("permission-denied","Verify your email");');
  assert.equal((await m.accountRole(unverified)).role,"admin");
 });
 await kill("NEW_OWNER_UID_OMITTED",async()=>{
  const m=mutant("create-no-owner",createdOwner,'ref.create({plan:"Free"');
  const result=await m.usageStatus(fresh);
  assert.equal(result.plan,"Free");
  const snap=await account(fresh.auth.uid).get();
  assert.equal(snap.exists,true);
  assert.equal(snap.data().ownerUid,undefined);
 });
 // A mutation is "killed" only because the authentic handler baseline denied
 // and its deliberately weakened variant performed an observable forbidden action.
 // No mutated code can ever be exported into functions/index.js or deployed.
 await test("BASELINE_OWNER_PROVENANCE_NOT_MUTATED_BY_MUTANTS",async()=>{
  assert.equal((await account(owner.auth.uid).get()).data().ownerUid,owner.auth.uid);
  assert.equal((await account(foreign.auth.uid).get()).data().ownerUid,owner.auth.uid);
 });
 assert.equal(killed,8);
 console.log("P213_AUTHZ_REAL_EMULATOR_MUTATIONS_DETECTED="+killed+"/8_PASS");
 console.log("P213_REAL_FIREBASE_AUTH_FIRESTORE_EMULATOR_FIXTURES="+pass+"/"+pass+"_PASS");
 console.log("P213_MUTATED_HANDLERS=DEMO_ONLY NEVER_DEPLOYED");
 console.log("P213_STAGING_RUNTIME_VERIFIED=FALSE APPCHECK=NOT_TESTED");
 console.log("P213_G02=NO_GO RELEASE=NO_GO_RELEASE PRODUCTION_WRITES=0");
})().catch(e=>{console.error("P213_BLOCK="+String(e?.message||"TEST_FAILURE").slice(0,160));process.exitCode=1})
 .finally(async()=>{try{await db.terminate()}catch{}try{await admin.app().delete()}catch{}});
