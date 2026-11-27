"use strict";
/**
 * PACKTOOK Security candidate: local source-only regression.
 * Node built-in modules only. No Firebase connection, deployment, or data changes.
 * This is NOT runtime App Check or production authorization evidence.
 */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const source = fs.readFileSync("functions/index.js", "utf8");
const declarations = [
  ["options", /const options=\{([^}]+)\};/],
  ["statusOptions", /const statusOptions=\{([^}]+)\};/],
  ["paymentSecrets", /const paymentSecrets=\{([^}]+)\};/],
  ["ownerOptions", /const ownerOptions=\{([^}]+)\};/],
];
for (const [name, pattern] of declarations) {
  const match = source.match(pattern);
  assert.ok(match, `Missing ${name} source options`);
  assert.match(match[1], /(?:^|,)enforceAppCheck:true(?:,|$)/, `${name} lacks explicit App Check enforcement`);
}
const handlers = [...source.matchAll(/exports\.([A-Za-z_]\w*)\s*=\s*(onCall|onRequest)\s*\(/g)];
assert.equal(handlers.length, 23, "Handler inventory drift");
let callables = 0;
let webhook = 0;
for (const match of handlers) {
  const [full, name, type] = match;
  const body = source.slice(match.index + full.length, match.index + full.length + 180);
  if (type === "onRequest") {
    webhook++;
    assert.equal(name, "omisePaymentWebhook", "Unexpected HTTP handler; review policy separately");
    assert.match(body, /invoker:"public"/, "Webhook exposure policy changed");
    continue;
  }
  callables++;
  const arg = body.match(/^\s*([A-Za-z_]\w*)\s*,/);
  if (arg) {
    assert.ok(["options", "statusOptions", "paymentSecrets", "ownerOptions"].includes(arg[1]),
      `Unreviewed option group on ${name}`);
  } else {
    assert.equal(name, "omisePaymentConfig", `Unknown inline options on ${name}`);
    assert.match(body, /enforceAppCheck:true/, "Inline payment config does not enforce App Check");
  }
}
assert.equal(callables, 22);
assert.equal(webhook, 1);
assert.match(source, /const paymentSecrets=\{[^}]*secrets:\[omiseKey\][^}]*enforceAppCheck:true/);
assert.match(source, /const ownerOptions=\{[^}]*enforceAppCheck:true/);
assert.match(source, /const statusOptions=\{\.\.\.options,enforceAppCheck:true\}/);
assert.match(source, /omiseWebhookKey\.value\(\)/, "Webhook signature verifier missing");
assert.match(source, /timingSafeEqual/, "Webhook constant-time signature check missing");
assert.match(source, /skey_test_/, "Test-only payment guard changed unexpectedly; requires separate payment release review");
console.log("PACKTOOK_SECURITY_CANDIDATE_SOURCE_REGRESSION=PASS");
console.log("PACKTOOK_CALLABLES_EXPLICIT_APPCHECK_POLICY=22/22");
console.log("PACKTOOK_HTTP_WEBHOOK=1_SEPARATE_SIGNATURE_POLICY");
console.log("PACKTOOK_OMISE_MODE=TEST_ONLY_UNCHANGED");
console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
