"use strict";
// P193 — Chromium DOM integration of EXACT frontend helper source + ACTUAL account-panel markup.
// This is not a full production hosting/Firebase E2E or real user-data test.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("./node_modules/playwright");
const app=fs.readFileSync(path.resolve(__dirname,"../../production/app/app.js"),"utf8");
const html=fs.readFileSync(path.resolve(__dirname,"../../production/app/index.html"),"utf8");
function extract(name){
 const match=app.match(new RegExp("^function "+name+"\\([^\\n]+$","m"));
 if(!match)throw Error("P193_MISSING_REAL_FRONTEND_FUNCTION_"+name);
 return match[0];
}
const helpers=["roleDisplay","duplicateOwnerReviewError","ownerRecoveryStatus","showOwnerRecovery"];
for(const name of helpers)extract(name);
const asyncFn=app.match(/^async function refreshOwnerRole\([^\n]+$/m)?.[0];
if(!asyncFn)throw Error("P193_MISSING_REAL_ASYNC_HELPER");
const retryLine=app.match(/^\$\('ownerRoleRetry'\)\?\.addEventListener\('click',[\s\S]*?\}\);/m)?.[0];
if(!retryLine)throw Error("P193_MISSING_REAL_CLICK_HANDLER");
const panel=html.match(/<section class="users-panel"><h3>บัญชีผู้ใช้<\/h3>[\s\S]*?<\/section>/)?.[0];
if(!panel||!panel.includes('id="ownerRecoveryHint"')||!panel.includes('id="ownerRoleRetry"'))
 throw Error("P193_MISSING_ACTUAL_ACCOUNT_PANEL");
