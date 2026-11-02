// PACKTOOK V6.9 — offline source tests for App Check rollout guard.
// No network, Firebase resources or SDK call, credentials, key values, or deploy.
import fs from "node:fs";
import assert from "node:assert/strict";
import {inspectAppCheck} from "./check-appcheck-readiness.mjs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const input={
 config:read("app/signup-config.js"),
 bridge:read("app/firebase-packing-bridge.js"),
 backend:read("functions/index.js"),
 customerHTML:read("app/index.html"),
 terms:read("app/policy-terms.html"),
 privacy:read("app/policy-privacy.html")
};
const baseline=inspectAppCheck(input);
assert.equal(baseline.project,"packtook-prod-01");
assert.equal(baseline.readOnly,true);
assert.equal(baseline.publicGoLiveAuthorized,false);
assert.equal(baseline.siteKeyValue,"REDACTED/NOT PRINTED");
assert(baseline.findings.find(x=>x.id==="A03").result==="pass");
assert(baseline.findings.find(x=>x.id==="A04").result==="pass");
assert(baseline.findings.find(x=>x.id==="A06").result==="pass");
assert.equal(baseline.findings.find(x=>x.id==="A07").result,"blocked");
assert.equal(baseline.findings.find(x=>x.id==="A08").result,"blocked");
console.log("PASS: real V6.9 source enforces App Check and public signup remains legally blocked");

const fake=inspectAppCheck({...input,config:input.config.replace('appCheckSiteKey:""','appCheckSiteKey:"YOUR_TEST_KEY_placeholder"')});
assert.equal(fake.siteKeyPresent,false);
assert.equal(fake.publicGoLiveAuthorized,false);
console.log("PASS: fake placeholder key cannot authorize signup");

const future=inspectAppCheck({...input,config:input.config.replace('appCheckSiteKey:""','appCheckSiteKey:"6LdvRTAyAAAAACAX5S8Qq4LfqY2pf"')});
assert.equal(future.siteKeyPresent,true);
assert.equal(future.findings.find(x=>x.id==="A07").result,"manual");
assert.equal(future.publicGoLiveAuthorized,false,"Source Site Key alone cannot authorize Public launch");
console.log("PASS: even a plausible site key only marks manual console attestation pending");

const noCheck=inspectAppCheck({...input,backend:input.backend.replace("enforceAppCheck:true","enforceAppCheck:false")});
assert.equal(noCheck.findings.find(x=>x.id==="A03").result,"blocked");
const badBridge=inspectAppCheck({...input,bridge:input.bridge.replace("result.enabled===true&&appCheckReady","result.enabled===true")});
assert.equal(badBridge.findings.find(x=>x.id==="A02").result,"blocked");
const debug=inspectAppCheck({...input,bridge:input.bridge+'\nself.FIREBASE_APPCHECK_DEBUG_TOKEN=true;'});
assert.equal(debug.findings.find(x=>x.id==="A06").result,"blocked");
console.log("PASS: missing server App Check, broken UI gating and production debug token are blocked");
console.log("RESULT: PACKTOOK V6.9 App Check readiness regression PASS (read-only; no real token tested).");
