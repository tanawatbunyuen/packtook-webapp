'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
let observed;
class FakeHttpsError extends Error{
  constructor(code,message){super(message);this.code=code;}
}
const originalLoad=Module._load;
try{
  Module._load=function(request,parent,isMain){
    if(request==='firebase-functions/v2/https')return {
      onCall(options,handler){observed={options,handler};return handler;},
      HttpsError:FakeHttpsError
    };
    return originalLoad.apply(this,arguments);
  };
  require(path.join(__dirname,'index.js'));
}finally{Module._load=originalLoad;}
const req=(app,auth,data={})=>({app,auth,data});
const app={appId:'synthetic-app-id'};
const auth={uid:'synthetic-user',token:{email_verified:true}};
test('exports callable and enables App Check with bounded resources',()=>{
  assert.ok(observed);
  assert.equal(observed.options.enforceAppCheck,true);
  assert.equal(observed.options.region,'asia-southeast1');
  assert.equal(observed.options.maxInstances,1);
  assert.equal(observed.options.concurrency,1);
});
test('private invoker and dedicated no-database runtime identity are pinned',()=>{
  assert.equal(observed.options.invoker,'private');
  assert.equal(observed.options.serviceAccount,'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com');
});
test('synthetic fully verified request returns fixed non-sensitive response',async()=>{
  assert.deepEqual(await observed.handler(req(app,auth)),{probe:'p231-isolated',result:'PASS'});
});
test('missing App Check context is rejected by additional handler guard',async()=>{
  await assert.rejects(observed.handler(req(undefined,auth)),{code:'failed-precondition'});
});
test('missing authentication is rejected by handler',async()=>{
  await assert.rejects(observed.handler(req(app,undefined)),{code:'unauthenticated'});
});
test('unverified email is rejected by handler',async()=>{
  await assert.rejects(observed.handler(req(app,{uid:'synthetic-user',token:{email_verified:false}})),{code:'unauthenticated'});
});
test('unexpected request data is rejected',async()=>{
  await assert.rejects(observed.handler(req(app,auth,{operationId:'never-accepted'})),{code:'invalid-argument'});
});
