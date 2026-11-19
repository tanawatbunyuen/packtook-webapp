"use strict";
// P110 offline source audit only. No Firebase credentials, runtime calls, or deploy.
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");
function capture(re, label) {
  const m = source.match(re);
  if (!m) throw new Error("P110_SOURCE_DRIFT: " + label);
  return m[1];
}
const options = capture(/const\s+options\s*=\s*(\{[^;]+\})\s*;/, "shared options");
const uidBody = capture(/function\s+uid\s*\(req\)\s*\{([^}]+)\}/, "uid helper");
const tests = [];
function check(name, ok) { tests.push({name, ok: Boolean(ok)}); }
check("AUTH_REQUIRED", /if\s*\(\s*!req\.auth\s*\)/.test(uidBody));
check("VERIFIED_EMAIL_REQUIRED", /req\.auth\.token\.email_verified\s*!==\s*true/.test(uidBody));
check("UID_FROM_VERIFIED_AUTH", /return\s+req\.auth\.uid/.test(uidBody));
for (const name of ["recordingStatus", "usageStatus"]) {
  const start = source.indexOf("exports." + name + "=onCall(");
  const end = start < 0 ? -1 : source.indexOf("\n});", start);
  const body = end < 0 ? "" : source.slice(start, end + 4);
  check(name + "_EXPORTED", start >= 0 && end > start);
  check(name + "_USES_SHARED_OPTIONS", new RegExp("exports\\." + name + "\\s*=\\s*onCall\\(options\\s*,").test(body));
  check(name + "_CALLS_UID_GUARD", /\buid\(req\)/.test(body));
  check(name + "_NO_CLIENT_ACCOUNT_SELECTOR", !/\b(accountId|uid)\s*=\s*(?:data\(req\)|req\.data)/.test(body));
}
check("SHARED_OPTIONS_ENFORCE_APP_CHECK", /\benforceAppCheck\s*:\s*true\b/.test(options));
console.log("=== P110 STATUS AUTH APP CHECK OFFLINE SOURCE GATE ===");
console.log("P110_PROJECT_WRITES=0 P110_DEPLOY=0 P110_LIVE_CALLS=0");
for (const t of tests) console.log((t.ok ? "PASS " : "FAIL ") + t.name);
console.log("P110_RESULT=" + (tests.every(t=>t.ok) ? "PASS_STATIC_ONLY" : "BLOCKED_SOURCE_GAP"));
process.exitCode = tests.every(t => t.ok) ? 0 : 1;
