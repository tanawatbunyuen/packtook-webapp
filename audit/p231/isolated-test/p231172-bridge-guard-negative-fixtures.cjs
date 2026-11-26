#!/usr/bin/env node
"use strict";
// P231.172 — offline negative fixtures for checked-in staging Bridge.
// VM executes source with Firebase SDK imports replaced by isolated mocks.
// No browser, network, Firebase Admin/Auth/App Check token, Hosting or cloud writes.
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const bridgePath=path.resolve("firebase-staging/firebase-packing-bridge.js");
function log(k,v){process.stdout.write("P231_"+k+"="+v+"\n");}
const source=fs.readFileSync(bridgePath,"utf8");
const importLines=source.split("\n").filter(x=>/^import\s/.test(x));
if(importLines.length!==5 || importLines.some(x=>!/^import\s+\{[\w,\s]+\}\s+from\s+["'][^"']+["'];?$/.test(x.trim()))) {
 log("GATE","BLOCKED_UNEXPECTED_IMPORT_SHAPE");process.exit(2);
}
const body=source.split("\n").filter(x=>!/^import\s/.test(x)).join("\n");
const canonicalUsage='protectedApi("usageStatus")';
const canonicalRecording='protectedApi("recordingStatus")';
if(!body.includes(canonicalUsage)||!body.includes(canonicalRecording)||!body.includes("appCheckReady")){
 log("GATE","BLOCKED_CANONICAL_GUARD_MISSING");process.exit(2);
}
function boot(code,key){
 const invocations=[],calls=[];
 let appCheckInitializations=0;
 const app={id:"mock-app"};
 const ctx={
  firebaseConfig:{projectId:"mock-staging-offline"},
  recaptchaEnterpriseSiteKey:key,
  initializeApp:()=>app,
  getAuth:()=>({}),
  getFunctions:(a,region)=>{if(a!==app||region!=="asia-southeast1")throw Error("wrong app/region");return {app:a};},
  initializeAppCheck:(a,opts)=>{
    if(a!==app||!opts.isTokenAutoRefreshEnabled)throw Error("mock App Check initialization mismatch");
    appCheckInitializations++;
  },
  ReCaptchaEnterpriseProvider:class{constructor(keyValue){if(!keyValue)throw Error("empty mock key");}},
  httpsCallable:(_functions,name)=>{
    calls.push(name);
    return async ()=>({data:{mock:true}});
  },
  getAuthNeverCalled:null,
  onAuthStateChanged:(_auth,cb)=>{cb(null);},
  signInWithEmailAndPassword:async()=>({user:{emailVerified:true}}),
  signOut:async()=>{},
  localStorage:{getItem:()=>null,setItem:()=>{}},
  crypto:{randomUUID:()=>"mock-only-not-real-device"},
  Event:class{constructor(name){this.type=name;}},
  window:{dispatchEvent:()=>{}},
  Set,Error,Promise,
 };
 vm.runInNewContext(code,ctx,{timeout:1500,filename:"p231-bridge-offline-fixture"});
 return {bridge:ctx.window.PACKTOOK_FIREBASE,calls,invocations,get initializationCount(){return appCheckInitializations;}};
}
async function rejects(fn){
 try{await fn();return false;}catch(e){return /App Check is not configured/.test(String(e?.message||""));}
}
async function run(){
 const empty=boot(body,"");
 const blank=boot(body,"   ");
 const configured=boot(body,"OFFLINE_MOCK_SITE_KEY_NOT_REAL");
 const pass={
  EMPTY_KEY_USAGE_FAIL_CLOSED:await rejects(()=>empty.bridge.usage()),
  EMPTY_KEY_RECORDING_FAIL_CLOSED:await rejects(()=>empty.bridge.recordingStatus("mock-op")),
  WHITESPACE_KEY_USAGE_FAIL_CLOSED:await rejects(()=>blank.bridge.usage()),
  WHITESPACE_KEY_RECORDING_FAIL_CLOSED:await rejects(()=>blank.bridge.recordingStatus("mock-op")),
  EMPTY_KEY_NO_STATUS_CALLABLE_INVOKED:empty.calls.length===0&&blank.calls.length===0,
  EMPTY_KEY_NO_APPCHECK_INITIALIZATION:empty.initializationCount===0&&blank.initializationCount===0,
  MOCK_KEY_APPCHECK_INITIALIZATION:configured.initializationCount===1,
 };
 await configured.bridge.usage();
 await configured.bridge.recordingStatus("mock-op");
 pass.MOCK_KEY_STATUS_DISPATCH=configured.calls.join(",")==="usageStatus,recordingStatus";
 const usageTamper=boot(body.replace(canonicalUsage,'api("usageStatus")'),"");
 const recordingTamper=boot(body.replace(canonicalRecording,'api("recordingStatus")'),"");
 const usageBypass=await usageTamper.bridge.usage().then(()=>true,()=>false);
 const recordingBypass=await recordingTamper.bridge.recordingStatus("mock-op").then(()=>true,()=>false);
 pass.NEGATIVE_TAMPER_USAGE_DETECTED=usageBypass && usageTamper.calls.includes("usageStatus");
 pass.NEGATIVE_TAMPER_RECORDING_DETECTED=recordingBypass && recordingTamper.calls.includes("recordingStatus");
 for(const [k,v] of Object.entries(pass))log(k,v?"PASS":"FAIL");
 const ok=Object.values(pass).every(Boolean);
 log("NEGATIVE_FIXTURES",Object.values(pass).filter(Boolean).length+"/"+Object.keys(pass).length+"_"+(ok?"PASS":"FAIL"));
 log("FIREBASE_SDK","ISOLATED_MOCKS_ONLY");
 log("BROWSER_RUNTIME","NOT_PERFORMED");
 log("REAL_APPCHECK_TOKEN_ISSUANCE","0");
 log("NETWORK_REQUESTS","0");
 log("SOURCE_WRITES","0");
 log("CLOUD_WRITES","0");
 log("DEPLOY","NOT_PERFORMED");
 log("RELEASE","NO_GO");
 process.exitCode=ok?0:3;
}
try{run().catch(()=>{log("GATE","BLOCKED_OFFLINE_TEST_EXCEPTION");process.exitCode=2;});}
catch{log("GATE","BLOCKED_OFFLINE_BOOT");process.exitCode=2;}
