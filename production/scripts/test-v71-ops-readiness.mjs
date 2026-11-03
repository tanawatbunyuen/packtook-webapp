// PACKTOOK V7.1 — OFFLINE test of SecretParam and monitoring source contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import {assessOperations} from "./v71-ops-readiness.mjs";
const backend=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const ok=assessOperations(backend);
assert.equal(ok.sourcePass,true,JSON.stringify(ok.checks));
assert.equal(ok.decision,"NO_GO_PUBLIC");
assert.equal(ok.readyForPublic,false);
assert.equal(ok.production.secretExistenceVerified,false);
assert.equal(ok.production.billingBudgetConfiguredVerified,false);
assert.equal(ok.checks.secretBoundToSignup,true);
assert.equal(ok.checks.secretBoundToStatus,true);
assert.equal(ok.checks.noDirectEnvSecretRead,true);
assert.equal(ok.checks.aggregateAuditEvents,true);
const missingBinding=assessOperations(backend.replace(
 'exports.completeFreeSignup=onCall({...options,enforceAppCheck:true,secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]',
 'exports.completeFreeSignup=onCall({...options,enforceAppCheck:true'
));
assert.equal(missingBinding.sourcePass,false);
assert.equal(missingBinding.checks.secretBoundToSignup,false);
const leakedEnv=assessOperations(backend+'process.env.PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX');
assert.equal(leakedEnv.sourcePass,false);
assert.equal(leakedEnv.checks.noDirectEnvSecretRead,false);
const missingAudit=assessOperations(backend.replace(
 'logger.info("PACKTOOK_PUBLIC_FREE_AUDIT"',
 'console.log("missing"'
));
assert.equal(missingAudit.checks.aggregateAuditEvents,false);
console.log("PASS: SecretParam bound only to Public signup/status and read at runtime");
console.log("PASS: source blocks direct dotenv HMAC secret reads and omitting secret binding");
console.log("PASS: no PII in new structured security events; budget/Cloud controls remain unverified");
console.log("RESULT: PACKTOOK V7.1 OPERATIONS SOURCE READINESS PASS (offline NO-GO)");
