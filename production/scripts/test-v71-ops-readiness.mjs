// PACKTOOK V7.1 — OFFLINE test of SecretParam and monitoring source contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import {assessOperations} from "./v71-ops-readiness.mjs";
const backend=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const template=JSON.parse(fs.readFileSync(new URL("../ops/v71-monitoring-proposals.json",import.meta.url),"utf8"));
assert.equal(template.project,"packtook-prod-01");
assert.equal(template.status,"TEMPLATE_ONLY_NOT_APPLIED");
assert.equal(template.billing.configured,false);
assert.equal(template.billing.type,"alerts-only");
assert.deepEqual(template.billing.thresholdsPercent,[50,80,100]);
assert.equal(template.logMetrics.length,3);
// Only these fixed event LITERALS may occur in a filter. A word such as
// "duplicate_email" describes an event TYPE, not a logged email address.
const allowedEvents=new Map([
 ["packtook_free_new_grants","new_free"],
 ["packtook_free_duplicate_email_attempts","duplicate_email"],
 ["packtook_free_signup_capacity_denials","capacity_exhausted"]
]);
assert.equal(template.logMetrics.length,allowedEvents.size);
for(const metric of template.logMetrics){
 const event=allowedEvents.get(metric.name);
 assert(event,"Unexpected monitoring metric name");
 assert.equal(metric.filter,
  'resource.type="cloud_run_revision" AND jsonPayload.message="PACKTOOK_PUBLIC_FREE_AUDIT" AND jsonPayload.event="'+event+'"',
  "Only fixed event fields are allowed in monitoring filters");
}
assert.equal(new Set(template.logMetrics.map(m=>m.name)).size,allowedEvents.size);

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
console.log("PASS: Monitoring/Billing templates are not applied and no monthly budget is invented");
console.log("RESULT: PACKTOOK V7.1 OPERATIONS SOURCE READINESS PASS (offline NO-GO)");
