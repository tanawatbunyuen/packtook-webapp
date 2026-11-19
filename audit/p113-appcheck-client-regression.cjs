"use strict";
// P113 — offline Node regression against actual repository source; no Firebase network.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const bridge=fs.readFileSync(path.join(root,"firebase-staging/firebase-packing-bridge.js"),"utf8");
const config=fs.readFileSync(path.join(root,"firebase-staging/firebase-v4-config.js"),"utf8");
const backend=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log("PASS",name)}catch(e){checks.push([name,false]);console.error("FAIL",name,e.message)}}
function scenario(key){
 const events=[]; const instance={};
 const windowObj={};
 const context={
  firebaseConfig:{projectId:"packtook-staging"},recaptchaEnterpriseSiteKey:key,
  initializeApp:()=>{events.push("app");return instance},
  getAuth:()=>({}),getFunctions:()=>({}),
  httpsCallable:(_,name)=>{events.push("callable:"+name);return async()=>({data:{ok:true}})},
  initializeAppCheck:(app,options)=>{assert.equal(app,instance);events.push("appcheck");assert.equal(options.isTokenAutoRefreshEnabled,true);assert.equal(options.provider.key,key.trim())},
  ReCaptchaEnterpriseProvider:class{constructor(v){this.key=v;}},
  onAuthStateChanged:(_auth,fn)=>{fn(null);},
  signInWithEmailAndPassword:async()=>({user:{emailVerified:true}}),signOut:async()=>{},
  localStorage:{getItem:()=>null,setItem:()=>{}},
  crypto:{randomUUID:()=> "a".repeat(36)},
  window:windowObj,Set,Error,console
 };
 let js=bridge.replace(/^import\s+.*?;\s*$/gm,"");
 vm.runInNewContext(js,context,{filename:"firebase-packing-bridge.js",timeout:2000});
 return {events,api:windowObj.PACKTOOK_FIREBASE};
}
(async()=>{
 await check("BACKEND_HAS_SCOPED_APP_CHECK",()=>assert.match(backend,/const statusOptions=\{\.\.\.options,enforceAppCheck:true\}/));
 await check("BOTH_STATUS_CALLABLES_GUARDED",()=>{for(const n of ["usageStatus","recordingStatus"])assert.match(backend,new RegExp("exports\\."+n+"=onCall\\(statusOptions,async req=>\\{\\s*const id=uid\\(req\\)"))});
 await check("WEB_CONFIG_EXPLICIT_SITE_KEY",()=>assert.match(config,/export const recaptchaEnterpriseSiteKey\s*=/));
 await check("MISSING_KEY_DOES_NOT_INITIALIZE",()=>{const t=scenario("");assert.deepEqual(t.events,["app"])});
 await check("MISSING_KEY_FAILS_CLOSED",async()=>{const t=scenario("");await assert.rejects(t.api.usage(),/App Check is not configured/);await assert.rejects(t.api.recordingStatus("x"),/App Check is not configured/);assert.equal(t.events.some(x=>x.startsWith("callable:")),false)});
 await check("MISSING_KEY_OTHER_CALLABLES_UNCHANGED",async()=>{const t=scenario("");const r=await t.api.deviceStatus();assert.equal(r.ok,true);assert.equal(t.events.includes("callable:deviceStatus"),true)});
 await check("PRESENT_KEY_INITIALIZES_BEFORE_STATUS",async()=>{const t=scenario("test-site-key");assert.deepEqual(t.events.slice(0,2),["app","appcheck"]);const r=await t.api.usage();assert.equal(r.ok,true);assert.equal(t.events.includes("callable:usageStatus"),true)});
 await check("RECORDING_STATUS_WITH_KEY",async()=>{const t=scenario("test-site-key");assert.equal((await t.api.recordingStatus("x")).ok,true)});
 await check("NO_PRODUCTION_KEY_HARDCODED",()=>assert.equal(/export const recaptchaEnterpriseSiteKey\s*=\s*"[^"]+"/.test(config),false));
 console.log("P113_RESULT",checks.filter(x=>x[1]).length+"/"+checks.length);
 console.log("P113_RUNTIME_APP_CHECK=NOT_TESTED P113_DEPLOY=NONE");
 if(checks.some(x=>!x[1]))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
