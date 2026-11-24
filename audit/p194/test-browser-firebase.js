"use strict";
// P194 — actual browser fetch -> localhost HTTP bridge -> REAL Firebase Functions Emulator.
// Auth user and Firestore data are generated in isolated DEMO Firebase Emulators only.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("../p193/node_modules/playwright");
for(const [k,v] of Object.entries({
 GCLOUD_PROJECT:"demo-packtook-p184",GOOGLE_CLOUD_PROJECT:"demo-packtook-p184",
 FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:19094",
 FIRESTORE_EMULATOR_HOST:"127.0.0.1:18094"}))
 if(process.env[k]!==v)throw Error("P194_DEMO_ONLY_GUARD_"+k);
const admin=require("../p184/runtime/node_modules/firebase-admin");
admin.initializeApp({projectId:"demo-packtook-p184"});
const auth=admin.auth(),db=admin.firestore(),created=[];
const appSource=fs.readFileSync(path.resolve(__dirname,"../../production/app/app.js"),"utf8");
const html=fs.readFileSync(path.resolve(__dirname,"../../production/app/index.html"),"utf8");
const extract=name=>{
 const line=appSource.match(new RegExp("^function "+name+"\\([^\\n]+$","m"));
 if(!line)throw Error("P194_MISSING_HELPER_"+name);return line[0];
};
const panel=html.match(/<section class="users-panel"><h3>บัญชีผู้ใช้<\/h3>[\s\S]*?<\/section>/)?.[0];
const fn=appSource.match(/^async function refreshOwnerRole\([^\n]+$/m)?.[0];
if(!panel||!fn)throw Error("P194_CLIENT_SOURCE_DRIFT");
const helper=["roleDisplay","duplicateOwnerReviewError","ownerRecoveryStatus","showOwnerRecovery"].map(extract).join("\n");
const callable="http://127.0.0.1:15084/demo-packtook-p184/asia-southeast1/";
async function user(uid,owner){
 const password="P194_DISPOSABLE_BROWSER_TEST_12345";
 await auth.createUser({uid,email:uid+"@example.invalid",password,emailVerified:true});created.push(uid);
 if(owner==="legacy")await db.collection("accounts").doc(uid).set({plan:"Free",period:"2026-11",used:0,reserved:0});
 else if(owner==="owner")await db.collection("accounts").doc(uid).set({ownerUid:uid,plan:"Free",period:"2026-11",used:0,reserved:0});
 const sign=await fetch("http://127.0.0.1:19094/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo",{
 method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:uid+"@example.invalid",password,returnSecureToken:true})});
 assert.equal(sign.status,200);
 return {uid,token:(await sign.json()).idToken};
}
async function startServer(){
 const js=`
 const $=id=>document.getElementById(id);
 let remoteUser=null,accountRoleInfo=null,accountRoleIssue=null,credential=null,toasts=[];
 const toast=m=>toasts.push(m);
 const call=async(name,data={})=>{
  const r=await fetch("/call/"+name,{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({token:credential,data})});
  const body=await r.json();
  if(!r.ok)throw {code:"functions/"+(body.error?.status||"internal").toLowerCase().replaceAll("_","-"),
   message:body.error?.message||"Emulator rejected"};
  return body.result;
 };
 const credit=()=>({accountRole:()=>call("accountRole"),deviceStatus:()=>call("deviceStatus"),authorizeDuplicate:(barcode,reason)=>call("authorizeDuplicate",{barcode,reason})});
 ${helper}
 ${fn}
 window.p194={
  setUser:(u)=>{remoteUser={uid:u.uid};credential=u.token;accountRoleInfo=null;accountRoleIssue=null;showOwnerRecovery()},
  refresh:()=>refreshOwnerRole(remoteUser),call, snapshot:()=>({
   role:accountRoleInfo?.role??null,issue:accountRoleIssue,
   label:$("userRoleInfo").textContent,
   hint:$("ownerRecoveryHint").textContent,
   hintHidden:$("ownerRecoveryHint").hidden,
   retryHidden:$("ownerRoleRetry").hidden,
   toasts:toasts.slice()
  })
 };
 `;
 const server=http.createServer(async(req,res)=>{
  const respond=(status,data,type="application/json")=>{res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(data);};
  if(req.method==="GET"&&req.url==="/"){return respond(200,"<!doctype html><html lang='th'><body>"+panel+"<script src='/client.js'></script></body></html>","text/html;charset=utf-8");}
  if(req.method==="GET"&&req.url==="/client.js")return respond(200,js,"application/javascript;charset=utf-8");
  if(req.method!=="POST"||!/^\/call\/(?:accountRole|deviceStatus|authorizeDuplicate)$/.test(req.url||"")){
   return respond(404,JSON.stringify({error:"P194_LOCAL_ROUTE_NOT_ALLOWED"}));
  }
  try{
   let payload="";for await(const chunk of req){payload+=chunk;if(payload.length>12000)throw Error("P194_PAYLOAD_LIMIT");}
   const body=JSON.parse(payload),name=req.url.slice("/call/".length);
   if(typeof body.token!=="string"||body.token.length<10)throw Error("P194_TOKEN_REQUIRED");
   const result=await fetch(callable+name,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+body.token},body:JSON.stringify({data:body.data||{}})});
   const raw=await result.text();return respond(result.status,raw);
  }catch{respond(400,JSON.stringify({error:{status:"INVALID_ARGUMENT"}}));}
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 return {server,url:"http://127.0.0.1:"+server.address().port};
}
(async()=>{
 let browser=null,server=null,n=0;
 const test=async(name,fn)=>{await fn();n++;console.log("P194_"+name+"=PASS");};
 try{
  const legacy=await user("p194_legacy","legacy"),owner=await user("p194_owner","owner"),fresh=await user("p194_fresh","fresh");
  const web=await startServer();server=web.server;
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage();
  await page.route("**/*",r=>{
   const u=new URL(r.request().url());
   if(u.hostname!=="127.0.0.1"||u.port!==new URL(web.url).port)return r.abort();
   return r.continue();
  });
  await page.goto(web.url,{waitUntil:"load"});
  await test("ACTUAL_CLIENT_HTML_LOADED",async()=>{
   assert.equal(await page.locator("#ownerRecoveryHint").count(),1);
   assert.equal(await page.locator("#userRoleInfo").count(),1);
  });
  await page.evaluate(u=>p194.setUser(u),legacy);
  await page.evaluate(()=>p194.refresh());
  await test("LEGACY_REAL_CALLABLE_HTTP_DENIED",async()=>{
   const s=await page.evaluate(()=>p194.snapshot());
   assert.equal(s.issue,"owner_review");assert.equal(s.role,null);assert(s.label.includes("เจ้าของบัญชี"));
   assert.equal(s.retryHidden,true);assert.equal(s.hintHidden,false);
  });
  await test("LEGACY_NO_SILENT_OWNER_BACKFILL",async()=>{
   const d=(await db.collection("accounts").doc(legacy.uid).get()).data();
   assert(!Object.hasOwn(d,"ownerUid"));
  });
  await test("LEGACY_DUPLICATE_CALL_DENIED_NO_APPROVAL_WRITE",async()=>{
   const x=await page.evaluate(async()=>{
    try{await p194.call("authorizeDuplicate",{barcode:"P194-TEST-BARCODE-ONE",reason:"Real test approval reason"});return "ALLOWED";}
    catch(e){return e.code;}
   });
   assert.equal(x,"functions/permission-denied");
   const approvals=await db.collection("accounts").doc(legacy.uid).collection("duplicateApprovals").get();
   assert.equal(approvals.empty,true);
  });
  await page.evaluate(u=>p194.setUser(u),owner);
  await page.evaluate(()=>p194.refresh());
  await test("VERIFIED_OWNER_REAL_CALLABLE_HTTP_ADMIN",async()=>{
   const s=await page.evaluate(()=>p194.snapshot());assert.equal(s.role,"admin");assert.equal(s.issue,null);
   assert(s.label.startsWith("Admin"));assert.equal(s.hintHidden,true);
  });
  await test("FRESH_ACCOUNT_FIRST_CREATE_ONLY_AFTER_AUTHENTICATED_STATUS",async()=>{
   assert.equal((await db.collection("accounts").doc(fresh.uid).get()).exists,false);
   await page.evaluate(u=>p194.setUser(u),fresh);
   // accountRole is a read-only role check and must not create account.
   await page.evaluate(()=>p194.refresh());
   assert.equal((await db.collection("accounts").doc(fresh.uid).get()).exists,false);
   await page.evaluate(()=>p194.call("deviceStatus"));
   assert.equal((await db.collection("accounts").doc(fresh.uid).get()).data().ownerUid,fresh.uid);
   await page.evaluate(()=>p194.refresh());
   assert.equal((await page.evaluate(()=>p194.snapshot())).role,"admin");
  });
  await test("RELOGIN_LEGACY_AFTER_NEW_OWNER_IS_NOT_ADMIN",async()=>{
   await page.evaluate(u=>p194.setUser(u),legacy);
   await page.evaluate(()=>p194.refresh());
   const s=await page.evaluate(()=>p194.snapshot());
   assert.equal(s.role,null);assert.equal(s.issue,"owner_review");
  });
  await test("LOCALHOST_ONLY_AND_NO_PRODUCTION_WRITES",async()=>{
   assert(page.url().startsWith("http://127.0.0.1:"));
   assert.equal((await db.collection("accounts").doc(legacy.uid).get()).data().ownerUid,undefined);
  });
  console.log("P194_REAL_BROWSER_REAL_FIREBASE_EMULATOR="+n+"/"+n+"_PASS");
  console.log("P194_PRODUCTION_TOKEN_SIGNATURE=NOT_ATTESTED");
  console.log("P194_REAL_STAGING_APPCHECK=NOT_TESTED");
  console.log("P194_PRODUCTION_READS=0 PRODUCTION_WRITES=0 DEPLOYS=0");
  console.log("P194_G02=NO_GO_EXTERNAL_EVIDENCE");
 }finally{
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  for(const uid of created)try{await auth.deleteUser(uid);}catch{}
  await admin.app().delete();
 }
})().catch(e=>{console.error("P194_BROWSER_EMULATOR_FAILED="+e.message);process.exitCode=1;});
