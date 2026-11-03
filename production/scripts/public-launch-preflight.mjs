// PACKTOOK V6.6 — read-only Free Public Launch preflight.
// Does NOT enable Firebase services, grant claims, or deploy anything.
// Run: node scripts/public-launch-preflight.mjs packtook-prod-01 [--remote] [--strict] [--json]
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

export function inspectSource(source){
 const checks=[];
 function add(id,state,what,next){
  checks.push({id,state,what,next});
 }
 const {
  customerHTML,marketingHTML,marketingCSS,bridge,signupConfig,
  customerJS,backend,terms,privacy,payments,rules,deployScript
 }=source;
 const sourceReady=/exports\.publicSignupStatus=onCall\(\{\.\.\.options,secrets:\[PUBLIC_FREE_EMAIL_HMAC_SECRET\]\}/.test(backend)&&
  /exports\.completeFreeSignup=onCall\(\{\.\.\.options,enforceAppCheck:true,secrets:\[PUBLIC_FREE_EMAIL_HMAC_SECRET\]\}/.test(backend)&&
  /live\.emailVerified!==true/.test(backend)&&/setCustomUserClaims/.test(backend)&&
  /tx\.create\(ref,\{ownerUid:id/.test(backend);
 add("F01",sourceReady?"pass":"blocked",
  "Backend signup needs App Check, verified Auth email, consent and idempotent Free provisioning",
  "Review/restore verified server-side Free activation controls");
 const independentGates=["PACKTOOK_PUBLIC_SIGNUP_ENABLED","PACKTOOK_PUBLIC_ACCESS_ENABLED","PACKTOOK_PUBLIC_POLICIES_APPROVED"]
  .every(x=>backend.includes(x));
 add("F02",independentGates?"pass":"blocked",
  "Three independent server-side signup/access/policy flags are required",
  "Keep all three OFF until integration and legal sign-off are complete");
 const customerFlow=/id="publicSignupForm"/.test(customerHTML)&&
  /id="publicSignupFinish"/.test(customerHTML)&&
  bridge.includes("sendEmailVerification")&&
  bridge.includes("createUserWithEmailAndPassword")&&
  customerJS.includes('window.location.hash==="#signup"')&&
  customerJS.includes("const canRegister=available?.enabled===true");
 add("F03",customerFlow?"pass":"blocked",
  "Customer Free registration and verified-email activation, including guarded #signup deep link",
  "Complete verified email workflow and reject deep links when public flag is off");
 const hiddenCTA=/id="publicFreeSignupCta"[^>]*\bhidden\b/.test(marketingHTML)&&
  marketingCSS.includes("#publicFreeSignupCta[hidden]{display:none!important}")&&
  marketingHTML.includes("https://packtook-prod-01-app.web.app/#signup");
 add("F04",hiddenCTA?"pass":"blocked",
  "Marketing Free signup CTA exists but is hidden before approval",
  "Do not expose CTA until backend gates and legal/QA approvals are verified");
 const noDirectWrites=/allow read, write: if false/.test(rules)&&
  /packtookPaymentTester/.test(payments)&&!/skey_live_/.test(payments);
 add("F05",noDirectWrites?"pass":"blocked",
  "Client Firestore access denied and Omise LIVE disabled",
  "Preserve denied Firestore writes and TEST-only payment isolation");
 const m=signupConfig.match(/appCheckSiteKey:\s*"([^"]*)"/);
 const key=m?.[1]||"";
 const configured=key.length>15&&!/placeholder|your[-_]?site|example|test[_-]key|secret|skey_/i.test(key)&&
   bridge.includes("ReCaptchaEnterpriseProvider");
 add("B01",configured?"pass":"blocked",
  "Public reCAPTCHA Enterprise App Check site key",
  "Register the authorized Customer domain and configure real PUBLIC site key in app/signup-config.js; do not insert secret keys");
 const legalApproved=!/ร่าง|ยังไม่อนุมัติ|ยังไม่ใช่นโยบาย/.test(terms+privacy)&&
  /ช่องทางติดต่อ|ติดต่อ/.test(terms+privacy)&&
  /ผู้ควบคุมข้อมูล/.test(privacy)&&
  /วันที่มีผล/.test(terms+privacy);
 add("B02",legalApproved?"manual":"blocked",
  "Terms and Privacy currently need actual approved controller, contact, retention and effective date",
  "Review and replace both draft policies with legally approved texts; record approver and effective version");
 const marketingPrelaunch=/noindex, nofollow/.test(marketingHTML)&&
  /REGISTRATION &amp; PAYMENT NOT OPEN/.test(marketingHTML);
 add("B03",marketingPrelaunch?"blocked":"manual",
  "Marketing currently announces PRE-LAUNCH and remains noindex",
  "After all launch approvals, change public copy/CTA and SEO; until then do not advertise open signup");
 const stillBeta=/PRODUCTION BETA/.test(customerHTML)&&
  /OMISE PROMPTPAY QR TEST MODE/.test(customerHTML);
 add("B04",stillBeta?"blocked":"manual",
  "Customer login still displays Production Beta / QR Test Mode",
  "Before Free public rollout, approve Free-vs-paid UI notices and remove misleading Beta-only claims; keep payments explicitly disabled");
 const pricePreview=/ระบบทดสอบ V6\.5|ระบบทดสอบ/.test(marketingHTML);
 add("B05",pricePreview?"blocked":"manual",
  "Website pricing remains TEST-preview data",
  "Approve real price/tax/subscription terms or suppress paid plan prices while opening Free only");
 const directStatus=customerJS.includes("const canRegister=available?.enabled===true");
 add("F06",directStatus?"pass":"blocked",
  "Public UI relies on server availability, not a client-side forced ON switch",
  "Never bypass the server status / verified App Check gate");
 const noGenericDeploy=deployScript.includes("--only hosting:app")&&
 !/firebase deploy.*--only (?:functions|firestore)(?:\s|$)/.test(deployScript);
 add("F07",noGenericDeploy?"pass":"blocked",
  "Customer deploy scripts retain hosting isolation",
  "Prepare an independently reviewed backend functions deploy; never run generic firebase deploy");

 const manual=[
 ["M01","Authorize Customer Firebase Auth email/password provider, approved domain and email verification template"],
 ["M02","Complete verified-email signup in isolated QA: 20 Free, record one = 19, relogin, second device blocked, retry no extra grant"],
 ["M03","Review Firestore transaction, custom-claim propagation, App Check Enterprise and denied calls in QA/browser"],
 ["M04","Deploy/review publicSignupStatus and completeFreeSignup Functions and confirm live server flags remain OFF until approval"],
 ["M05","Confirm contact/support, PDPA data subject requests, account deletion, retention, backups and published privacy/terms"],
 ["M06","Approve anti-abuse controls, Auth quotas, cost/budget alerts and monitoring / rollback owner"],
 ["M07","Approve commercial pricing, tax/refund/subscription and paid QR plan; do NOT equate Omise TEST with Live"],
 ["M08","Verify deployed Customer and Marketing site assets, CSP and mobile functionality"],
 ["M09","Perform explicit owner go/no-go sign-off before changing public flags or website CTA"]
 ];
 for(const [id,what] of manual)add(id,"manual",what,"Collect external evidence; a source test cannot certify this");
 return {
  project:"packtook-prod-01",scope:"FREE-FIRST; NO REAL PAYMENT",
  readyForPublic:false,
  checks,
  counts:{pass:checks.filter(x=>x.state==="pass").length,
   blocked:checks.filter(x=>x.state==="blocked").length,
   manual:checks.filter(x=>x.state==="manual").length},
  summary:"Source-readiness only. No Firebase deploy, live Auth signup, legal approval or payment activation is certified."
 };
}
export function collectLocalSource(){
 return {
  customerHTML:read("app/index.html"),marketingHTML:read("public/index.html"),
  marketingCSS:read("public/assets/site.css"),
  bridge:read("app/firebase-packing-bridge.js"),
  signupConfig:read("app/signup-config.js"),customerJS:read("app/app.js"),
  backend:read("functions/index.js"),
  terms:read("app/policy-terms.html"),privacy:read("app/policy-privacy.html"),
  payments:read("payment-functions/index.js"),
  rules:read("firestore.rules"),
  deployScript:read("scripts/deploy-promptpay-customer.sh")
 };
}
async function fetchPage(url){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:"follow"});
  const body=await r.text();
  return {url,status:r.status,ok:r.ok,body,headers:Object.fromEntries(r.headers)};
 }catch(e){return {url,status:null,ok:false,error:e.code||e.message,body:"",headers:{}}}
}
export async function inspectLiveHosts(){
 const [marketing,customer]=await Promise.all([
  fetchPage("https://packtook-prod-01.web.app/"),
  fetchPage("https://packtook-prod-01-app.web.app/")
 ]);
 return {
  marketing:{
   url:marketing.url,http:marketing.status,
   currentHowtoPhotos:marketing.body.includes("howto-ready.webp?v=6.5.6"),
   existingPrelaunch:marketing.body.includes("REGISTRATION &amp; PAYMENT NOT OPEN"),
   imagePolicy:marketing.headers["content-security-policy"]||null
  },
  customer:{
   url:customer.url,http:customer.status,
   hasSignupUI:customer.body.includes('id="publicSignupForm"'),
   hasVerifiedEmailStep:customer.body.includes('id="publicSignupFinish"'),
   betaBanner:customer.body.includes("PRODUCTION BETA")
  },
  note:"HTTP content checks only. Does not prove Firebase Auth/App Check, email delivery, Firestore operations or Cloud Functions deployment."
 };
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 const project=process.argv[2];
 if(project!=="packtook-prod-01"){
  console.error("ERROR: Expected project packtook-prod-01; read-only preflight will not target other projects");
  process.exitCode=1;
 }else{
  const flags=new Set(process.argv.slice(3));
  const report=inspectSource(collectLocalSource());
  if(flags.has("--remote"))report.remote=await inspectLiveHosts();
  if(flags.has("--json"))console.log(JSON.stringify(report,null,2));
  else{
   console.log("PACKTOOK V6.6 — READ-ONLY PUBLIC LAUNCH PREFLIGHT");
   console.log("Scope:",report.scope);
   for(const x of report.checks){
    const marker=x.state==="pass"?"PASS":x.state==="blocked"?"BLOCK":"MANUAL";
    console.log("["+marker+"] "+x.id+" "+x.what);
    if(x.state!=="pass")console.log("  NEXT: "+x.next);
   }
   console.log("COUNT:",JSON.stringify(report.counts));
   if(report.remote)console.log("LIVE HOSTS:",JSON.stringify(report.remote,null,2));
   console.log("PUBLIC OPEN STATUS: NOT AUTHORIZED — separate real QA/legal/payment/owner sign-off required");
  }
  if(flags.has("--strict")&&(report.counts.blocked||report.counts.manual))process.exitCode=2;
 }
}
