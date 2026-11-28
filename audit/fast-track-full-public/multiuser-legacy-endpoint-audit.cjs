"use strict";
/** Source-only, fail-closed inventory of legacy handlers not yet multiuser-audited. */
const fs=require("node:fs"),assert=require("node:assert/strict");
const source=fs.readFileSync("functions/index.js","utf8");
const handlers=[...source.matchAll(/exports\.(\w+)\s*=\s*onCall\s*\(/g)].map(m=>{
 const next=source.indexOf("\nexports.",m.index+10);
 const part=source.slice(m.index,next<0?undefined:next);
 return {name:m[1],tenantBranch:part.includes("creditActor(req)"),
   accountProvision:part.includes("ensureAccount("),
   directOwn:part.includes("own(")||part.includes("ownerRef("),
   platformOwner:part.includes("requirePlatformOwner(req)")};
});
const integrated=handlers.filter(h=>h.tenantBranch);
const legacy=handlers.filter(h=>!h.tenantBranch);
assert.equal(handlers.length,22,"Original callable export count drift");
assert.equal(integrated.length,8,"Integrated tenant branches drift");
assert.equal(legacy.length,14,"Unreviewed legacy callable count drift");
assert.ok(legacy.some(h=>h.name==="pendingVideoReservations"));
assert.ok(legacy.some(h=>h.name==="recoverStaleVideoReservation"));
assert.ok(legacy.some(h=>h.name==="authorizeDuplicate"));
const risky=legacy.filter(h=>h.accountProvision||h.directOwn);
console.log("PACKTOOK_EXISTING_CALLABLES="+handlers.length);
console.log("PACKTOOK_INTEGRATED_TENANT_BRANCHES="+integrated.length);
console.log("PACKTOOK_LEGACY_HANDLERS_REQUIRING_DISPOSITION="+legacy.length);
console.log("PACKTOOK_LEGACY_HANDLER_NAMES="+legacy.map(h=>h.name).join(","));
console.log("PACKTOOK_LEGACY_ACCOUNT_PATH_HANDLERS="+risky.map(h=>h.name).join(","));
console.log("PACKTOOK_LEGACY_AUDIT=BLOCKED_UNTIL_OWNER_OPERATOR_DISPOSITION");
console.log("PACKTOOK_RUNTIME_E2E=NOT_EXECUTED");
console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
process.exitCode=3;
