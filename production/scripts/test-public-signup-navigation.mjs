// PACKTOOK V6.6 — source-derived Customer Free signup navigation test.
// Real Customer function is evaluated with isolated mock DOM and Backend status.
// Does not connect Firebase and never creates an account.
import fs from "node:fs";
import assert from "node:assert/strict";
const source=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const start=source.indexOf("async function refreshPublicSignupEntry(){");
const end=source.indexOf("\n$('openPublicSignup')",start);
assert(start>0&&end>start,"Cannot extract actual customer signup gating function");
const actualFunction=source.slice(start,end);
const compile=new Function("$","credit","remoteUser","window","showPublicSignupPane",
 actualFunction+"\nreturn refreshPublicSignupEntry;");

function fixture({status={},hash="#signup",user=null}={}){
 const nodes=new Map();
 function $(id){
  if(!nodes.has(id))nodes.set(id,{
   hidden:id==="loginPage"?false:false,
   textContent:"",
   focused:false,
   focus(){this.focused=true}
  });
  return nodes.get(id);
 }
 let panel=null;
 const credit=()=>({signupAvailability:async()=>status});
 const window={location:{hash}};
 const refresh=compile($,credit,user,window,which=>panel=which);
 return {refresh,$,get panel(){return panel}};
}
const off=fixture({status:{enabled:false,accessEnabled:false}});
await off.refresh();
assert.equal(off.$("publicSignupEntry").hidden,true);
assert.equal(off.$("betaSignupOnly").hidden,false);
assert.equal(off.panel,null);
assert.match(off.$("customerStageBanner").textContent,/PRODUCTION BETA/);
assert.match(off.$("customerStageNote").textContent,/จำกัดสิทธิ์บัญชีทดสอบ/);
console.log("PASS: #signup deep link cannot open when backend / App Check gate is OFF");

const yes=fixture({status:{enabled:true,accessEnabled:true}});
await yes.refresh();
assert.equal(yes.$("publicSignupEntry").hidden,false);
assert.equal(yes.$("betaSignupOnly").hidden,true);
assert.equal(yes.panel,"register");
assert.equal(yes.$("signupEmail").focused,true);
assert.match(yes.$("customerStageBanner").textContent,/FREE 20 วิดีโอต่อเดือน/);
assert.match(yes.$("customerStageBanner").textContent,/ชำระเงินยังไม่เปิด/);
assert.equal(yes.$("customerStageBadge").textContent,"FREE REGISTRATION");
console.log("PASS: approved public status reveals Free registration and clear TEST-only payment notice");

const other=fixture({status:{enabled:true},hash:"#packing"});
await other.refresh();
assert.equal(other.panel,null,"Unrelated Customer hash must not show signup panel");

const signed=fixture({status:{enabled:true},hash:"#signup",user:{uid:"existing"}});
await signed.refresh();
assert.equal(signed.panel,null,"Already-authenticated customer cannot be redirected to a new signup");

const noLogin=fixture({status:{enabled:true},hash:"#signup"});
noLogin.$("loginPage").hidden=true;
await noLogin.refresh();
assert.equal(noLogin.panel,null,"Never replace an active packing screen with the signup panel");

assert(html.includes('id="customerStageBanner"')&&html.includes('id="customerStageBadge"')&&
 html.includes('id="customerStageNote"'));
assert(html.includes('app.js?v=6.6.0'));
console.log("PASS: signed-in, hidden login and unrelated route are unaffected");
console.log("RESULT: V6.6 Customer #signup / prelaunch gating integration mock PASS.");
