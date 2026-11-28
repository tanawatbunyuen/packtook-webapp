"use strict";
/**
 * Fail-closed static disposition gate for the 14 original onCall handlers not
 * assigned tenant routing in the integrated multiuser feature candidate.
 * No Firebase imports, network calls, or database writes.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const s=fs.readFileSync("functions/index.js","utf8");
const legacyOwner=[
 "pendingVideoReservations","recoverStaleVideoReservation","authorizeDuplicate",
 "subscriptionOverview","billingHistory","requestPlanChange",
 "cancelUnpaidPlanRequest","omisePaymentConfig","createOmisePayment",
 "recoverOmiseCharge","omisePaymentStatus","paymentAudit"
];
const platformOwner=["ownerAnalyticsSummary","ownerAnalyticsCustomers"];
const routes=[...s.matchAll(/exports\.(\w+)\s*=\s*onCall\s*\(/g)];
assert.equal(routes.length,22,"Expected 22 original onCall exports");
const blocks=new Map(routes.map((m,i)=>[m[1],s.slice(m.index,i+1<routes.length?routes[i+1].index:undefined)]));
for(const name of legacyOwner){
 const block=blocks.get(name);
 assert.ok(block,"Missing legacy callable "+name);
 const first=block.indexOf("async req=>{"),guard=block.indexOf("await requireLegacyOwnerAccess(req);");
 assert.ok(first>=0&&guard>first&&guard-first<85,"Owner gate not at entry: "+name);
 assert.ok(!block.slice(first,guard).includes("ensureAccount("),"Unsafe provisioning before owner gate "+name);
}
for(const name of platformOwner){
 const block=blocks.get(name);
 assert.ok(block,"Missing platform callable "+name);
 assert.match(block,/requirePlatformOwner\(req\)/,"Platform-owner guard absent: "+name);
 assert.doesNotMatch(block,/await requireLegacyOwnerAccess\(req\)/);
}
assert.match(s,/async function requireLegacyOwnerAccess\(req\)/);
assert.match(s,/const actor=uid\(req\)/);
assert.match(s,/const membership=await db\.collection\("operatorMemberships"\)\.doc\(actor\)\.get\(\)/);
assert.match(s,/if\(membership\.exists\)[\s\S]*?Account owner endpoint; operator access forbidden/);
assert.match(s,/db\.collection\("operatorInviteIndex"\)\.doc\(emailDigest\(email\)\)\.get\(\)/);
assert.match(s,/if\(v\.status==="pending"&&v\.expiresAtMs>Date\.now\(\)\)/);
console.log("PACKTOOK_LEGACY_CALLABLE_DISPOSITION=14/14_STATIC_PASS");
console.log("PACKTOOK_LEGACY_OWNER_ONLY_ENTRY_GUARDS=12/12_STATIC_PASS");
console.log("PACKTOOK_PLATFORM_OWNER_CLAIMS_GUARDS=2/2_STATIC_PRESENT");
console.log("PACKTOOK_PENDING_INVITATION_GUARD=STATIC_PRESENT");
console.log("PACKTOOK_RUNTIME_AUTH_NEGATIVES=NOT_EXECUTED");
console.log("PACKTOOK_EMULATOR_CALLABLE_E2E=NOT_EXECUTED");
console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
