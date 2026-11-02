// PACKTOOK V6.9 — READ-ONLY App Check source readiness report.
// Never connects to Firebase, registers an App, enables rollout or prints key values.
// Usage: node scripts/check-appcheck-readiness.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");

export function inspectAppCheck({config,bridge,backend,customerHTML,terms,privacy}){
 const keyMatch=config.match(/appCheckSiteKey\s*:\s*["']([^"']*)["']/);
 const key=(keyMatch?.[1]||"").trim();
 const keyLooksReal=key.length>15&&!/placeholder|example|your[-_]?site|test[_-]?key|secret|skey_/i.test(key);
 const findings=[
  {id:"A01",result:bridge.includes("ReCaptchaEnterpriseProvider")&&bridge.includes("initializeAppCheck")&&bridge.includes("isTokenAutoRefreshEnabled:true")?"pass":"blocked",description:"Client uses Firebase App Check reCAPTCHA Enterprise provider"},
  {id:"A02",result:bridge.includes("appCheckSiteKey.trim().length>15")&&bridge.includes("result.enabled===true&&appCheckReady")?"pass":"blocked",description:"Client cannot expose signup while App Check key is missing or public status is OFF"},
  {id:"A03",result:backend.includes("exports.completeFreeSignup=onCall({...options,enforceAppCheck:true}")&&backend.includes("if(!req.app?.appId)")?"pass":"blocked",description:"Source config requires App Check for completeFreeSignup"},
  {id:"A04",result:backend.includes("PACKTOOK_PUBLIC_SIGNUP_ENABLED")&&backend.includes("PACKTOOK_PUBLIC_ACCESS_ENABLED")&&backend.includes("PACKTOOK_PUBLIC_POLICIES_APPROVED")?"pass":"blocked",description:"Independent public signup/access/legal gates exist on backend"},
  {id:"A05",result:customerHTML.includes('firebase-packing-bridge.js?v=7.0.0')&&customerHTML.includes('app.js?v=6.6.0')?"pass":"blocked",description:"Customer V6.6 links a stable App Check integration module"},
  {id:"A06",result:!bridge.includes("FIREBASE_APPCHECK_DEBUG_TOKEN")&&!config.includes("FIREBASE_APPCHECK_DEBUG_TOKEN")?"pass":"blocked",description:"Customer production source contains no App Check debug token"},
  {id:"A07",result:keyLooksReal?"manual":"blocked",description:"A real PUBLIC site key must be registered with the exact Customer Firebase Web App in Firebase Console; source presence alone is not attestation"},
  {id:"A08",result:terms.includes("เอกสารร่าง")||privacy.includes("เอกสารร่าง")?"blocked":"manual",description:"Approved Terms/Privacy still require owner/legal verification"}
 ];
 const blockers=findings.filter(x=>x.result==="blocked").map(x=>x.id);
 return {
  project:"packtook-prod-01",
  readOnly:true,
  siteKeyPresent:keyLooksReal,
  siteKeyValue:"REDACTED/NOT PRINTED",
  sourceChecksPass:findings.filter(x=>x.result==="pass").length,
  sourceChecksTotal:findings.length,
  publicGoLiveAuthorized:false,
  findings,blockers,
  manualRequired:[
   "Create a score-based reCAPTCHA Enterprise Web key restricted to packtook-prod-01-app.web.app; never authorize localhost in Production",
   "Register the PUBLIC site key for the exact Firebase Web App ID in Firebase Console > App Check",
   "Confirm the real browser obtains a valid App Check token and the deployed protected callable rejects missing/invalid tokens in an isolated approved QA environment",
   "Retain all three server-side Public flags OFF and do not enable Omise LIVE",
   "Approve actual Terms/Privacy, contact/support, anti-abuse/budget limits and owner launch sign-off"
  ],
  note:"This is only a local source audit. It cannot verify console registration, cryptographic attestation, real Auth emails, deployed completeFreeSignup or browser recording."
 };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 const files={
  config:read("app/signup-config.js"),
  bridge:read("app/firebase-packing-bridge.js"),
  backend:read("functions/index.js"),
  customerHTML:read("app/index.html"),
  terms:read("app/policy-terms.html"),
  privacy:read("app/policy-privacy.html")
 };
 const report=inspectAppCheck(files);
 if(process.argv.length>3||(process.argv[2]&&process.argv[2]!=="--json")){
  console.error("Usage: node scripts/check-appcheck-readiness.mjs [--json]");
  process.exitCode=2;
 }else{
  console.log(JSON.stringify(report,null,2));
  // Manual go-live blockers are expected; no need to fail the CI prelaunch flow.
  if(report.findings.some(x=>x.result==="blocked"&&x.id!=="A07"&&x.id!=="A08"))process.exitCode=2;
 }
}
