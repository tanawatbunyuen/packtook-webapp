"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"probe/index.js"),"utf8");
const state={
 namedSdk:"MISSING",defaultSdk:7,namedRest:404,defaultRest:403,
 token:"TEST_ONLY_FAKE_ACCESS_TOKEN",records:[],opts:null,project:null,
 responseBodyRead:false
};
const app={};
const admin={
 apps:[],
 initializeApp(o){state.project=o.projectId;this.apps.push(app);return app},
 app(){return app}
};
const getFirestore=(a,db)=>{
 assert.equal(a,app);
 return {collection(collection){
  assert.equal(collection,"__g02_iam_boundary_probe__");
  return {doc(id){
   assert.match(id,/^p225_missing_[a-f0-9]{32}$/);
   return {async get(){
    state.records.push({via:"sdk",db});
    const v=db==="g02-security-test"?state.namedSdk:state.defaultSdk;
    if(v==="MISSING")return {exists:false};
    if(v==="EXISTS")return {exists:true};
    const error=new Error("PRIVATE_ERROR_MUST_NOT_LEAK");
    error.code=v;throw error;
   }};
  }};
 }};
};
class GoogleAuth{
 constructor(opts){assert.deepEqual(Array.from(opts.scopes),["https://www.googleapis.com/auth/datastore"])}
 async getClient(){return {getAccessToken:async()=>({token:state.token})}}
}
const mockFetch=async(url,opts)=>{
 assert.equal(opts.method,"GET");
 assert.equal(opts.redirect,"error");
 assert.equal(opts.headers.Accept,"application/json");
 assert.equal(opts.headers.Authorization,"Bearer TEST_ONLY_FAKE_ACCESS_TOKEN");
 assert.match(url,/^https:\/\/firestore\.googleapis\.com\/v1\/projects\/packtook-staging\/databases\//);
 assert.match(url,/\/documents\/__g02_iam_boundary_probe__\/p225_missing_[a-f0-9]{32}$/);
 const db=url.includes("/databases/g02-security-test/")?"g02-security-test":"(default)";
 assert(url.includes("/databases/"+db+"/"));
 state.records.push({via:"rest",db});
 const v=db==="g02-security-test"?state.namedRest:state.defaultRest;
 if(v==="NETWORK")throw Error("PRIVATE_NETWORK_EXCEPTION");
 return {status:v,get body(){state.responseBodyRead=true;throw Error("BODY MUST NOT BE TOUCHED")}};
};
const context=vm.createContext({fetch:mockFetch,AbortSignal:{timeout:()=>({})}});
const imports=n=>{
 if(n==="firebase-functions/v2/https")return {onRequest:(opts,handler)=>{state.opts=opts;return handler}};
 if(n==="firebase-admin")return admin;
 if(n==="firebase-admin/firestore")return {getFirestore};
 if(n==="google-auth-library")return {GoogleAuth};
 if(n==="node:crypto")return {randomUUID:()=>"11111111-2222-4333-8444-555555555555"};
 throw Error("UNEXPECTED_REQUIRE");
};
const exported={};
vm.compileFunction(source,["exports","require"],{parsingContext:context})(exported,imports);
async function invoke(method="GET"){
 const res={
  statusCode:null,body:null,headers:{},
  set(k,v){this.headers[k]=v;return this},
  status(v){this.statusCode=v;return this},
  json(v){this.body=v;return this}
 };
 await exported.g02SdkRestDiagnosticProbe({method},res);
 return res;
}
let count=0;
async function check(label,test){await test();count++;console.log("P225_"+label+"=PASS")}
const reset=()=>{state.namedSdk="MISSING";state.defaultSdk=7;state.namedRest=404;state.defaultRest=403;state.token="TEST_ONLY_FAKE_ACCESS_TOKEN";state.records=[]};
(async()=>{
 await check("ONLY_NEW_FUNCTION",()=>assert.deepEqual(Object.keys(exported),["g02SdkRestDiagnosticProbe"]));
 await check("PROJECT_PIN",()=>assert.equal(state.project,"packtook-staging"));
 await check("INVOKER_PRIVATE",()=>assert.equal(state.opts.invoker,"private"));
 await check("MAX_INSTANCE_ONE",()=>assert.equal(state.opts.maxInstances,1));
 await check("REGION_PIN",()=>assert.equal(state.opts.region,"asia-southeast1"));
 await check("NO_REQUEST_BODY_OR_QUERY",()=>assert(!/req\.(?:body|query|params)/.test(source)));
 await check("NO_FIRESTORE_WRITES",()=>assert(!/(?:namedDb|defaultDb|db|snap)\.(?:set|update|create|delete|add|runTransaction)\(/.test(source)));
 let r=await invoke();
 await check("FOUR_WAY_PASS",()=>assert.equal(r.statusCode,200));
 await check("FOUR_EXPECTED_RESULTS",()=>assert.deepEqual([r.body.namedSdk,r.body.defaultSdk,r.body.namedRest,r.body.defaultRest],["ALLOWED_NOT_FOUND","PERMISSION_DENIED","ALLOWED_NOT_FOUND","PERMISSION_DENIED"]));
 await check("READS_SAME_ID_BOTH_DB",()=>assert.deepEqual(state.records.map(x=>x.via+":"+x.db).sort(),["rest:(default)","rest:g02-security-test","sdk:(default)","sdk:g02-security-test"].sort()));
 await check("NO_CACHE",()=>assert.equal(r.headers["Cache-Control"],"no-store"));
 await check("RELEASE_NO_GO",()=>assert.equal(r.body.release,"NO_GO"));
 await check("NEVER_READS_REST_RESPONSE_BODY",()=>assert.equal(state.responseBodyRead,false));
 reset();state.namedSdk=3;r=await invoke();
 await check("SDK_INVALID_ARGUMENT_BLOCKS",()=>assert.deepEqual([r.statusCode,r.body.namedSdk,r.body.namedRest],[503,"INVALID_ARGUMENT","ALLOWED_NOT_FOUND"]));
 reset();state.namedRest=400;r=await invoke();
 await check("REST_INVALID_ARGUMENT_BLOCKS",()=>assert.deepEqual([r.statusCode,r.body.namedRest],[503,"INVALID_ARGUMENT"]));
 reset();state.namedRest=403;r=await invoke();
 await check("NAMED_REST_PERMISSION_DENIED",()=>assert.deepEqual([r.statusCode,r.body.namedRest],[503,"PERMISSION_DENIED"]));
 reset();state.namedRest=503;r=await invoke();
 await check("NAMED_REST_UNAVAILABLE",()=>assert.deepEqual([r.statusCode,r.body.namedRest],[503,"UNAVAILABLE"]));
 reset();state.namedSdk=5;r=await invoke();
 await check("SDK_NOT_FOUND_ERROR",()=>assert.deepEqual([r.statusCode,r.body.namedSdk],[503,"NOT_FOUND_ERROR"]));
 reset();state.namedSdk=9;r=await invoke();
 await check("SDK_FAILED_PRECONDITION",()=>assert.deepEqual([r.statusCode,r.body.namedSdk],[503,"FAILED_PRECONDITION"]));
 reset();state.namedSdk=999;r=await invoke();
 await check("UNKNOWN_SDK_ERROR_NO_TEXT",()=>assert.deepEqual([r.statusCode,r.body.namedSdk],[503,"UNKNOWN_ERROR"]));
 reset();state.defaultRest=404;r=await invoke();
 await check("DEFAULT_REST_ACCESS_BLOCKS",()=>assert.deepEqual([r.statusCode,r.body.defaultRest],[503,"ALLOWED_NOT_FOUND"]));
 reset();state.defaultSdk="MISSING";r=await invoke();
 await check("DEFAULT_SDK_ACCESS_BLOCKS",()=>assert.deepEqual([r.statusCode,r.body.defaultSdk],[503,"ALLOWED_NOT_FOUND"]));
 reset();state.token=null;r=await invoke();
 await check("MISSING_TOKEN_BLOCKS",()=>assert.deepEqual([r.statusCode,r.body.namedRest],[503,"AUTH_TOKEN_UNAVAILABLE"]));
 await check("MISSING_TOKEN_SKIPS_REST",()=>assert(!state.records.some(x=>x.via==="rest")));
 reset();state.namedRest="NETWORK";r=await invoke();
 await check("NETWORK_ERROR_CLASSIFIED",()=>assert.deepEqual([r.statusCode,r.body.namedRest],[503,"NETWORK_OR_TIMEOUT_ERROR"]));
 await check("NO_SECRET_OR_ERRORS_IN_OUTPUT",()=>assert(!JSON.stringify(r.body).includes("PRIVATE_")&&!JSON.stringify(r.body).includes("TEST_ONLY_FAKE")));
 reset();state.records=[];r=await invoke("POST");
 await check("NON_GET_DENIED_BEFORE_READ",()=>assert.equal(r.statusCode,405)&&assert.equal(state.records.length,0));
 await check("OFFLINE_DEMO_ONLY",()=>assert.equal(process.env.GCLOUD_PROJECT,"demo-packtook-p184"));
 console.log("P225_OFFLINE_FIXTURES="+count+"/"+count+"_PASS");
 console.log("P225_DEPLOYED=FALSE RUNTIME_VERIFIED=FALSE G02=NO_GO");
})().catch(e=>{console.error("P225_TEST_FAIL="+String(e.message).slice(0,160));process.exitCode=1});
