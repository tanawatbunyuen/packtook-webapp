// PACKTOOK V6.6 — public launch gate/source integration, no Firebase writes.
// Run: node scripts/test-public-launch-preflight.mjs
import assert from "node:assert/strict";
import {collectLocalSource,inspectSource} from "./public-launch-preflight.mjs";

const source=collectLocalSource();
const result=inspectSource(source);
const item=(r,id)=>r.checks.find(x=>x.id===id);
assert.equal(result.project,"packtook-prod-01");
assert.equal(result.scope,"FREE-FIRST; NO REAL PAYMENT");
assert.equal(result.readyForPublic,false,"Do not claim Public live readiness from source-only QA");
for(const id of ["F01","F02","F03","F04","F05","F06","F07"]){
 assert.equal(item(result,id)?.state,"pass","Critical server/client fail-closed control missing "+id);
}
assert.equal(result.checks.filter(c=>c.id.startsWith("M")).length,9);
assert.equal(item(result,"B01")?.state,
 source.signupConfig.includes('appCheckSiteKey:""')?"blocked":"pass",
 "App Check source status should match blank or configured PUBLIC Site Key without authorizing launch");
assert.equal(item(result,"B02")?.state,"blocked","Unapproved draft Terms/Privacy must block public release");
assert.equal(item(result,"B03")?.state,"blocked","Prelaunch marketing must not be falsely labeled public");
assert.equal(item(result,"B04")?.state,"blocked","Production Beta banner must be reviewed before public release");
assert.equal(item(result,"B05")?.state,"blocked","Test-only pricing must be reviewed before public advertising");
console.log("PASS: current Production Beta state is correctly BLOCKED for public access, while code safety gates PASS");

const noAppCheck=inspectSource({
 ...source,
 backend:source.backend.replace("enforceAppCheck:true","enforceAppCheck:false")
});
assert.equal(item(noAppCheck,"F01")?.state,"blocked");
// A missing bound SecretParam must never appear as a deploy-ready Public path.
const noSecretSignup=inspectSource({
 ...source,
 backend:source.backend.replace(
  'exports.completeFreeSignup=onCall({...options,enforceAppCheck:true,secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]}',
  'exports.completeFreeSignup=onCall({...options,enforceAppCheck:true}')
});
assert.equal(item(noSecretSignup,"F01")?.state,"blocked");
const noSecretStatus=inspectSource({
 ...source,
 backend:source.backend.replace(
  'exports.publicSignupStatus=onCall({...options,secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]}',
  'exports.publicSignupStatus=onCall(options')
});
assert.equal(item(noSecretStatus,"F01")?.state,"blocked");
const noConsent=inspectSource({
 ...source,
 customerHTML:source.customerHTML.replace('id="publicSignupForm"','id="badSignupForm"')
});
assert.equal(item(noConsent,"F03")?.state,"blocked");
const bypassDeepLink=inspectSource({
 ...source,
 customerJS:source.customerJS.replace('window.location.hash==="#signup"','window.location.hash==="#anywhere"')
});
assert.equal(item(bypassDeepLink,"F03")?.state,"blocked");
const accidentalVisibleCta=inspectSource({
 ...source,
 marketingHTML:source.marketingHTML.replace(/id="publicFreeSignupCta"([^>]+)\bhidden\b/,
  'id="publicFreeSignupCta"$1')
});
assert.equal(item(accidentalVisibleCta,"F04")?.state,"blocked");
const removedRules=inspectSource({
 ...source,
 rules:source.rules.replace("allow read, write: if false","allow read, write: if true")
});
assert.equal(item(removedRules,"F05")?.state,"blocked");
console.log("PASS: tampered App Check, form, deep link, Marketing CTA and Firestore rules are detected");

const simulatedValidKey=inspectSource({
 ...source,
 signupConfig:source.signupConfig.replace(/appCheckSiteKey:"[^"]*"/,
 'appCheckSiteKey:"6LeRealExamplePublicSiteKeyOnlyForTest"')
});
assert.equal(item(simulatedValidKey,"B01")?.state,"blocked",
 "Example/placeholder key must not be treated as valid");
const simKey=inspectSource({
 ...source,
 signupConfig:source.signupConfig.replace(/appCheckSiteKey:"[^"]*"/,
 'appCheckSiteKey:"6LdYzfEwAAAAADemoApprovedLocalFixture"')
});
assert.equal(item(simKey,"B01")?.state,"pass",
 "A non-placeholder configured site key should clear only its local source blocker");
assert.equal(simKey.readyForPublic,false);
assert.equal(item(simKey,"B02")?.state,"blocked");
console.log("PASS: adding an App Check key alone cannot authorize public launch or override legal approval");
console.log("RESULT: PACKTOOK V6.6 fail-closed public readiness QA PASS; actual Firebase/browser/legal approval is still pending.");
