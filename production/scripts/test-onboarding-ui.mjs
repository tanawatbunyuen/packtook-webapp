// PACKTOOK V6.5 — no browser/network required; static gating regression.
// Run after test-public-registration.mjs; this never touches Production Firebase.
import fs from "node:fs";
const read=(name)=>fs.readFileSync(new URL("../"+name,import.meta.url),"utf8");
const html=read("app/index.html"),js=read("app/app.js");
const bridge=read("app/firebase-packing-bridge.js");
const cfg=read("app/signup-config.js"),backend=read("functions/index.js");
const rules=read("firestore.rules"),marketing=read("public/index.html");
const assert=(ok,msg)=>{if(!ok)throw Error("V6.5 onboarding: "+msg)};
for(const id of ["publicSignupEntry","openPublicSignup","publicSignupPanel","publicSignupForm",
 "signupEmail","signupPassword","signupPasswordConfirm","signupConsent","signupFeedback",
 "publicSignupFinish","signupFinishBtn","signupFinishConsent","signupFinishFeedback","signupFinishLogout"])
 assert(html.includes('id="'+id+'"'),"Missing Customer registration node "+id);
assert(html.includes('app.js?v=6.5.0')&&html.includes('style.css?v=6.5.0')&&
 html.includes('firebase-packing-bridge.js?v=6.5.0'),"V6.5 Customer assets not versioned");
assert(html.includes('href="policy-terms.html"')&&html.includes('href="policy-privacy.html"'),
 "Signup must link to Terms and Privacy");
for(const policy of ["app/policy-terms.html","app/policy-privacy.html"])
 assert(read(policy).includes("เอกสารร่าง")&&read(policy).includes('noindex,nofollow'),
  "Policies must be clearly unapproved drafts before public release");
assert(js.includes("function showPublicSignupPane(")&&
 js.includes("async function refreshPublicSignupEntry()")&&
 js.includes("if(!status.enabled)")===false,
 "Customer signup UI handler or server gate missing");
assert(js.includes("const canRegister=available?.enabled===true")&&
 js.includes("signupFinishConsent")&&
 js.includes("packtook/finish-signup"),
 "Public signup controls must be gated and require consent");
assert(js.includes("remoteUser=activated.user")&&js.includes("await refreshRemoteQuota()"),
 "Successful activation must preserve Firebase UID and refresh quota");
assert(bridge.includes("createUserWithEmailAndPassword")&&
 bridge.includes("sendEmailVerification")&&bridge.includes("completeFreeSignup")&&
 bridge.includes("getIdTokenResult(true)"),
 "Firebase email verification / claim refresh missing");
assert(bridge.includes("ReCaptchaEnterpriseProvider")&&
 bridge.includes("initializeAppCheck")&&
 bridge.includes("appCheckSiteKey.trim().length>15"),
 "Public registration requires configured App Check key");
assert(cfg.includes('appCheckSiteKey:""'),"Public App Check must be disabled until configured");
assert(backend.includes('process.env.PACKTOOK_PUBLIC_SIGNUP_ENABLED==="true"')&&
 backend.includes('process.env.PACKTOOK_PUBLIC_ACCESS_ENABLED==="true"')&&
 backend.includes('process.env.PACKTOOK_PUBLIC_POLICIES_APPROVED==="true"'),
 "Independent Production rollout flags missing");
assert(backend.includes("exports.completeFreeSignup=onCall({...options,enforceAppCheck:true}")&&
 backend.includes("live.emailVerified!==true")&&backend.includes("setCustomUserClaims")&&
 backend.includes('registrationSource:"self_service_v65"')&&
 backend.includes("tx.create(ref,{ownerUid:id"),
 "Backend App Check, Auth verification or idempotent account creation missing");
assert(backend.includes('if(req.auth.token.packtookProductionBeta!==true&&!isPublicMember(req.auth))'),
 "Public/Beta authorization boundary missing");
assert(rules.includes("allow read, write: if false"),"Firestore must still be closed to direct clients");
assert(marketing.includes("REGISTRATION & PAYMENT NOT OPEN")&&marketing.includes('noindex, nofollow'),
 "Marketing cannot open public before gates are approved");
assert(!html.includes("skey_live_")&&!bridge.includes("skey_live_")&&
 !backend.includes("skey_live_"),"Payment live secrets must not leak into onboarding");
console.log("PASS: V6.5 preview signup, consent, Firebase email, App Check and Free provisioning UI gates");
console.log("NOTE: public registration defaults to OFF; real browser/Auth/App Check QA and legal approval still required");
