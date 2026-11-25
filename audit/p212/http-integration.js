"use strict";
/** P212: actual Firebase Functions v2 callable HTTP wrapper and Firebase Auth +
 * Firestore emulators. LOCAL DEMO ONLY. Source is exact pinned P188 candidate.
 * Diagnostics preserve G03 403-vs-401 issue; no remapping of a failed protocol.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),
 crypto=require("node:crypto"),http=require("node:http"),vm=require("node:vm"),
 {createRequire}=require("node:module");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const demo="demo-packtook-p184";
for(const [name,want] of Object.entries({
 GCLOUD_PROJECT:demo,GOOGLE_CLOUD_PROJECT:demo,
 FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080",
 FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:19099",CI:"true"}))
 if(process.env[name]!==want)throw Error("P212_DEMO_ENV_REQUIRED_"+name);
const candidate=fs.readFileSync(path.resolve(__dirname,"../p188/candidate-index.js"),"utf8");
assert.equal(crypto.createHash("sha256").update(candidate).digest("hex"),EXPECTED_CANDIDATE);
const reqFns=createRequire(path.resolve(__dirname,"../../functions/index.js"));
const sdk=reqFns("firebase-functions/v2/https");
const express=reqFns("express"),admin=reqFns("firebase-admin");
const modules=name=>{
 if(name==="firebase-functions/v2/https")return sdk; // ACTUAL Firebase callable onCall wrapper
 if(name==="firebase-functions/params")return {defineSecret:()=>({value(){throw Error("P212_SECRET_FORBIDDEN")}})};
 if(name==="firebase-admin")return admin;
 if(name==="firebase-admin/firestore")return reqFns("firebase-admin/firestore");
 if(name==="node:crypto")return crypto;
 throw Error("P212_IMPORT_BLOCKED_"+name);
};
const handlers={};
vm.compileFunction(candidate,["exports","require","module"],
 {filename:"p212-exact-p188-candidate.js"})(handlers,modules,{exports:handlers});
const db=admin.firestore(),auth=admin.auth();
const uid={owner:"p212-owner",legacy:"p212-legacy",foreign:"p212-foreign",unverified:"p212-unverified",fresh:"p212-fresh"};
const account=key=>db.collection("accounts").doc(uid[key]);
const barcode="P212-ONLY-LOCAL-BARCODE";
const hashed=crypto.createHash("sha256").update(barcode).digest("hex");
const reqBody=(data={})=>JSON.stringify({data});
const httpServer=express();
httpServer.use(express.json({verify(req,res,buf){req.rawBody=buf}}));
httpServer.post("/accountRole",handlers.accountRole);
httpServer.post("/authorizeDuplicate",handlers.authorizeDuplicate);
httpServer.post("/usageStatus",handlers.usageStatus);
const server=http.createServer(httpServer);
let started=false;
const base="http://127.0.0.1:18777";
const statusCounts={};
function checkResult(r){
 if(![200,400,401,403,404,429,500,503].includes(r.httpStatus))
  throw Error("P212_UNEXPECTED_HTTP_STATUS");
 if(r.httpStatus!==200&&!r.errorStatus)
  throw Error("P212_HTTP_ERROR_BODY_MISSING");
}
async function call(route,token,data={},kind="VALID"){
 const response=await fetch(base+"/"+route,{
  method:"POST",headers:{"Content-Type":"application/json",
   ...(token!==null?{Authorization:"Bearer "+token}:{})},
  body:reqBody(data)});
 const body=await response.json();
 const result={httpStatus:response.status,errorStatus:body?.error?.status||null,
  data:body?.result||null,hasError:!!body?.error};
 checkResult(result);
 statusCounts[kind+":"+route+":"+response.status]=(statusCounts[kind+":"+route+":"+response.status]||0)+1;
 return result;
}
async function authToken(key,verified=true){
 const email=uid[key]+"@example.invalid",password="P212-Emulator-Only-Password-2026!";
 await auth.createUser({uid:uid[key],email,emailVerified:verified,password});
 const res=await fetch("http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=dummy",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({email,password,returnSecureToken:true})});
 assert.equal(res.status,200,"P212_AUTH_SIGNIN_FAILED");
 const json=await res.json();assert(typeof json.idToken==="string");
 const decoded=await auth.verifyIdToken(json.idToken);
 assert.equal(decoded.uid,uid[key]);assert.equal(decoded.email_verified,verified);
 return json.idToken; // token never logged
}
const seed=async(key,ownerValue)=>{
 await account(key).set({plan:"Free",period:"2026-11",used:0,reserved:0,
 ...(ownerValue===undefined?{}:{ownerUid:ownerValue})});
};
const barcodeLock=key=>account(key).collection("barcodeLocks").doc(hashed);
const approve=()=>({barcode,reason:"Approved only for local negative security test"});
const expectDenied=(r)=>{assert.notEqual(r.httpStatus,200);assert.equal(r.hasError,true)};
const expectAllowed=r=>{assert.equal(r.httpStatus,200);assert.equal(r.hasError,false)};
let pass=0;async function test(name,fn){await fn();pass++;console.log("P212_"+name+"=PASS")}
async function main(){
 await new Promise((resolve,reject)=>{
  server.once("error",reject);
  server.listen(18777,"127.0.0.1",resolve);
 });started=true;
 await test("EXACT_P188_CANDIDATE_SHA",async()=>assert.equal(crypto.createHash("sha256").update(candidate).digest("hex"),EXPECTED_CANDIDATE));
 await test("ACTUAL_FIREBASE_V2_ONCALL_WRAPPER_USED",async()=>assert.equal(typeof handlers.accountRole,"function"));
 await test("REAL_LOCAL_AUTH_FIRESTORE_ACTIVE",async()=>assert.equal((await db.collection("p212_probe").doc("not-there").get()).exists,false));
 const tokens={};
 for(const key of Object.keys(uid))tokens[key]=await authToken(key,key!=="unverified");
 await test("AUTH_EMULATOR_ISSUED_VERIFIABLE_TOKENS",async()=>assert(Object.keys(tokens).length===5));
 await seed("owner",uid.owner);await barcodeLock("owner").set({status:"completed",operationId:"prior-p212"});
 await seed("legacy");await barcodeLock("legacy").set({status:"completed",operationId:"prior-p212"});
 await seed("foreign",uid.owner);await barcodeLock("foreign").set({status:"completed",operationId:"prior-p212"});
 await seed("unverified",uid.unverified);
 await test("OWNER_ROLE_HTTP_200",async()=>{const x=await call("accountRole",tokens.owner);expectAllowed(x);assert.equal(x.data.role,"admin")});
 await test("LEGACY_ROLE_HTTP_DENIED",async()=>expectDenied(await call("accountRole",tokens.legacy)));
 await test("LEGACY_NO_OWNER_BACKFILL",async()=>assert.equal((await account("legacy").get()).data().ownerUid,undefined));
 await test("FOREIGN_OWNER_ROLE_HTTP_DENIED",async()=>expectDenied(await call("accountRole",tokens.foreign)));
 await test("NO_BEARER_ACCOUNT_ROLE_DENIED",async()=>expectDenied(await call("accountRole",null,{},"NO_TOKEN")));
 await test("BAD_BEARER_ACCOUNT_ROLE_DENIED",async()=>expectDenied(await call("accountRole","invalid.test.token",{},"INVALID_TOKEN")));
 await test("UNVERIFIED_EMAIL_HTTP_DENIED",async()=>expectDenied(await call("accountRole",tokens.unverified)));
 await test("FRESH_ACCOUNT_ROLE_DENIED_NO_CREATE",async()=>{expectDenied(await call("accountRole",tokens.fresh));assert.equal((await account("fresh").get()).exists,false)});
 await test("OWNER_DUPLICATE_HTTP_ACCEPTED",async()=>{const x=await call("authorizeDuplicate",tokens.owner,approve());expectAllowed(x);assert.equal(typeof x.data.approvalId,"string")});
 await test("LEGACY_DUPLICATE_HTTP_DENIED",async()=>expectDenied(await call("authorizeDuplicate",tokens.legacy,approve())));
 await test("LEGACY_DUPLICATE_NO_APPROVAL_OR_BACKFILL",async()=>{assert.equal((await account("legacy").get()).data().ownerUid,undefined);assert.equal((await account("legacy").collection("duplicateApprovals").get()).size,0)});
 await test("FOREIGN_OWNER_DUPLICATE_HTTP_DENIED",async()=>expectDenied(await call("authorizeDuplicate",tokens.foreign,approve())));
 await test("FOREIGN_DUPLICATE_NO_APPROVAL",async()=>assert.equal((await account("foreign").collection("duplicateApprovals").get()).size,0));
 await test("INVALID_REASON_HTTP_DENIED",async()=>expectDenied(await call("authorizeDuplicate",tokens.owner,{barcode,reason:"no"})));
 await test("NO_BEARER_DUPLICATE_DENIED",async()=>expectDenied(await call("authorizeDuplicate",null,approve(),"NO_TOKEN")));
 // usageStatus is explicitly enforceAppCheck:true. This HTTP test intentionally has
 // no real App Check token, so verified Firebase Auth token MUST NOT bypass App Check.
 // Do NOT disable enforcement or misreport blocked positive as a functional pass.
 await test("USAGE_STATUS_VALID_AUTH_NO_APPCHECK_DENIED",async()=>{
  const x=await call("usageStatus",tokens.fresh,{},"MISSING_APPCHECK");
  expectDenied(x);assert.equal((await account("fresh").get()).exists,false);
 });
 await test("USAGE_STATUS_LEGACY_NO_APPCHECK_NO_BACKFILL",async()=>{
  const x=await call("usageStatus",tokens.legacy,{},"MISSING_APPCHECK");
  expectDenied(x);assert.equal((await account("legacy").get()).data().ownerUid,undefined);
 });
 await test("HTTP_MALFORMED_ENVELOPE_REJECTED",async()=>{
  const response=await fetch(base+"/accountRole",{method:"POST",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+tokens.owner},
   body:JSON.stringify({wrong:true})});
  assert.notEqual(response.status,200);
 });
 await test("UNAUTHORIZED_CASES_PRESERVED_TENANT",async()=>{assert.equal((await account("owner").get()).data().ownerUid,uid.owner);assert.equal((await account("foreign").get()).data().ownerUid,uid.owner)});
 // Diagnoses provider protocol difference without making 403 into a fake 401 PASS.
 const invalidStatuses=Object.entries(statusCounts).filter(([k])=>k.startsWith("INVALID_TOKEN:"));
 const noTokenStatuses=Object.entries(statusCounts).filter(([k])=>k.startsWith("NO_TOKEN:"));
 console.log("P212_INVALID_TOKEN_HTTP_STATUS_OBSERVED="+invalidStatuses.map(([k])=>k.split(":").at(-1)).join(","));
 console.log("P212_MISSING_TOKEN_HTTP_STATUS_OBSERVED="+noTokenStatuses.map(([k])=>k.split(":").at(-1)).join(","));
 console.log("P212_VALID_AUTH_WITHOUT_APPCHECK=BLOCKED_NOT_BYPASSED");
 console.log("P212_STRICT_G03_401_EXPECTATION="+(invalidStatuses.every(([k])=>k.endsWith(":401"))?"PASS_FOR_THIS_LOCAL_TEST":"NOT_CONFIRMED_OR_MISMATCH"));
 console.log("P212_REAL_CALLABLE_HTTP_FIREBASE_EMULATOR_TESTS="+pass+"/"+pass+"_PASS");
 console.log("P212_FIREBASE_AUTH=EMULATOR FIRESTORE=EMULATOR FUNCTIONS_WRAPPER=SDK_ONCALL_LOCAL_EXPRESS");
 console.log("P212_APPCHECK=NOT_TESTED STAGING=NOT_TESTED PRODUCTION=NOT_TOUCHED");
 console.log("P212_G02=NO_GO G03=NO_GO RELEASE=NO_GO_RELEASE");
}
main().catch(e=>{console.error("P212_BLOCK="+(String(e?.message||"HTTP_TEST_FAILURE")).slice(0,160));process.exitCode=1})
 .finally(async()=>{try{if(started)await new Promise(resolve=>server.close(resolve))}catch{}
  try{await db.terminate()}catch{}try{await admin.app().delete()}catch{}});
