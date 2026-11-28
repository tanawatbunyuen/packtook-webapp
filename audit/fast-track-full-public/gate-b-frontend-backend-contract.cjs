"use strict";
/**
 * PACKTOOK API contract gate: static fail-closed frontend->backend source audit.
 * Node built-ins only. No Firebase, network, payment or cloud calls.
 * Exit 3 when a browser-referenced callable has no local onCall export.
 * Deployed Functions may differ; missing local exports alone cannot prove live 404.
 */
const fs=require("node:fs");
const assert=require("node:assert/strict");
const bridge=fs.readFileSync("firebase-staging/firebase-packing-bridge.js","utf8");
const backend=fs.readFileSync("functions/index.js","utf8");
const declared=[...backend.matchAll(/exports\.([A-Za-z_]\w*)\s*=\s*(onCall|onRequest)\s*\(/g)];
const callableExports=new Set(declared.filter(m=>m[2]==="onCall").map(m=>m[1]));
const browserCalls=[...bridge.matchAll(/\b(?:api|protectedApi)\("([A-Za-z_]\w*)"\)/g)].map(m=>m[1]);
assert.equal(browserCalls.length,28,"Unexpected browser callable reference count: review scanner");
const uniqueCalls=[...new Set(browserCalls)];
assert.equal(uniqueCalls.length,27,"Unexpected unique browser callable name count: review scanner");
const duplicates=uniqueCalls.filter(name=>browserCalls.filter(call=>call===name).length>1);
assert.deepEqual(duplicates,["subscriptionOverview"],"Duplicated callable mapping changed");
assert.equal(declared.length,23,"Backend export inventory drift: review scanner");
const missing=uniqueCalls.filter(name=>!callableExports.has(name)).sort();
const unused=[...callableExports].filter(name=>!uniqueCalls.includes(name)).sort();
console.log("PACKTOOK_CHECK=FEATURE_SOURCE_BROWSER_BACKEND_API_CONTRACT");
console.log("PACKTOOK_BROWSER_CALLABLE_REFERENCES="+browserCalls.length);
console.log("PACKTOOK_BROWSER_UNIQUE_CALLABLE_NAMES="+uniqueCalls.length);
console.log("PACKTOOK_DUPLICATE_CALLABLE_BINDING_NAMES="+(duplicates.join(",")||"NONE"));
console.log("PACKTOOK_BACKEND_EXPORT_DECLARATIONS="+declared.length);
console.log("PACKTOOK_BROWSER_MISSING_LOCAL_EXPORTS="+missing.length);
console.log("PACKTOOK_BROWSER_MISSING_LOCAL_EXPORT_NAMES="+(missing.join(",")||"NONE"));
console.log("PACKTOOK_BACKEND_CALLABLES_NOT_IN_BROWSER="+unused.join(","));
console.log("PACKTOOK_LIVE_STAGING_EXPORTS=NOT_VERIFIED");
console.log("PACKTOOK_CLOUD_WRITES=0");
console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
if(missing.length){
 console.log("PACKTOOK_API_CONTRACT=BLOCKED_SOURCE_EXPORT_GAP");
 process.exitCode=3;
}else{
 console.log("PACKTOOK_API_CONTRACT=PASS_STATIC_ONLY");
}
