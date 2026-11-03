// PACKTOOK V7.2 — offline invite-only browser flow + DOM/source regression.
// Does not invoke Firebase/GCP, send real email, test signed App Check,
// create Auth accounts, or deploy Production. Uses a local DOM/Auth fixture.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("app/pilot-free.html");
const css=read("app/pilot-free.css");
const script=read("app/pilot-free.js");
const bridge=read("app/firebase-packing-bridge.js");
const backend=read("functions/index.js");
const marketing=read("public/index.html");
const customer=read("app/index.html");
const firebase=JSON.parse(read("firebase.json"));

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
for(const id of ["loginForm","email","password","signIn","memberPanel","identity",
 "inviteState","expiry","sendVerify","refresh","consentBox","acceptTerms",
 "acceptPrivacy","activate","enterPacking","logout","status"])
 assert(ids.includes(id),"Missing Pilot element "+id);
assert.equal(ids.length,new Set(ids).size,"Pilot DOM IDs must be unique");
assert(html.includes('<meta name="robots" content="noindex,nofollow,noarchive">'));
assert(html.includes('src="./pilot-free.js?v=7.2.0"'));
assert(html.includes('href="./policy-terms.html"'));
assert(html.includes('href="./policy-privacy.html"'));
assert(css.includes("[hidden]{display:none!important}"));
assert(firebase.hosting.some(x=>x.target==="app"&&
 x.headers.some(row=>row.headers.some(h=>h.key==="X-Robots-Tag"&&
 h.value==="noindex, nofollow"))));
assert(!marketing.includes("pilot-free.html")&&!customer.includes("pilot-free.html"),
 "Invite-only route must not be linked from public pages");
for(const forbidden of ["createUserWithEmailAndPassword","completeFreeSignup",
 "publicSignupStatus","completeQaFreeSignup","PACKTOOK_PUBLIC_SIGNUP_ENABLED"])
 assert(!script.includes(forbidden),"Pilot browser must not use "+forbidden);
for(const required of ["signInWithEmailAndPassword","onAuthStateChanged",
 "ReCaptchaEnterpriseProvider","initializeAppCheck","isTokenAutoRefreshEnabled:true",
 'call("pilotInvitationStatus")','call("completePilotFreeSignup")',
 "getIdTokenResult(true)","sendEmailVerification","reload(currentUser)",
 "acceptTestTerms:true","acceptPrivacy:true","location.assign(\"./index.html\")"])
 assert(script.includes(required),"Missing protected Pilot browser path "+required);
assert(backend.includes('requirePilotLease(req,{allowUnverified:true})'),
 "Invited unverified users need a no-credit status");
assert(backend.includes('active=a?.ownerUid===req.auth.uid'),
 "Pilot status must confirm actual account before active=true");
assert(bridge.includes('async function pilotAvailability()')&&
 bridge.includes('value?.active===true')&&
 bridge.includes('user=(await pilotAvailability()).active===true?u:null')&&
 bridge.includes('token.claims.packtookPilotV72===true'),
 "PACKING bridge must recheck Pilot live lease rather than trust claim");

const elements=new Map(ids.map(id=>[id,{
 id,hidden:false,disabled:false,checked:false,value:"",
 textContent:"",handlers:new Map(),
 addEventListener(name,fn){this.handlers.set(name,fn)},
 async click(){return this.handlers.get("click")?.()},
 async submit(){return this.handlers.get("submit")?.({preventDefault(){}})}
}]));
const el=id=>elements.get(id);
const document={getElementById:el};
const auth={currentUser:null};
const navigations=[],calls=[];
let listener=null,mailCount=0,grantCount=0,allowPilot=true;
const invited=new Set(["pilot-invited-01"]);
const users=new Map([
 ["invited@example.test",{
  uid:"pilot-invited-01",email:"invited@example.test",
  emailVerified:false,pilotGranted:false,
  async getIdToken(force){return "mock-token"},
  async getIdTokenResult(force){return{claims:this.pilotGranted?{
    packtookPilotV72:true}:{}}}
 }],
 ["not-invited@example.test",{
  uid:"pilot-outsider-01",email:"not-invited@example.test",
  emailVerified:false,pilotGranted:false,
  async getIdToken(force){return "mock-token"},
  async getIdTokenResult(force){return{claims:{}}}
 }]
]);
const expiry=new Date(Date.now()+60*60000).toISOString();
function serverStatus(){
 if(!allowPilot||!auth.currentUser||!invited.has(auth.currentUser.uid)){
  const err=new Error("Not invited");err.code="functions/permission-denied";throw err;
 }
 return {
  enabled:true,verified:auth.currentUser.emailVerified,
  active:auth.currentUser.emailVerified&&auth.currentUser.pilotGranted,
  testOnly:true,policyVersion:"2026-11-v1",expiresAt:expiry,
  freeVideosPerMonth:20,freeDevices:1
 };
}
const signInWithEmailAndPassword=async(_auth,email,password)=>{
 if(password!=="fixture-password"||!users.has(email)){
  const err=new Error("Invalid login");err.code="auth/invalid-credential";throw err;
 }
 auth.currentUser=users.get(email);
 if(listener)await listener(auth.currentUser);
 return {user:auth.currentUser};
};
const signOut=async()=>{auth.currentUser=null;if(listener)await listener(null)};
const sendEmailVerification=async(user)=>{
 assert(allowPilot&&invited.has(user.uid),"No verification email to uninvited user");
 mailCount++;
};
const reload=async(user)=>user;
const onAuthStateChanged=(_auth,callback)=>{listener=callback;return()=>{listener=null}};
const initializeApp=cfg=>({cfg});
const getAuth=()=>auth;
const getFunctions=()=>({});
const initializeAppCheck=()=>({});
class ReCaptchaEnterpriseProvider{constructor(key){this.key=key}}
const httpsCallable=(_functions,name)=>async(payload)=>{
 calls.push(name);
 if(name==="pilotInvitationStatus")return {data:serverStatus()};
 if(name==="completePilotFreeSignup"){
  const status=serverStatus();
  if(!status.verified)throw Error("Unverified");
  assert.deepEqual(payload,{
   acceptTestTerms:true,acceptPrivacy:true,policyVersion:"2026-11-v1"
  });
  grantCount++;
  auth.currentUser.pilotGranted=true;
  return {data:{activated:true,created:grantCount===1,
   expiresAt:expiry,freeVideosPerMonth:20}};
 }
 throw Error("Unexpected callable "+name);
};
const location={assign:url=>navigations.push(url)};
const firebaseConfig={
 projectId:"packtook-prod-01",
 authDomain:"packtook-prod-01.firebaseapp.com",
 appId:"1:123456789:web:fixturepilot",
 apiKey:"local-only-fixture-key"
};
const signupConfig={appCheckSiteKey:"local-only-fixture-recaptcha-enterprise-key",
 policyVersion:"2026-11-v1"};
