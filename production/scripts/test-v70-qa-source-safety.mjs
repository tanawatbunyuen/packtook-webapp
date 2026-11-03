// PACKTOOK V7.0 — source-only safety and branch CI regression.
// Does NOT connect Firebase, modify customers or enable the QA gate.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const backend=read("functions/index.js"),bridge=read("app/firebase-packing-bridge.js");
const qaHtml=read("app/qa-free.html"),qaJs=read("app/qa-free.js");
const marketing=read("public/index.html"),customer=read("app/index.html");
const payment=read("payment-functions/index.js");
const firebase=JSON.parse(read("firebase.json"));

for(const key of [
 "PACKTOOK_V7_QA_ENABLED","PACKTOOK_V7_QA_UID",
 "PACKTOOK_V7_QA_APP_ID","PACKTOOK_V7_QA_EXPIRES_AT"
])assert(backend.includes("process.env."+key),"Missing V7 QA server-side guard "+key);
assert(backend.includes('process.env.PACKTOOK_V7_QA_ENABLED==="true"'),
 "QA must default OFF");
assert(backend.includes('!PUBLIC_SIGNUP_ENABLED&&')&&
 backend.includes("!PUBLIC_ACCESS_ENABLED&&!PUBLIC_POLICIES_APPROVED"),
 "QA only allowed while all three public flags are explicitly OFF");
assert(backend.includes("V7_QA_EXPIRY>now")&&backend.includes("V7_QA_EXPIRY<=now+48*60*60*1000"),
 "QA must have a short time-bound lease");
assert(backend.includes("req.auth?.uid===V7_QA_UID")&&
 backend.includes("req.app?.appId===V7_QA_APP_ID"),
 "Exact UID and App Check-attested Firebase App ID required");
assert(backend.includes("qaInviteValid(req)&&req.auth?.token?.packtookControlledQa===true"),
 "QA Auth claim must be scoped to the active invite");
console.log("PASS: default OFF, single-UID, exact attested App ID, max-48h and independent public gates");

for(const name of ["qaFreeStatus","completeQaFreeSignup"]){
 assert(backend.includes("exports."+name+"=onCall({...options,enforceAppCheck:true}"),
  name+" must enforce App Check at the callable transport");
}
assert(backend.includes("live.emailVerified!==true")&&
 backend.includes('registrationSource:"controlled_qa_v70"')&&
 backend.includes('acceptedTestOnly:true')&&
 backend.includes("tx.create(ref,{ownerUid:id")&&
 backend.includes("packtookControlledQa:true")&&
 backend.includes('live.customClaims?.packtookProductionBeta===true'),
 "Email verification, consent, one-time transaction or Beta protection missing");
assert(backend.includes('if(snap.exists){')&&
 backend.includes('a.registrationSource!=="controlled_qa_v70"'),
 "QA retry must not reset other accounts");
assert(backend.includes('if(!snap.exists&&live.customClaims?.packtookControlledQa===true)'),
 "Deleted QA account cannot claim another Free grant");
assert(backend.includes('if(req.auth.token.packtookProductionBeta!==true&&!isPublicMember(req)&&!isQaMember(req))'),
 "Existing Production Beta, Public and QA auth boundaries missing");
assert(backend.includes("exports.completeFreeSignup=onCall({...options,enforceAppCheck:true}")&&
 backend.includes("PUBLIC_GATE"),
 "Unapproved Public activation must remain protected");
console.log("PASS: transport App Check, verified email, test-only consent, idempotency and Beta isolation");

assert(qaHtml.includes('name="robots" content="noindex,nofollow"'));
assert(qaHtml.includes('id="loginForm"')&&qaHtml.includes('id="sendVerify"')&&
 qaHtml.includes('id="activate"')&&qaHtml.includes('id="accept"'));
assert(qaJs.includes("signInWithEmailAndPassword")&&qaJs.includes("sendEmailVerification")&&
 qaJs.includes("qaFreeStatus")&&qaJs.includes("completeQaFreeSignup")&&
 qaJs.includes("currentUser.getIdTokenResult(true)")&&
 qaJs.includes("ReCaptchaEnterpriseProvider"));
assert(!qaJs.includes("createUserWithEmailAndPassword"),
 "QA UI MUST NOT allow public Firebase Auth user signup");
assert(!marketing.includes("qa-free.html")&&!customer.includes('href="qa-free.html"'),
 "QA page must not be linked in public Marketing or customer navigation");
assert(bridge.includes("token?.claims?.packtookControlledQa===true")&&
 bridge.includes("user=await qaAvailability()?u:null")&&
 bridge.includes('token.claims.packtookControlledQa===true'),
 "Customer QA login must recheck server invitation every time");
assert(bridge.includes("result.enabled===true&&appCheckReady"),
 "Public signup must not open merely because App Check works");
assert(payment.includes("skey_test_")&&!payment.includes("skey_live_"),
 "Omise test-only invariant changed");
assert(firebase.functions.some(x=>x.codebase==="beta")&&firebase.hosting.some(x=>x.target==="app"),
 "Production Firebase targets unexpectedly modified");
console.log("PASS: hidden QA login, no public Auth creation, token refresh, Beta UI and Omise isolation");
console.log("RESULT: PACKTOOK V7.0 CONTROlLED QA SOURCE SAFETY PASS (no live email/browser tested).");
