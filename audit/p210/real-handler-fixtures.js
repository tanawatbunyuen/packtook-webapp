"use strict";
/** G02 P210 — execute the actual isolated P188 candidate callable handlers
 * with in-memory Firestore/Auth mocks. ZERO cloud credentials/network.
 * This is NOT Firebase Auth/App Check runtime parity or production attestation.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),
 vm=require("node:vm"),crypto=require("node:crypto");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const source=fs.readFileSync(path.resolve(__dirname,"../p188/candidate-index.js"),"utf8");
assert.equal(crypto.createHash("sha256").update(source).digest("hex"),EXPECTED_CANDIDATE);
const snapshot=(id,value)=>({id,exists:value!==undefined,data:()=>value});
function harness(initial={}){
 const docs=new Map(Object.entries(initial)),operations=[],calls={accountReads:0};
 let nonce=0;
 const fieldValue={serverTimestamp:()=>({_type:"serverTimestamp"}),increment:x=>({_increment:x}),delete:()=>({_delete:true})};
 function ref(key){
  return {
   id:key.split("/").at(-1),key,
   async get(){calls.accountReads++;return snapshot(this.id,docs.get(key))},
   async create(data){if(docs.has(key)){const e=Error("exists");e.code=6;throw e;}
    docs.set(key,data);operations.push({type:"create",key});},
   collection(name){return collection(key+"/"+name)}
  };
 }
 function collection(prefix){
  return {
   doc(id){return ref(prefix+"/"+(id||"local"+(++nonce)))}
  };
 }
 const db={
  collection:collection,
  async runTransaction(callback){
   const tx={
    get:async r=>snapshot(r.id,docs.get(r.key)),
    create:(r,data)=>{if(docs.has(r.key))throw Error("exists");docs.set(r.key,data);operations.push({type:"tx.create",key:r.key});},
    update:(r,patch)=>{if(!docs.has(r.key))throw Error("missing");
     docs.set(r.key,{...docs.get(r.key),...patch});operations.push({type:"tx.update",key:r.key});},
    set:(r,data)=>{docs.set(r.key,data);operations.push({type:"tx.set",key:r.key});},
    delete:r=>{docs.delete(r.key);operations.push({type:"tx.delete",key:r.key});}
   };
   return callback(tx);
  }
 };
 const httpsError=class HttpsError extends Error{
  constructor(code,message){super(message);this.code=code;}
 };
 const mockedAdmin={initializeApp(){},firestore:()=>db,auth:()=>{throw Error("AUTH_NETWORK_CALL_FORBIDDEN")}};
 const mockRequire=name=>{
  if(name==="firebase-functions/v2/https")return {onCall:(options,handler)=>handler,
   onRequest:(options,handler)=>handler,HttpsError:httpsError};
  if(name==="firebase-functions/params")return {defineSecret:name=>({value:()=>{throw Error("SECRET_ACCESS_FORBIDDEN:"+name)}})};
  if(name==="firebase-admin")return mockedAdmin;
  if(name==="firebase-admin/firestore")return {FieldValue:fieldValue};
  if(name==="node:crypto")return crypto;
  if(name==="node:buffer")return require("node:buffer");
  throw Error("UNEXPECTED_MODULE:"+name);
 };
 const exports={},ctx={exports,module:{exports},require:mockRequire,Buffer,process:{env:{}},
  console:{log(){},error(){},warn(){}},Date,Promise,setTimeout:()=>{throw Error("TIMER_FORBIDDEN")},
  fetch:()=>{throw Error("NETWORK_FORBIDDEN")},URLSearchParams};
 vm.runInNewContext(source,ctx,{filename:"p188-pinned-candidate-index.js",timeout:1500});
 return {handlers:exports,docs,operations,calls};
}
const auth=(uid,verified=true)=>({auth:{uid,token:{email_verified:verified}},data:{}});
const uid="owner-123",account="accounts/"+uid;
const lock=(barcode="PKG-123")=>account+"/barcodeLocks/"+crypto.createHash("sha256").update(barcode).digest("hex");
const legacy=(ownerUid)=>({[account]:{plan:"Free",period:"2026-11",used:0,reserved:0,
  ...(ownerUid===undefined?{}:{ownerUid})},[lock()]:{status:"completed",operationId:"OLD-VIDEO"}});
const request=(barcode="PKG-123")=>({auth:{uid,token:{email_verified:true}},data:{barcode,reason:"Customer requested replay approval"}});
async function denied(fn,code="permission-denied"){
 let thrown;try{await fn();}catch(e){thrown=e}
 assert(thrown,"Expected thrown denial");assert.equal(thrown.code,code);
}
let n=0;
async function test(name,fn){await fn();n++;console.log("P210_"+name+"=PASS")}
(async()=>{
 await test("PINNED_P188_HASH",async()=>assert.equal(crypto.createHash("sha256").update(source).digest("hex"),EXPECTED_CANDIDATE));
 await test("REAL_CANDIDATE_CALLABLE_EXPORT_LOADED",async()=>{const h=harness();assert.equal(typeof h.handlers.accountRole,"function");assert.equal(typeof h.handlers.authorizeDuplicate,"function");assert.equal(typeof h.handlers.usageStatus,"function")});
 await test("OWNER_ROLE_GRANTED_WITH_EXPLICIT_OWNER_UID",async()=>{const h=harness(legacy(uid));const x=await h.handlers.accountRole(auth(uid));assert.equal(x.role,"admin");assert.equal(x.accountId,uid);assert.equal(h.operations.length,0)});
 await test("LEGACY_MISSING_OWNER_ROLE_DENIED_NO_WRITE",async()=>{const h=harness(legacy());await denied(()=>h.handlers.accountRole(auth(uid)));assert.equal(h.operations.length,0);assert.equal(h.docs.get(account).ownerUid,undefined)});
 await test("FOREIGN_OWNER_ROLE_DENIED_NO_WRITE",async()=>{const h=harness(legacy("someone-else"));await denied(()=>h.handlers.accountRole(auth(uid)));assert.equal(h.operations.length,0)});
 await test("MISSING_ACCOUNT_ROLE_DENIED_NO_CREATE",async()=>{const h=harness();await denied(()=>h.handlers.accountRole(auth(uid)));assert.equal(h.docs.has(account),false);assert.equal(h.operations.length,0)});
 await test("NO_AUTH_ROLE_DENIED",async()=>{const h=harness(legacy(uid));await denied(()=>h.handlers.accountRole({data:{}}),"unauthenticated");assert.equal(h.operations.length,0)});
 await test("UNVERIFIED_EMAIL_ROLE_DENIED",async()=>{const h=harness(legacy(uid));await denied(()=>h.handlers.accountRole(auth(uid,false)));assert.equal(h.operations.length,0)});
 await test("DUPLICATE_EXPLICIT_OWNER_SUCCEEDS",async()=>{const h=harness(legacy(uid));const x=await h.handlers.authorizeDuplicate(request());assert(x.approvalId);assert(h.operations.some(x=>x.type==="tx.create"));assert(!h.operations.some(x=>x.type==="tx.update"&&x.key===account))});
 await test("DUPLICATE_LEGACY_MISSING_OWNER_DENIED_NO_WRITE",async()=>{const h=harness(legacy());await denied(()=>h.handlers.authorizeDuplicate(request()));assert.equal(h.operations.length,0);assert.equal(h.docs.get(account).ownerUid,undefined)});
 await test("DUPLICATE_FOREIGN_OWNER_DENIED_NO_WRITE",async()=>{const h=harness(legacy("somebody-else"));await denied(()=>h.handlers.authorizeDuplicate(request()));assert.equal(h.operations.length,0)});
 await test("DUPLICATE_MISSING_ACCOUNT_DENIED_NO_WRITE",async()=>{const h=harness({[lock()]:{status:"completed",operationId:"OLD-VIDEO"}});await denied(()=>h.handlers.authorizeDuplicate(request()));assert.equal(h.operations.length,0)});
 await test("DUPLICATE_MISSING_LOCK_DENIED_NO_WRITE",async()=>{const h=harness({[account]:{plan:"Free",ownerUid:uid}});await denied(()=>h.handlers.authorizeDuplicate(request()),"failed-precondition");assert.equal(h.operations.length,0)});
 await test("DUPLICATE_SHORT_REASON_DENIED",async()=>{const h=harness(legacy(uid));const r=request();r.data.reason="short";await denied(()=>h.handlers.authorizeDuplicate(r),"invalid-argument");assert.equal(h.operations.length,0)});
 await test("DUPLICATE_UNAUTH_DENIED_NO_WRITE",async()=>{const h=harness(legacy(uid));await denied(()=>h.handlers.authorizeDuplicate({data:request().data}),"unauthenticated");assert.equal(h.operations.length,0)});
 await test("ACCOUNT_AUTO_CREATE_SETS_EXPLICIT_OWNER_UID",async()=>{const h=harness();const r=await h.handlers.usageStatus(auth(uid));assert.equal(r.plan,"Free");assert.equal(h.docs.get(account).ownerUid,uid);assert.equal(h.operations.filter(x=>x.type==="create").length,1)});
 await test("ACCOUNT_EXISTING_LEGACY_NOT_AUTO_BACKFILLED",async()=>{const h=harness(legacy());await h.handlers.usageStatus(auth(uid));assert.equal(h.docs.get(account).ownerUid,undefined);assert.equal(h.operations.length,0)});
 await test("ACCOUNT_ANOTHER_USER_DOES_NOT_TOUCH_OWNER",async()=>{const h=harness(legacy(uid));await h.handlers.usageStatus(auth("another-uid"));assert.equal(h.docs.get(account).ownerUid,uid);assert.equal(h.docs.get("accounts/another-uid").ownerUid,"another-uid")});
 await test("NO_REAL_NETWORK_OR_CLOUD_WRITES",async()=>{const h=harness(legacy(uid));await h.handlers.accountRole(auth(uid));assert.equal(h.operations.length,0)});
 console.log("P210_G02_REAL_CANDIDATE_HANDLER_IN_MEMORY_FIXTURES="+n+"/"+n+"_PASS");
 console.log("P210_FIRESTORE=IN_MEMORY_ONLY AUTH=MOCK ONLY APP_CHECK=NOT_TESTED");
 console.log("P210_G02=NO_GO_RELEASE PRODUCTION_WRITES=0 CLOUD_CALLS=0");
})().catch(e=>{console.error("P210_BLOCK="+(e.message||"TEST_FAILED"));process.exitCode=1});
