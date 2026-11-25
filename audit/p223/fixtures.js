"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"probe/index.js"),"utf8");
let onRequestOpts=null;
const state={named:"NOT_FOUND",default:"DENIED",calls:[],initProject:null};
const admin={
 apps:[],
 initializeApp(o){state.initProject=o.projectId;const app={projectId:o.projectId};this.apps.push(app);return app},
 app(){return this.apps[0]}
};
const getFirestore=(app,id)=>{
 assert.equal(app,admin.apps[0]);
 return {collection(collection){
  assert.equal(collection,"__g02_iam_boundary_probe__");
  return {doc(documentId){
   assert.match(documentId,/^p223_missing_[a-f0-9]{32}$/);
   return {async get(){
    state.calls.push({id,collection});
    const v=id==="g02-security-test"?state.named:state.default;
    if(v==="DENIED")throw Object.assign(new Error("DENIED_PRIVATE"),{code:7});
    if(v==="PERMISSION_DENIED_STRING")throw Object.assign(new Error("DENIED_PRIVATE"),{code:"PERMISSION_DENIED"});
    if(v==="OTHER_ERROR")throw Object.assign(new Error("OPAQUE"),{code:14});
    return {exists:v==="EXISTS"};
   }};
  }};
 }};
};
const modules=n=>{
 if(n==="firebase-functions/v2/https")return {onRequest:(opt,handler)=>{onRequestOpts=opt;return handler}};
 if(n==="firebase-admin")return admin;
 if(n==="firebase-admin/firestore")return {getFirestore};
 if(n==="node:crypto")return {randomUUID:()=>"11111111-2222-4333-8444-555555555555"};
 throw Error("UNEXPECTED_IMPORT_"+n);
};
const out={};
vm.compileFunction(source,["exports","require"])(out,modules);
const handler=out.g02IamBoundaryProbe;
function invoke(method="GET"){
 const r={statusCode:null,body:null,headers:{},status(code){this.statusCode=code;return this},
 set(key,val){this.headers[key]=val;return this},json(data){this.body=data;return this}};
 return handler({method},r).then(()=>r);
}
let n=0;
async function t(name,fn){await fn();n++;console.log("P223_"+name+"=PASS")}
(async()=>{
 await t("SINGLE_EXPORTED_HANDLER",()=>assert.deepEqual(Object.keys(out),["g02IamBoundaryProbe"]));
 await t("EXACT_PROJECT_PIN",()=>assert.equal(state.initProject,"packtook-staging"));
 await t("PRIVATE_INVOCATION",()=>assert.equal(onRequestOpts.invoker,"private"));
 await t("SINGLE_INSTANCE",()=>assert.equal(onRequestOpts.maxInstances,1));
 await t("SHORT_TIMEOUT",()=>assert.equal(onRequestOpts.timeoutSeconds,15));
 await t("STAGING_REGION",()=>assert.equal(onRequestOpts.region,"asia-southeast1"));
 await t("NO_WRITE_METHODS",()=>assert(!/(?:safeDb|defaultDb|db|ref|snapshot)\.(?:set|update|create|delete|add|runTransaction)\(/.test(source)));
 await t("NO_REQUEST_TARGET_DOCUMENT",()=>assert(!source.includes("req.query")&&!source.includes("req.body")));
 const successful=await invoke();
 await t("NAMED_READ_ALLOWED_DEFAULT_DENIED",()=>assert.equal(successful.statusCode,200));
 await t("SUMMARY_PASS",()=>assert.equal(successful.body.result,"PASS"));
 await t("NAMED_STATUS",()=>assert.equal(successful.body.namedDatabase,"ALLOWED_NOT_FOUND"));
 await t("DEFAULT_DENIAL",()=>assert.equal(successful.body.defaultDatabase,"PERMISSION_DENIED"));
 await t("NO_CACHE",()=>assert.equal(successful.headers["Cache-Control"],"no-store"));
 await t("TWO_DATABASE_READS_ONLY",()=>assert.deepEqual(state.calls.map(x=>x.id).sort(),["(default)","g02-security-test"]));
 await t("NO_CLIENT_DOC_COLLECTION",()=>assert(state.calls.every(x=>x.collection==="__g02_iam_boundary_probe__")));
 state.calls=[];state.default="NOT_FOUND";
 const defaultAllowed=await invoke();
 await t("FAIL_IF_DEFAULT_READ_ALLOWED",()=>assert.equal(defaultAllowed.statusCode,503));
 await t("DEFAULT_ACCESS_NOT_HIDDEN",()=>assert.equal(defaultAllowed.body.defaultDatabase,"ALLOWED_NOT_FOUND"));
 state.default="OTHER_ERROR";
 await t("FAIL_ON_UNKNOWN_DEFAULT_ERROR",()=>assert.equal((await invoke()).statusCode,503));
 state.default="DENIED";state.named="DENIED";
 await t("FAIL_IF_NAMED_PERMISSION_DENIED",()=>assert.equal((await invoke()).statusCode,503));
 state.named="EXISTS";
 await t("FAIL_IF_TEST_DOC_EXISTS",()=>assert.equal((await invoke()).statusCode,503));
 state.named="OTHER_ERROR";
 await t("FAIL_IF_NAMED_READ_UNKNOWN",()=>assert.equal((await invoke()).statusCode,503));
 state.named="NOT_FOUND";state.default="PERMISSION_DENIED_STRING";
 await t("SUPPORT_STRING_PERMISSION_DENIED",()=>assert.equal((await invoke()).statusCode,200));
 state.calls=[];
 await t("NON_GET_REJECTED_BEFORE_DB_READ",async()=>{const r=await invoke("POST");assert.equal(r.statusCode,405);assert.equal(state.calls.length,0)});
 await t("NO_ERROR_TEXT_DISCLOSED",async()=>{state.default="OTHER_ERROR";const r=await invoke();assert(!JSON.stringify(r.body).includes("OPAQUE"))});
 await t("RELEASE_STILL_NO_GO",async()=>assert.equal((await invoke()).body.release,"NO_GO"));
 console.log("P223_RUNTIME_IAM_BOUNDARY_LOCAL_FIXTURES="+n+"/"+n+"_PASS");
 console.log("P223_STAGING_DEPLOYED=FALSE STAGING_IAM_TESTED=FALSE G02=NO_GO");
})().catch(e=>{console.error("P223_BLOCK="+String(e.message).slice(0,160));process.exitCode=1});
