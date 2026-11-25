"use strict";
/**
 * P211: Actual Firebase Auth + Firestore emulators, actual isolated P188 handlers.
 * Real Firebase Admin SDK against demo-only emulators; onCall wrappers are
 * replaced to invoke handler directly, NOT a deployed callable HTTP runtime.
 * No production access, no Firebase App Check, no cloud credentials.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),vm=require("node:vm");
const {createRequire}=require("node:module");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const project="demo-packtook-p184";
if(process.env.GCLOUD_PROJECT!==project||
   process.env.GOOGLE_CLOUD_PROJECT!==project||
   process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||
   process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099"||
   process.env.CI!=="true"){
 throw Error("P211_EMULATOR_AND_CI_ENV_REQUIRED");
}
const generated=fs.readFileSync(path.resolve(__dirname,"../p188/candidate-index.js"),"utf8");
assert.equal(crypto.createHash("sha256").update(generated).digest("hex"),EXPECTED_CANDIDATE);
const requireFns=createRequire(path.resolve(__dirname,"../../functions/index.js"));
const admin=requireFns("firebase-admin");
const firebaseFields=requireFns("firebase-admin/firestore");
const HttpsError=class HttpsError extends Error{constructor(code,message){super(message);this.code=code}};
const noSecret=name=>({value:()=>{throw Error("P211_SECRET_ACCESS_FORBIDDEN_"+name)}});
const mockRequire=(name)=>{
 if(name==="firebase-functions/v2/https")
  return {onCall:(options,handler)=>handler,onRequest:(options,handler)=>handler,HttpsError};
 if(name==="firebase-functions/params")return {defineSecret:noSecret};
 if(name==="firebase-admin")return admin;
 if(name==="firebase-admin/firestore")return firebaseFields;
 if(name==="node:crypto")return crypto;
 throw Error("P211_UNEXPECTED_MODULE_"+name);
};
const handlers={};
// Firebase Firestore Transaction verifies callback Promise instanceof host Promise.
// vm.runInNewContext gives async handlers a foreign Promise realm and fails there.
// compileFunction (without parsingContext) uses host Promise realm for real SDK transactions.
// Candidate bytes are SHA256-pinned, module imports strictly allowlisted, demo emulators only.
const executePinnedCandidate=vm.compileFunction(generated,["exports","require","module"],
 {filename:"p188-pin-emulator-real-handlers.js"});
executePinnedCandidate(handlers,mockRequire,{exports:handlers});
const db=admin.firestore(),auth=admin.auth();
const FIXTURE_ACCOUNTS=["p211-owner","p211-foreign","p211-legacy","p211-unverified","p211-new"];
const account=uid=>db.collection("accounts").doc(uid);
const barcode="P211-BARCODE";
const lockKey=crypto.createHash("sha256").update(barcode).digest("hex");
const lock=uid=>account(uid).collection("barcodeLocks").doc(lockKey);
async function emulatorToken(uid,emailVerified=true){
 const email=uid+"@example.invalid";
 const pw="P211-Auth-only-Test-Password-2026!";
 try{await auth.createUser({uid,email,password:pw,emailVerified})}
 catch(e){if(e.code!=="auth/uid-already-exists")throw e}
 // Direct Auth emulator REST, no token logged, localhost only.
 const response=await fetch("http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email,password:pw,returnSecureToken:true})
 });
 assert.equal(response.status,200,"AUTH_EMULATOR_SIGN_IN_FAILED");
 const data=await response.json();
 assert.equal(typeof data.idToken,"string");
 const verified=await auth.verifyIdToken(data.idToken);
 assert.equal(verified.uid,uid);
 assert.equal(verified.email_verified,emailVerified);
 // Return only decoded *request context*, never the raw token.
 return {auth:{uid:verified.uid,token:{email_verified:verified.email_verified}},data:{}};
}
function call(ctx,data={}){return {auth:ctx?.auth,data}}
async function deny(fn,code="permission-denied"){
 let err;try{await fn()}catch(e){err=e}
 assert(err,"Expected denied Firebase handler");
 assert.equal(err.code,code);
}
async function seedAccount(uid,ownerUid){
 await account(uid).set({plan:"Free",period:"2026-11",used:0,reserved:0,
 ...(ownerUid===undefined?{}:{ownerUid})});
}
async function seedLock(uid){await lock(uid).set({operationId:"prior-p211-operation",status:"completed"})}
async function noneWritten(uid){
 const result=await account(uid).get();
 assert.equal(result.exists,true);
 return result.data();
}
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log("P211_"+name+"=PASS")};
(async()=>{
 await test("EXACT_P188_PINNED_CANDIDATE",async()=>assert.equal(crypto.createHash("sha256").update(generated).digest("hex"),EXPECTED_CANDIDATE));
 await test("REAL_FIREBASE_ADMIN_SDK_EMULATOR_ACTIVE",async()=>{const t=await db.collection("p211Probe").doc("readonlyscope").get();assert.equal(t.exists,false)});
 await test("ACTUAL_P188_HANDLERS_LOADED",async()=>{assert.equal(typeof handlers.accountRole,"function");assert.equal(typeof handlers.authorizeDuplicate,"function");assert.equal(typeof handlers.usageStatus,"function")});
 const owner=await emulatorToken("p211-owner");
 const foreign=await emulatorToken("p211-foreign");
 const legacy=await emulatorToken("p211-legacy");
 const unverified=await emulatorToken("p211-unverified",false);
 const fresh=await emulatorToken("p211-new");
 await test("REAL_AUTH_EMULATOR_TOKENS_VERIFIED",async()=>assert.equal(owner.auth.token.email_verified,true));
 await seedAccount("p211-owner","p211-owner");await seedLock("p211-owner");
 await seedAccount("p211-legacy",undefined);await seedLock("p211-legacy");
 await seedAccount("p211-foreign","p211-owner");await seedLock("p211-foreign");
 await seedAccount("p211-unverified","p211-unverified");
 await test("EXPLICIT_OWNER_ROLE_SUCCESS",async()=>{const x=await handlers.accountRole(call(owner));assert.equal(x.role,"admin");assert.equal(x.accountId,"p211-owner")});
 await test("LEGACY_ROLE_DENIED",async()=>await deny(()=>handlers.accountRole(call(legacy))));
 await test("LEGACY_ROLE_NO_OWNER_BACKFILL",async()=>assert.equal((await noneWritten("p211-legacy")).ownerUid,undefined));
 await test("FOREIGN_OWNER_ROLE_DENIED",async()=>await deny(()=>handlers.accountRole(call(foreign))));
 await test("UNVERIFIED_EMAIL_DENIED",async()=>await deny(()=>handlers.accountRole(call(unverified)),"permission-denied"));
 await test("NO_AUTH_TOKEN_DENIED",async()=>await deny(()=>handlers.accountRole({data:{}}),"unauthenticated"));
 await test("MISSING_ACCOUNT_ROLE_DENIED_NO_CREATE",async()=>{await deny(()=>handlers.accountRole(call(fresh)));assert.equal((await account("p211-new").get()).exists,false)});
 const approval=()=>({barcode,reason:"Valid distinct reason for approval"});
 await test("DUPLICATE_OWNER_WRITES_REAL_EMULATOR",async()=>{const r=await handlers.authorizeDuplicate(call(owner,approval()));assert.equal(typeof r.approvalId,"string");const a=await account("p211-owner").collection("duplicateApprovals").doc(r.approvalId).get();assert.equal(a.exists,true);assert.equal(a.data().approvedBy,"p211-owner")});
 await test("DUPLICATE_LEGACY_DENIED",async()=>await deny(()=>handlers.authorizeDuplicate(call(legacy,approval()))));
 await test("DUPLICATE_LEGACY_NO_BACKFILL",async()=>{const a=await account("p211-legacy").get();assert.equal(a.data().ownerUid,undefined);const z=await account("p211-legacy").collection("duplicateApprovals").get();assert.equal(z.size,0)});
 await test("DUPLICATE_FOREIGN_OWNER_DENIED",async()=>await deny(()=>handlers.authorizeDuplicate(call(foreign,approval()))));
 await test("DUPLICATE_FOREIGN_OWNER_NO_APPROVAL",async()=>{const z=await account("p211-foreign").collection("duplicateApprovals").get();assert.equal(z.size,0)});
 await test("DUPLICATE_UNVERIFIED_EMAIL_DENIED",async()=>await deny(()=>handlers.authorizeDuplicate(call(unverified,approval()))));
 await test("DUPLICATE_SHORT_REASON_DENIED",async()=>await deny(()=>handlers.authorizeDuplicate(call(owner,{barcode,reason:"no"})),"invalid-argument"));
 await test("DUPLICATE_MISSING_AUTH_DENIED",async()=>await deny(()=>handlers.authorizeDuplicate({data:approval()}),"unauthenticated"));
 await test("NEW_ACCOUNT_OWNER_UID_CREATED_ONCE",async()=>{const r=await handlers.usageStatus(call(fresh));assert.equal(r.plan,"Free");assert.equal((await account("p211-new").get()).data().ownerUid,"p211-new")});
 await test("NEW_ACCOUNT_CREATE_IDEMPOTENT",async()=>{await handlers.usageStatus(call(fresh));assert.equal((await account("p211-new").get()).data().ownerUid,"p211-new")});
 await test("LEGACY_USAGE_STATUS_NO_OWNER_BACKFILL",async()=>{await handlers.usageStatus(call(legacy));assert.equal((await account("p211-legacy").get()).data().ownerUid,undefined)});
 await test("NO_CROSS_TENANT_OWNER_ESCALATION",async()=>{assert.equal((await account("p211-owner").get()).data().ownerUid,"p211-owner");assert.equal((await account("p211-foreign").get()).data().ownerUid,"p211-owner")});
 console.log("P211_REAL_AUTH_FIRESTORE_EMULATOR_HANDLER_TESTS="+passed+"/"+passed+"_PASS");
 console.log("P211_FIREBASE_AUTH=EMULATOR_VERIFIED_TOKEN FIRESTORE=REAL_EMULATOR");
 console.log("P211_CALLABLE_HTTP_WRAPPER=NOT_EXERCISED APPCHECK=NOT_TESTED");
 console.log("P211_G02=NO_GO_RELEASE CLOUD_CALLS=0 PRODUCTION_WRITES=0");
})().catch(e=>{console.error("P211_BLOCK="+(typeof e?.message==="string"?e.message.slice(0,140):"EMULATOR_TEST_FAILED"));process.exitCode=1}).finally(async()=>{
 try{await Promise.all([db.terminate(),admin.app().delete()])}catch{}
});
