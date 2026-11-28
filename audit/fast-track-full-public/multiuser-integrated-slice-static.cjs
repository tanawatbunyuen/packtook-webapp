"use strict";
/**
 * Fail-closed static integration gate for a NOT-DEPLOYABLE multiuser slice.
 * Does not require/import firebase-admin and performs zero Firebase requests.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("functions/index.js","utf8");
const operator=fs.readFileSync("functions/operator-callables-v1.cjs","utf8");
const atomic=fs.readFileSync("functions/tenant-credit-atomic-v1.cjs","utf8");
const bridge=fs.readFileSync("firebase-staging/firebase-packing-bridge.js","utf8");
const direct=[...source.matchAll(/exports\.([A-Za-z_]\w*)\s*=\s*(onCall|onRequest)\s*\(/g)];
const directCallable=direct.filter(m=>m[2]==="onCall").map(m=>m[1]);
const moduleCallable=[...operator.matchAll(/handlers\.([A-Za-z_]\w*)\s*=\s*onCall\(options,/g)].map(m=>m[1]);
const all=new Set([...directCallable,...moduleCallable]);
const client=[...new Set([...bridge.matchAll(/\b(?:api|protectedApi)\("([A-Za-z_]\w*)"\)/g)].map(m=>m[1]))];
assert.equal(directCallable.length,22,"Existing callable export count changed");
assert.equal(moduleCallable.length,8,"Eight operator APIs must exist");
assert.equal(new Set(moduleCallable).size,8,"Duplicate operator handlers");
assert.equal(all.size,30,"Unified callable count must be 30");
assert.equal(client.length,27,"Client callable names drift");
assert.deepEqual(client.filter(x=>!all.has(x)),[],"Browser API contract gap");
assert.match(source,/Object\.assign\(exports,createOperatorCallables\(\{db,FieldValue,HttpsError,onCall,options\}\)\)/);
assert.match(source,/const options=\{[^;]*enforceAppCheck:true\}/);
assert.match(operator,/if\(!db\|\|!FieldValue\|\|!HttpsError\|\|!onCall\|\|!options\?\.enforceAppCheck\)/);
for(const name of ["reserveCredit","finalizeCredit","usageStatus","recordingStatus","registerDevice","deviceStatus","removeDevice","accountRole"]){
 const start=source.indexOf("exports."+name+"=onCall");
 const end=source.indexOf("\nexports.",start+10);
 assert.ok(start>=0,name+" missing");
 const body=source.slice(start,end<0?undefined:end);
 assert.match(body,/const a=await creditActor\(req\)/,name+" tenant branch missing");
 assert.match(body,/if\(a\.operator\)/,name+" operator branch missing");
}
assert.match(source,/const existingMembership=await db\.collection\("operatorMemberships"\)\.doc\(id\)\.get\(\)/);
assert.match(source,/if\(existingMembership\.exists\)[\s\S]*?Operator must use shared tenant account/);
assert.match(source,/atomicCredit\.reserve\(/);
assert.match(source,/atomicCredit\.finalize\(/);
assert.match(atomic,/db\.runTransaction\(async tx=>/);
console.log("PACKTOOK_INTEGRATED_SOURCE_CALLABLES=30/30");
console.log("PACKTOOK_BROWSER_CLIENT_BINDINGS=27/27_SATISFIED");
console.log("PACKTOOK_OPERATOR_CALLABLES_WIRED_SOURCE_ONLY=8/8");
console.log("PACKTOOK_TENANT_CREDIT_DEVICE_STATUS_BRANCHES=8/8");
console.log("PACKTOOK_OPERATOR_FREE_ACCOUNT_PROVISIONING_GUARD=STATIC_PRESENT");
console.log("PACKTOOK_RUNTIME_HANDLER_E2E=NOT_EXECUTED");
console.log("PACKTOOK_STAGING_DEPLOY=NOT_PERFORMED");
console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
