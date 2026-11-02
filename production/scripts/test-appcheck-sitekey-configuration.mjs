// V6.9.1 — test complete Site Key injection without modifying any files.
// This test never connects to Firebase, prints the real key, or deploys Hosting.
import assert from "node:assert/strict";
import fs from "node:fs";
import {validPublicSiteKey,withSiteKey} from "./set-appcheck-site-key.mjs";

const config=fs.readFileSync(new URL("../app/signup-config.js",import.meta.url),"utf8");
const mock="6LdYzfEwAAAAADemoApprovedLocalFixture";
assert.equal(validPublicSiteKey(mock),true);
const updated=withSiteKey(config.includes('appCheckSiteKey:""')?config:config.replace(/appCheckSiteKey:"[^"]*"/,'appCheckSiteKey:""'),mock);
assert(updated.includes('appCheckSiteKey:"'+mock+'"'));
assert(updated.includes('policyVersion:"2026-11-v1"'));
assert(updated.includes('termsUrl:"policy-terms.html"')&&updated.includes('privacyUrl:"policy-privacy.html"'));
assert.equal(updated.replace('appCheckSiteKey:"'+mock+'"','appCheckSiteKey:""'),
 config.replace(/appCheckSiteKey:"[^"]*"/,'appCheckSiteKey:""'));
console.log("PASS: Site Key insertion edits only the expected App Check field and preserves policies");

for(const bad of [
 undefined,"","6Lfq9gwuAAAAAMtVvlRwb95QUCiP9q...", // truncated screenshot
 "YOUR_PUBLIC_SITE_KEY","skey_test_not_a_site_key",
 "short","https://example.com","foo\nbar"
]){
 assert.equal(validPublicSiteKey(bad),false,"Invalid or partial key must be rejected");
 assert.throws(()=>withSiteKey(config,bad),/INVALID PUBLIC SITE KEY/);
}
console.log("PASS: partial screenshot, placeholders, wrong formats and secret-looking keys are rejected");

const occupied=config.replace(/appCheckSiteKey:"[^"]*"/,'appCheckSiteKey:"6LpErsonalWebSiteKeyAAAAAAlreadyConfigured123"');
assert.throws(()=>withSiteKey(occupied,mock),/SAFETY BLOCK:/);
assert.equal(withSiteKey(occupied,"6LpErsonalWebSiteKeyAAAAAAlreadyConfigured123"),occupied);
console.log("PASS: existing different key cannot be silently overwritten");

const bridge=fs.readFileSync(new URL("../app/firebase-packing-bridge.js",import.meta.url),"utf8");
const backend=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
assert(bridge.includes("new ReCaptchaEnterpriseProvider(signupConfig.appCheckSiteKey.trim())"));
assert(bridge.includes("result.enabled===true&&appCheckReady"));
assert(backend.includes("enforceAppCheck:true"));
assert(backend.includes("PUBLIC_SIGNUP_ENABLED&&PUBLIC_ACCESS_ENABLED&&PUBLIC_POLICIES_APPROVED"));
console.log("PASS: App Check client and server-side signup gates remain mandatory");
console.log("RESULT: PACKTOOK V6.9.1 PUBLIC SITE KEY CONFIG QA PASS (offline; no token test).");
