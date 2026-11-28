"use strict";
/** Local SDK-mocked source compatibility regression. No network, cloud or files modified. */
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const raw=fs.readFileSync("firebase-staging/firebase-packing-bridge.js","utf8");
const source=raw.split("\n").filter(line=>!line.startsWith("import ")).join("\n");
const methods=[...raw.matchAll(/\basync\s+(\w+)\s*\([^)]*\)\s*\{/g)].map(x=>x[1]);
assert.equal(methods.length,30,"Bridge method surface drift");
const endpoints=[...raw.matchAll(/\b(?:api|protectedApi)\("([A-Za-z0-9]+)"\)/g)].map(x=>x[1]);
assert.equal(endpoints.length,28,"Callable mapping drift");
function prepare(key){
 const calls=[];let appCheckCalls=0;let events=0;
 const storage=new Map();
 const context={
  initializeApp:()=>({}),getAuth:()=>({}),getFunctions:()=>({}),
  onAuthStateChanged:(_auth,cb)=>cb(null),
  signInWithEmailAndPassword:async()=>({user:{emailVerified:true}}),
  signOut:async()=>{},
  initializeAppCheck:()=>{appCheckCalls++},
  ReCaptchaEnterpriseProvider:class{constructor(k){this.siteKey=k}},
  httpsCallable:(_functions,name)=>{calls.push(name);return async()=>({data:{name}})},
  firebaseConfig:{projectId:"mock"},recaptchaEnterpriseSiteKey:key,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  crypto:{randomUUID:()=>"12345678-1234-4123-8123-123456789012"},
  window:{},Event:class{constructor(type){this.type=type}},
  console,
 };
 context.window.dispatchEvent=()=>{events++};
 vm.runInNewContext(source,context,{timeout:1000,filename:"firebase-packing-bridge-local-mock.js"});
 return {bridge:context.window.PACKTOOK_FIREBASE,calls,getChecks:()=>({appCheckCalls,events})};
}
(async()=>{
 const no=prepare("");
 assert.equal(no.getChecks().appCheckCalls,0);
 for(const [label,fn] of [
  ["usage",()=>no.bridge.usage()],
  ["recordingStatus",()=>no.bridge.recordingStatus("test_operation_00001")],
  ["reserve",()=>no.bridge.reserve("barcode","test_operation_00001")],
  ["registerDevice",()=>no.bridge.registerDevice("test-device")],
  ["accountRole",()=>no.bridge.accountRole()],
  ["omiseConfig",()=>no.bridge.omiseConfig()],
  ["payment",()=>no.bridge.startOmisePayment("test_request_00001","promptpay")]
 ]){
  await assert.rejects(fn(),/App Check is not configured/,label+" should fail closed");
 }
 assert.equal(no.calls.length,0,"No callable may be invoked with missing App Check key");
 const yes=prepare("synthetic-site-key-for-offline-mock");
 assert.equal(yes.getChecks().appCheckCalls,1,"initializeAppCheck must run once");
 assert.equal(yes.getChecks().events,1,"bridge event must be dispatched");
 await yes.bridge.usage();
 await yes.bridge.reserve("barcode","test_operation_00001");
 await yes.bridge.registerDevice("test-device");
 await yes.bridge.accountRole();
 await yes.bridge.omiseConfig();
 await yes.bridge.startOmisePayment("test_request_00001","promptpay");
 assert.deepEqual(yes.calls,["usageStatus","reserveCredit","registerDevice","accountRole","omisePaymentConfig","createOmisePayment"]);
 console.log("PACKTOOK_BROWSER_BACKEND_SOURCE_COMPATIBILITY=PASS_MOCK_ONLY");
 console.log("PACKTOOK_BRIDGE_ASYNC_METHODS=30");
 console.log("PACKTOOK_CLIENT_CALLABLE_BINDINGS=28");
 console.log("PACKTOOK_NO_KEY_FAIL_CLOSED=7/7");
 console.log("PACKTOOK_NO_KEY_CALLABLE_DISPATCH=0");
 console.log("PACKTOOK_CONFIGURED_KEY_MOCK_CALLS=6/6");
 console.log("PACKTOOK_REAL_FIREBASE_CALLS=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
})().catch(e=>{console.error("PACKTOOK_COMPATIBILITY=FAIL",e.message);process.exitCode=2});
