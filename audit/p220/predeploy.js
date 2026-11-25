"use strict";
// Local fail-closed deployment guard: no cloud calls or changes.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const source=fs.readFileSync(path.resolve(__dirname,"../p188/candidate-index.js"));
const probe=fs.readFileSync(path.resolve(__dirname,"probe/index.js"),"utf8");
assert.equal(crypto.createHash("sha256").update(source).digest("hex"),EXPECTED_CANDIDATE);
assert(!source.toString().includes('if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});'));
assert(!source.toString().includes('const role=ref.id===id?"admin":"operator";'));
assert(probe.includes('invoker:"private"')&&probe.includes("enforceAppCheck:true"));
assert(probe.includes('synthetic.test(id)'));
assert(!/\.set\(|\.update\(|\.create\(|\.delete\(/.test(probe));
assert.deepEqual([...probe.matchAll(/exports\.([A-Za-z0-9_]+)=/g)].map(m=>m[1]),["g02AuthzProbe"]);
console.log("P220_EXACT_P188_PATCH_GUARDS=PASS");
console.log("P220_SYNTHETIC_TEST_ONLY_FIRESTORE_READ=PASS");
console.log("P220_PRIVATE_IAM_APPCHECK_REQUIRED=PASS");
console.log("P220_RELEASE=NO_GO_RELEASE");