const runnable=script.replace(/^import[^\n]*;\s*$/gm,"");
new Function("initializeApp","getAuth","onAuthStateChanged",
 "signInWithEmailAndPassword","signOut","sendEmailVerification","reload",
 "initializeAppCheck","ReCaptchaEnterpriseProvider",
 "getFunctions","httpsCallable","firebaseConfig","signupConfig",
 "document","location",runnable)(
 initializeApp,getAuth,onAuthStateChanged,signInWithEmailAndPassword,
 signOut,sendEmailVerification,reload,initializeAppCheck,
 ReCaptchaEnterpriseProvider,getFunctions,httpsCallable,
 firebaseConfig,signupConfig,document,location
);

await listener(null);
assert.equal(el("memberPanel").hidden,true);
assert.equal(el("loginForm").hidden,false);
assert.equal(el("activate").disabled,true);

el("email").value="not-invited@example.test";
el("password").value="fixture-password";
await el("loginForm").submit();
assert.equal(el("memberPanel").hidden,false);
assert.equal(el("activate").disabled,true);
assert.equal(el("sendVerify").disabled,true);
await el("activate").click();
await el("sendVerify").click();
assert.equal(grantCount,0);
assert.equal(mailCount,0);
await el("logout").click();
console.log("PASS: uninvited but valid Firebase Auth user cannot activate Pilot or request verification email");

el("email").value="invited@example.test";
el("password").value="fixture-password";
await el("loginForm").submit();
assert.equal(el("memberPanel").hidden,false);
assert.equal(el("sendVerify").disabled,false);
assert.equal(el("activate").disabled,true);
await el("sendVerify").click();
assert.equal(mailCount,1);
assert.equal(el("sendVerify").disabled,true);
await el("sendVerify").click();
assert.equal(mailCount,1);
users.get("invited@example.test").emailVerified=true;
await el("refresh").click();
assert.equal(el("consentBox").disabled,false);
assert.equal(el("activate").disabled,true);
el("acceptTerms").checked=true;
await el("acceptTerms").handlers.get("change")();
assert.equal(el("activate").disabled,true);
el("acceptPrivacy").checked=true;
await el("acceptPrivacy").handlers.get("change")();
assert.equal(el("activate").disabled,false);
console.log("PASS: invited unverified email can request verification once per page, and both separate consents are required");

await el("activate").click();
assert.equal(grantCount,1);
assert.deepEqual(navigations,["./index.html"]);
await listener(auth.currentUser);
assert.equal(el("enterPacking").hidden,false);
await el("enterPacking").click();
assert.equal(navigations.length,2);
console.log("PASS: verified invite + consent creates one Pilot grant, refreshes Auth claim and enters PACKING");

allowPilot=false;
await el("refresh").click();
assert.equal(el("enterPacking").hidden,true);
assert.equal(el("activate").disabled,true);
const before=navigations.length;
await el("enterPacking").click();
assert.equal(navigations.length,before);
assert.equal(grantCount,1);
console.log("PASS: revoked Pilot status hides access and cannot reopen PACKING from stale browser state");
console.log("RESULT: PACKTOOK V7.2 INVITE-ONLY BROWSER FLOW OFFLINE REGRESSION PASS (not real browser/App Check)");
