"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"probe/index.js"),"utf8");
let opts;const state={named:"MISSING",default:"DENIED",reads:[]};
const app={};
const admin={apps:[],initializeApp(){this.apps.push(app)},app(){return app}};
const getFirestore=(current,db)=>{assert.equal(current,app);return {collection(coll){
 assert.equal(coll,"__g02_iam_boundary_probe__");
 return {doc(id){assert.match(id,/^p224_missing_[a-f0-9]{32}$/);return {async get(){
 state.reads.push({db,coll});
 const key=db==="g02-security-test"?"named":"default",v=state[key];
 if(v==="MISSING")return {exists:false};
 if(v==="EXISTS")return {exists:true};
 const err=new Error("DO_NOT_EXPOSE_SECRET_DOCUMENT_TOKEN");
 err.code=v==="DENIED"?7:v;
 throw err;
 }}}};
 }}};
const imports=n=>{
 if(n==="firebase-functions/v2/https")return {onRequest:(o,h)=>{opts=o;return h}};
 if(n==="firebase-admin")return admin;
 if(n==="firebase-admin/firestore")return {getFirestore};
 if(n==="node:crypto")return {randomUUID:()=>"11111111-2222-4333-8444-555555555555"};
 throw Error("P224_IMPORT_NOT_ALLOWED");
};
const exported={};
vm.compileFunction(source,["exports","require"])(exported,imports);
const call=exported.g02IamDiagnosticProbe;
async function invoke(method="GET"){
 const response={http:null,data:null,headers:{},set(k,v){this.headers[k]=v;return this},
 status(code){this.http=code;return this},json(value){this.data=value;return this}};
 await call({method},response);return response;
}
let n=0;async function test(name,fn){await fn();n++;console.log("P224_"+name+"=PASS")}
(async()=>{
 await test("ONLY_DIAGNOSTIC_EXPORT",()=>assert.deepEqual(Object.keys(exported),["g02IamDiagnosticProbe"]));
 await test("PRIVATE_IAM",()=>assert.equal(opts.invoker,"private"));
 await test("REGION_PIN",()=>assert.equal(opts.region,"asia-southeast1"));
 await test("ONE_INSTANCE",()=>assert.equal(opts.maxInstances,1));
 await test("TIMEOUT",()=>assert.equal(opts.timeoutSeconds,15));
 await test("NO_CUSTOMER_COLLECTION",()=>assert(!source.includes('collection("accounts")')));
 await test("NO_FIRESTORE_WRITES",()=>assert(!/(?:named|baseline|db|snap)\.(?:set|update|delete|create|add|runTransaction)\(/.test(source)));
 await test("NO_CLIENT_DOCUMENT_ID",()=>assert(!/req\.(?:query|body|params)/.test(source)));
 let r=await invoke();
 await test("VALID_POSITIVE_PASS",()=>assert.equal(r.http,200));
 await test("VALID_PAIR",()=>assert.deepEqual([r.data.namedDatabase,r.data.defaultDatabase],["ALLOWED_NOT_FOUND","PERMISSION_DENIED"]));
 await test("NO_CACHE",()=>assert.equal(r.headers["Cache-Control"],"no-store"));
 await test("ONLY_TEST_COLLECTION_READS",()=>assert(state.reads.every(x=>x.coll==="__g02_iam_boundary_probe__")));
 state.named=7;r=await invoke();
 await test("NAMED_DENIAL_BLOCKS",()=>assert.deepEqual([r.http,r.data.namedDatabase],[503,"PERMISSION_DENIED"]));
 state.named=5;r=await invoke();
 await test("NAMED_NOT_FOUND_ERROR",()=>assert.deepEqual([r.http,r.data.namedDatabase],[503,"NOT_FOUND_ERROR"]));
 state.named=9;r=await invoke();
 await test("FAILED_PRECONDITION_CLASSIFIED",()=>assert.deepEqual([r.http,r.data.namedDatabase],[503,"FAILED_PRECONDITION"]));
 state.named=14;r=await invoke();
 await test("UNAVAILABLE_CLASSIFIED",()=>assert.equal(r.data.namedDatabase,"UNAVAILABLE"));
 state.named=4;r=await invoke();
 await test("DEADLINE_CLASSIFIED",()=>assert.equal(r.data.namedDatabase,"DEADLINE_EXCEEDED"));
 state.named=16;r=await invoke();
 await test("UNAUTHENTICATED_CLASSIFIED",()=>assert.equal(r.data.namedDatabase,"UNAUTHENTICATED"));
 state.named=3;r=await invoke();
 await test("INVALID_ARGUMENT_CLASSIFIED",()=>assert.equal(r.data.namedDatabase,"INVALID_ARGUMENT"));
 state.named=999;r=await invoke();
 await test("UNKNOWN_ERROR_FAILS_CLOSED",()=>assert.deepEqual([r.http,r.data.namedDatabase],[503,"UNKNOWN_ERROR"]));
 await test("NO_SECRET_LEAK",()=>assert(!JSON.stringify(r.data).includes("DO_NOT_EXPOSE_SECRET")));
 state.named="MISSING";state.default="MISSING";r=await invoke();
 await test("DEFAULT_DB_ALLOWED_BLOCKS",()=>assert.deepEqual([r.http,r.data.defaultDatabase],[503,"ALLOWED_NOT_FOUND"]));
 state.default="DENIED";state.named="MISSING";r=await invoke("POST");
 await test("NON_GET_DENIED",()=>assert.equal(r.http,405));
 await test("RELEASE_REMAINS_NO_GO",()=>assert.equal(r.data.release,"NO_GO"));
 await test("NO_CLOUD_ACCESS_IN_CI",()=>assert.equal(process.env.GCLOUD_PROJECT,"demo-packtook-p184"));
 console.log("P224_SAFE_DIAGNOSTIC_LOCAL_TESTS="+n+"/"+n+"_PASS");
 console.log("P224_STAGING_DEPLOYED=FALSE P224_RUNTIME_VERIFIED=FALSE G02=NO_GO");
})().catch(e=>{console.error("P224_BLOCK="+String(e.message).slice(0,130));process.exitCode=1});
