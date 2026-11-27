#!/usr/bin/env node
"use strict";
/* Gate A3: disposable browser smoke against extracted, exact pinned candidate.
 * All external requests blocked except mocked Firebase gstatic ESM modules.
 * No user credentials, real Firebase Auth/App Check/Functions or deploy.
 * Requires Playwright package + local Chromium installed separately.
 */
const { chromium } = require("playwright");
const path=require("node:path");
const fs=require("node:fs");
const root=process.env.PACKTOOK_CANDIDATE_ORIGIN;
if(!root||!/^http:\/\/127\.0\.0\.1:\d+$/.test(root)){console.log("PACKTOOK_GATE_A3=BLOCKED_INVALID_LOCAL_ORIGIN");process.exit(2)}
const modules={
"firebase-app.js":'export const initializeApp=(config)=>({config});',
"firebase-auth.js":'export const getAuth=()=>({}); export const onAuthStateChanged=(_a,cb)=>{cb(null);return ()=>{}}; export const signInWithEmailAndPassword=async()=>{throw Error("OFFLINE_AUTH_BLOCKED")}; export const signOut=async()=>{};',
"firebase-functions.js":'export const getFunctions=(app,region)=>({app,region}); export const httpsCallable=(_f,name)=>async()=>{window.__packtookMockCalls=(window.__packtookMockCalls||[]).concat(name);return {data:{mock:true}}};',
"firebase-app-check.js":'export class ReCaptchaEnterpriseProvider{constructor(key){if(!key)throw Error("EMPTY_KEY")}} export const initializeAppCheck=()=>{window.__packtookMockAppCheckInit=(window.__packtookMockAppCheckInit||0)+1};'
};
const prefix="https://www.gstatic.com/firebasejs/11.10.0/";
function output(k,v){console.log("PACKTOOK_"+k+"="+v)}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:"block",permissions:[],acceptDownloads:false});
 let denied=0,realFirebase=0,mocked=0,unexpected=[];
 await context.route("**/*",async route=>{
  const url=route.request().url();
  if(url.startsWith(root+"/"))return route.continue();
  if(url.startsWith(prefix)){
   const name=url.slice(prefix.length);
   if(Object.prototype.hasOwnProperty.call(modules,name)){
    mocked++;return route.fulfill({status:200,contentType:"text/javascript",
      headers:{"access-control-allow-origin":"*"},body:modules[name]});
   }
  }
  denied++;
  if(/firebaseio|googleapis|recaptcha|cloudfunctions|identitytoolkit|firestore/i.test(url))realFirebase++;
  if(unexpected.length<5)unexpected.push("EXTERNAL_REQUEST_BLOCKED");
  return route.abort("blockedbyclient");
 });
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",err=>errors.push(err.message.slice(0,100)));
 const resp=await page.goto(root+"/",{waitUntil:"domcontentloaded",timeout:20000});
 await page.waitForFunction(()=>window.PACKTOOK_FIREBASE?.ready===true,{timeout:10000});
 const ready=await page.evaluate(()=>({
  ready:window.PACKTOOK_FIREBASE?.ready===true,
  init:window.__packtookMockAppCheckInit||0,
  hasUsage:typeof window.PACKTOOK_FIREBASE?.usage==="function",
  hasRecording:typeof window.PACKTOOK_FIREBASE?.recordingStatus==="function",
  loginVisible:!!document.getElementById("loginPage")
 }));
 const guard=await page.evaluate(async()=>{
  const a=window.PACKTOOK_FIREBASE;
  const data=await a.usage();
  const data2=await a.recordingStatus("offline-fixture-only");
  return {data:data?.mock===true,data2:data2?.mock===true,
    calls:window.__packtookMockCalls||[]};
 });
 const ok=resp?.status()===200 && ready.ready && ready.init===1 &&
   ready.hasUsage&&ready.hasRecording&&ready.loginVisible &&
   guard.data&&guard.data2&&guard.calls.join(",")==="usageStatus,recordingStatus" &&
   realFirebase===0 && denied===0 && errors.length===0;
 output("GATE_A3_MOCK_BROWSER_SMOKE",ok?"PASS_OFFLINE_ONLY":"BLOCKED_REVIEW");
 output("CANDIDATE_INDEX_HTTP",resp?.status()||"N_A");
 output("BRIDGE_INITIALIZED",ready.ready?"YES":"NO");
 output("MOCK_APPCHECK_INIT_COUNT",ready.init);
 output("MOCK_STATUS_CALLS",guard.calls.length);
 output("MOCKED_FIREBASE_SDK_MODULE_FETCHES",mocked);
 output("EXTERNAL_REQUESTS_BLOCKED",denied);
 output("REAL_FIREBASE_REQUESTS",realFirebase);
 output("JS_PAGE_ERRORS_COUNT",errors.length);
 output("REAL_APPCHECK_TOKEN","NOT_REQUESTED");
 output("BROWSER_CONTEXT","DISPOSABLE");
 output("CLOUD_WRITES","0");
 output("DEPLOY","NOT_PERFORMED");
 output("FULL_PUBLIC","NO_GO");
 await context.close();await browser.close();
 process.exitCode=ok?0:3;
})().catch(e=>{
 output("GATE_A3_MOCK_BROWSER_SMOKE","BLOCKED_BROWSER_EXCEPTION");
 output("ERROR_CATEGORY",e.name==="Error"?"ERROR":"OTHER");
 output("REAL_APPCHECK_TOKEN","NOT_REQUESTED");
 output("DEPLOY","NOT_PERFORMED");
 output("FULL_PUBLIC","NO_GO");
 process.exitCode=2;
});
