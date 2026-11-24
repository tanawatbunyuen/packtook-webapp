#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const h=require("./p171-admin-verify.js");
const base=Buffer.from(JSON.stringify({aud:"demo",uid:"synthetic"})).toString("base64url");
const token="e30."+base+".QUJDRA";
const mutated=h.mutateSignature(token);
assert.notEqual(mutated,token);
assert.equal(mutated.split(".").length,3);
console.log("P171_SIGNATURE_MUTATION_FIXTURE=PASS");
const altered=h.mutateAudienceWithoutResigning(token);
assert.notEqual(altered,token);
assert.equal(JSON.parse(Buffer.from(altered.split(".")[1],"base64url")).aud,
             "demo-another-p171-project");
console.log("P171_AUDIENCE_MUTATION_FIXTURE=PASS");
const source=fs.readFileSync(path.join(__dirname,"../functions/index.js"));
const p166=require("./p166-owner-claim-negative.js");
assert.equal(p166.gitBlob(source),"92262ea2fbbb941188937d72f0eea74a735d2bf3");
console.log("P171_PINNED_SOURCE_FIXTURE=PASS");
const runner=fs.readFileSync(path.join(__dirname,"p171-local-auth-emulator.py"),"utf8");
assert(runner.includes('"--only","auth"'));
assert(!runner.includes('"--only","functions"'));
console.log("P171_AUTH_ONLY_EMULATOR_FIXTURE=PASS");
console.log("P171_OFFLINE_FIXTURES=4/4_PASS");
