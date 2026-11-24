#!/usr/bin/env node
"use strict";
/*
 * P166: pure local mock execution of two tiny source-extracted claim guards.
 * NEVER load/import/execute functions/index.js as a module, use Firebase, read
 * credentials, connect to a network, or call recovered Owner Functions.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");

const SOURCE = path.join(__dirname, "..", "functions", "index.js");
const EXPECTED_BLOB = "92262ea2fbbb941188937d72f0eea74a735d2bf3";
const REQUIRED = ["ownerAnalyticsSummary", "ownerAnalyticsCustomers"];
const ABSENT_OWNER = [
  "ownerGetCustomerAdjustmentHistory",
  "ownerGetCustomerManageState",
  "ownerGrantVideoCredits",
  "ownerUpdateCustomerExpiry",
];

function gitBlob(bytes) {
  return crypto.createHash("sha1").update(Buffer.concat([
    Buffer.from("blob " + bytes.length + "\0"), bytes,
  ])).digest("hex");
}

function extractFunction(source, name) {
  const needle = "function " + name + "(req){";
  const start = source.indexOf(needle);
  if (start === -1 || source.indexOf(needle, start + 1) !== -1)
    throw new Error("function_missing_or_duplicate");
  let depth = 0;
  for (let i = start + needle.length - 1; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("function_unterminated");
}

function auditedFragments(source) {
  // Require exact source before isolating only the known guard functions.
  if (gitBlob(Buffer.from(source)) !== EXPECTED_BLOB)
    throw new Error("backend_source_drift");
  const uid = extractFunction(source, "uid");
  const owner = extractFunction(source, "requirePlatformOwner");
  if (!uid.includes('throw new HttpsError("unauthenticated"') ||
      !uid.includes('req.auth.token.email_verified!==true') ||
      !owner.includes("const id=uid(req);") ||
      !owner.includes("req.auth.token.packtookPlatformOwner!==true"))
    throw new Error("required_guard_semantics_missing");
  const handlers = {};
  for (const name of REQUIRED) {
    const prefix = "exports." + name + "=onCall(ownerOptions,async req=>{";
    const pos = source.indexOf(prefix);
    if (pos === -1 || source.indexOf(prefix, pos + 1) !== -1)
      throw new Error("owner_handler_missing_or_duplicate");
    const end = source.indexOf("requirePlatformOwner(req);", pos + prefix.length);
    if (end < 0 ||
        source.slice(pos + prefix.length, end).trim() !== "")
      throw new Error("owner_claim_guard_not_first");
    handlers[name] = "CLAIM_GUARD_FIRST_STATIC";
  }
  for (const name of ABSENT_OWNER)
    if (source.includes("exports." + name + "="))
      throw new Error("recovered_owner_source_present_not_audited");
  return {uid, owner, handlers};
}

function makeGuard(fragments) {
  class HttpsError extends Error {
    constructor(code, message) {
      super(message); this.code = code;
    }
  }
  const context = vm.createContext({HttpsError});
  // Only two source-extracted functions can run; no require/process/fetch.
  vm.runInContext(
    '"use strict";\n' + fragments.uid + "\n" + fragments.owner +
      "\nthis.__guard=requirePlatformOwner;",
    context,
    {timeout: 1000},
  );
  return context.__guard;
}

function run() {
  console.log("P166_MODE=SOURCE_EXTRACTED_GUARD_MOCK_ONLY");
  const source = fs.readFileSync(SOURCE, "utf8");
  const fragments = auditedFragments(source);
  console.log("P166_BACKEND_SOURCE_BLOB=PASS");
  for (const name of REQUIRED)
    console.log("P166_" + name.toUpperCase() + "_GUARD_FIRST=PASS");
  console.log("P166_RECOVERED_OWNER_HANDLERS_NOT_EXECUTED=TRUE");
  const guard = makeGuard(fragments);
  const cases = [
    ["SIGNED_OUT", {}, "unauthenticated"],
    ["UNVERIFIED_EMAIL", {auth:{uid:"demo",token:{
      email_verified:false,packtookPlatformOwner:true}}}, "permission-denied"],
    ["MISSING_OWNER_CLAIM", {auth:{uid:"demo",token:{
      email_verified:true}}}, "permission-denied"],
    ["FALSE_OWNER_CLAIM", {auth:{uid:"demo",token:{
      email_verified:true,packtookPlatformOwner:false}}}, "permission-denied"],
    ["STRING_OWNER_CLAIM", {auth:{uid:"demo",token:{
      email_verified:true,packtookPlatformOwner:"true"}}}, "permission-denied"],
    ["CUSTOMER_ADMIN_ONLY", {auth:{uid:"demo",token:{
      email_verified:true,admin:true,role:"admin"}}}, "permission-denied"],
    ["FORGED_PAYLOAD_OWNER", {auth:{uid:"demo",token:{
      email_verified:true}},data:{packtookPlatformOwner:true,role:"owner"}}, "permission-denied"],
    ["VALID_DEMO_OWNER_CLAIM", {auth:{uid:"demo-owner",token:{
      email_verified:true,packtookPlatformOwner:true}}}, "ALLOW"],
  ];
  for (const [name, req, expected] of cases) {
    let observed = "ALLOW";
    try {
      const value=guard(req);
      if (value !== req.auth?.uid) observed = "WRONG_UID";
    } catch (err) {
      observed=err.code || "UNKNOWN_ERROR";
    }
    if (observed !== expected) {
      console.log("P166_" + name + "=FAIL");
      throw new Error("mock_guard_failed");
    }
    console.log("P166_" + name + "=PASS");
  }
  console.log("P166_NEGATIVE_AND_POSITIVE_MOCK_CASES=8/8_PASS");
  console.log("P166_SOURCE_IMPORTS=0 P166_EMULATOR_CALLS=0 P166_CLOUD_CALLS=0 P166_DEPLOYS=0");
  console.log("P166_RUNTIME_OWNER_AUTHORIZATION_ATTESTED=FALSE");
  console.log("P166_RECOVERED_OWNER_AUTHORIZATION_ATTESTED=FALSE");
  console.log("P166_DECISION=NO_GO_RUNTIME_AUTHORIZATION_REVIEW_REQUIRED");
}
if (require.main === module) {
  try { run(); }
  catch (_) {
    console.log("P166_DECISION=NO_GO_MOCK_TEST_FAILURE");
    process.exitCode = 1;
  }
}
module.exports={gitBlob, extractFunction, auditedFragments, makeGuard, run};