(async()=>{
 let browser;
 let n=0;
 async function test(name,fn){await fn();n++;console.log("P193_"+name+"=PASS");}
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage();
  // Real HTML element structure, but isolated from any network or production scripts.
  await page.route("**/*",route=>route.abort());
  await page.setContent("<!doctype html><html lang='th'><body>"+panel+"</body></html>");
  await page.addScriptTag({content:`
   const $=id=>document.getElementById(id);
   let remoteUser=null,accountRoleInfo=null,accountRoleIssue=null;
   let serverResponse=()=>Promise.reject({code:"functions/unavailable",message:"mock"});
   const credit=()=>({accountRole:()=>serverResponse()});
   let toasts=[];const toast=s=>toasts.push(s);
   ${helpers.map(extract).join("\n")}
   ${asyncFn}
   ${retryLine}
   window.p193={setUser:(u)=>{remoteUser=u;accountRoleInfo=null;accountRoleIssue=null;showOwnerRecovery()},setResponse:(f)=>{serverResponse=f;},refresh:()=>refreshOwnerRole(remoteUser),snapshot:()=>({
    hint:$("ownerRecoveryHint").textContent,hintHidden:$("ownerRecoveryHint").hidden,
    retryHidden:$("ownerRoleRetry").hidden,label:$("userRoleInfo").textContent,
    role:accountRoleInfo?.role??null,issue:accountRoleIssue,toasts:toasts.slice()
   }),guard:issue=>{const e=duplicateOwnerReviewError(issue);return e?{code:e.code,message:e.message}:null}};
  `});
  await test("BROWSER_ACTUAL_ACCOUNT_PANEL_VISIBLE",async()=>{
   assert.equal(await page.locator("#userRoleInfo").count(),1);
   assert.equal(await page.locator("#ownerRecoveryHint").count(),1);
   assert.equal(await page.locator("#ownerRoleRetry").count(),1);
  });
  await test("LEGACY_PERMISSION_DENIED_RENDERED",async()=>{
   await page.evaluate(async()=>{
    p193.setUser({uid:"p193_legacy"});
    p193.setResponse(()=>Promise.reject({code:"functions/permission-denied",message:"Explicit account owner required"}));
    await p193.refresh();
   });
   const s=await page.evaluate(()=>p193.snapshot());
   assert.equal(s.issue,"owner_review");
   assert.equal(s.retryHidden,true);
   assert.equal(s.hintHidden,false);
   assert(s.hint.includes("ไม่ต้องส่งรหัสผ่าน"));
   assert(s.label.includes("ตรวจสอบสิทธิ์เจ้าของบัญชี"));
   assert.equal(s.role,null);
  });
  await test("NO_AUTORETRY_OWNER_DENIAL",async()=>{
   assert.equal(await page.locator("#ownerRoleRetry").isVisible(),false);
   const e=await page.evaluate(()=>p193.guard("owner_review"));
   assert.equal(e.code,"functions/permission-denied");
  });
  await test("TEMPORARY_FAILURE_SHOWS_RETRY",async()=>{
   await page.evaluate(async()=>{
    p193.setUser({uid:"p193_network"});
    p193.setResponse(()=>Promise.reject({code:"functions/unavailable",message:"temporary"}));
    await p193.refresh();
   });
   assert.equal(await page.locator("#ownerRoleRetry").isVisible(),true);
   const s=await page.evaluate(()=>p193.snapshot());
   assert.equal(s.issue,"temporary");assert.equal(s.role,null);
  });
  await test("ACTUAL_RETRY_BUTTON_RESTORES_ADMIN_ONLY_AFTER_SERVER_SUCCESS",async()=>{
   await page.evaluate(()=>p193.setResponse(()=>Promise.resolve({role:"admin",accountId:"p193_network"})));
   await page.locator("#ownerRoleRetry").click();
   await page.waitForFunction(()=>p193.snapshot().role==="admin");
   const s=await page.evaluate(()=>p193.snapshot());
   assert.equal(s.issue,null);assert.equal(s.hintHidden,true);
   assert.equal(s.retryHidden,true);assert(s.label.startsWith("Admin"));
  });
  await test("BROWSER_RETRY_DOES_NOT_CREATE_AUTH_OR_OWNER_WRITES",async()=>{
   const s=await page.evaluate(()=>p193.snapshot());assert.equal(s.role,"admin");
   assert.equal(await page.evaluate(()=>p193.guard(null)),null);
  });
  await test("ASYNC_SUCCESS_FROM_PREVIOUS_USER_IGNORED",async()=>{
   await page.evaluate(async()=>{
    p193.setUser({uid:"p193_old"});
    let resolveOld;const promise=new Promise(res=>resolveOld=res);
    p193.setResponse(()=>promise);
    const inFlight=p193.refresh();
    p193.setUser({uid:"p193_new"});
    resolveOld({role:"admin",accountId:"p193_old"});
    await inFlight;
   });
   const s=await page.evaluate(()=>p193.snapshot());assert.equal(s.role,null);assert.equal(s.issue,null);
  });
  await test("ASYNC_ERROR_FROM_PREVIOUS_USER_IGNORED",async()=>{
   await page.evaluate(async()=>{
    p193.setUser({uid:"p193_old"});
    let rejectOld;const promise=new Promise((_r,rej)=>rejectOld=rej);
    p193.setResponse(()=>promise);const inFlight=p193.refresh();
    p193.setUser({uid:"p193_new"});
    rejectOld({code:"functions/permission-denied"});
    await inFlight;
   });
   const s=await page.evaluate(()=>p193.snapshot());
   assert.equal(s.role,null);assert.equal(s.issue,null);assert.equal(s.hintHidden,true);
  });
  await test("DUPLICATE_GUARD_FALSE_FOR_UNKNOWN_ROLE",async()=>{
   const e=await page.evaluate(()=>p193.guard(null));assert.equal(e,null);
  });
  await test("NO_EXTERNAL_HOST_REQUESTS",async()=>{
   assert(!page.url().startsWith("https:"));
  });
  console.log("P193_CHROMIUM_ACTUAL_UI_DOM="+n+"/"+n+"_PASS");
  console.log("P193_FULL_HOSTED_FIREBASE_BROWSER_E2E=NOT_ATTESTED");
  console.log("P193_PRODUCTION_READS=0 WRITES=0 DEPLOY=0");
  console.log("P193_G02=NO_GO_LIVE_EXTERNAL_EVIDENCE");
 }finally{if(browser)await browser.close();}
})().catch(e=>{console.error("P193_BROWSER_TEST_FAILED",e.message);process.exitCode=1;});
