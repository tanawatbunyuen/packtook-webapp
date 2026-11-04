// PACKTOOK V7.2 — no cloud connection, no writes, no UID or secret data.
// Tests the read-only safety assessment only, NOT actual pilot admission.
import assert from "node:assert/strict";
import fs from "node:fs";
import {assessV72} from "./v72-pilot-readiness.mjs";

const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const manifest=JSON.parse(read("ops/v72-pilot-manifest.json"));
const backend=read("functions/index.js");
const script=read("scripts/v72-pilot-readiness.mjs");
const baseline={
 source:{criticalPass:true,antiAbuseSourcePass:true,secretBindingSourcePass:true},
 local:{qaOff:true,publicFlagsOff:true},
 customerAppId:{exactMatch:true},
 remote:{statusChecked:true,httpPass:true,
  publicSignupEnabled:false,publicAccessEnabled:false}
};
const operations={sourcePass:true};
const browser={sourcePass:true};
const run=(m=manifest,b=baseline,o=operations,src=backend,web=browser)=>assessV72({
 manifest:m,baseline:b,operations:o,backend:src,browser:web});
const change=(key,value)=>({...manifest,
 pilotPlan:{...manifest.pilotPlan,[key]:value}});
const good=run();
assert.equal(good.version,"7.2");
assert.equal(good.preparationSafetyPass,true);
assert.equal(good.readyForPilot,false);
assert.equal(good.readyForPublic,false);
assert.equal(good.decision,"NO_GO_CONTROLLED_PILOT");
assert.equal(good.proposedPilot.maxInvitedUsers,3);
assert.equal(good.proposedPilot.maxWindowHours,4);
assert.equal(good.proposedPilot.serverAllowlistImplemented,false);
assert.equal(good.sourceBaseline.pilotBackendSourcePass,true);
assert.equal(good.sourceBaseline.pilotBrowserSourcePass,true);
assert.equal(good.sourceBaseline.realBrowserAppCheckVerified,false);
assert.equal(good.proposedPilot.pilotBrowserDeployedAndAttested,false);
assert.equal(run(manifest,baseline,operations,backend,{sourcePass:false}).preparationSafetyPass,false);
assert(run(manifest,baseline,operations,backend,{sourcePass:false}).blockers.includes("PILOT_INVITE_BROWSER_SOURCE_CONTRACT_INCOMPLETE"));
assert.equal(good.sourceBaseline.pilotProtectedCallablesChecked,12);
assert.equal(good.proposedPilot.pilotBackendSourcePresent,true);
assert(!good.blockers.includes("PILOT_SOURCE_SECURITY_CONTRACT_INCOMPLETE"));
const missingPilotGuard=run(manifest,baseline,operations,
 backend.replace("exports.usageStatus=guardedCall", "exports.usageStatus=onCall"));
assert.equal(missingPilotGuard.preparationSafetyPass,false);
assert(missingPilotGuard.blockers.includes("PILOT_SOURCE_SECURITY_CONTRACT_INCOMPLETE"));
assert(good.blockers.includes("PILOT_SERVER_SIDE_COHORT_GUARD_NOT_RUNTIME_VERIFIED"));
assert(good.blockers.includes("OWNER_GO_NO_GO_SIGNOFF_REQUIRED"));
assert.equal(run(change("publicSignupEnabled",true)).preparationSafetyPass,false);
assert(run(change("publicSignupEnabled",true)).blockers.includes(
 "PUBLIC_QA_PILOT_OR_BILLING_FLAG_REQUESTED"));
for(const field of ["publicAccessEnabled","publicPoliciesApproved",
 "v70QaEnabled","pilotFlagsEnabled","omiseLiveEnabled"]){
 assert.equal(run(change(field,true)).preparationSafetyPass,false,"Must block "+field);
}
for(const bad of [0,6,500,"3",null]){
 assert.equal(run(change("maxInvitedUsers",bad)).preparationSafetyPass,false,
  "Unsafe cohort size must block");
}
for(const bad of [0,5,25,"4",null]){
 assert.equal(run(change("maxWindowHours",bad)).preparationSafetyPass,false,
  "Unsafe invitation TTL must block");
}
for(const field of ["invitedUsersStoredInGit","allowPublicAuthCreation",
 "genericSignupCTAVisible"])
 assert.equal(run(change(field,true)).preparationSafetyPass,false);
for(const field of ["customerAppCheckRequired",
 "requireVerifiedFirebaseAuthEmail","requireConsentEvidence",
 "preCreatedInvitedAuthUsersPreferred"])
 assert.equal(run(change(field,false)).preparationSafetyPass,false);
assert.equal(run(manifest,{...baseline,local:{
 ...baseline.local,qaOff:false}}).preparationSafetyPass,false);
assert.equal(run(manifest,{...baseline,local:{
 ...baseline.local,publicFlagsOff:false}}).preparationSafetyPass,false);
assert.equal(run(manifest,{...baseline,remote:{
 ...baseline.remote,publicAccessEnabled:true}}).preparationSafetyPass,false);
assert.equal(run(manifest,{...baseline,remote:{
 ...baseline.remote,statusChecked:false}}).preparationSafetyPass,false);
assert.equal(run(manifest,{...baseline,source:{
 ...baseline.source,secretBindingSourcePass:false}}).preparationSafetyPass,false);
assert.equal(run(manifest,baseline,{sourcePass:false}).preparationSafetyPass,false);
assert.equal(run({...manifest,productionDeployAuthorized:true}).readyForPilot,false);
assert.equal(run({...manifest,productionDeployAuthorized:true}).preparationSafetyPass,false);
assert.equal(run({...manifest,readyForPilot:true}).preparationSafetyPass,false);
assert.equal(run({...manifest,project:"another-project"}).preparationSafetyPass,false);
assert(run({...manifest,productionDeployAuthorized:true}).blockers.includes(
 "INVALID_OR_UNSAFE_PILOT_MANIFEST"));
const allEvidenceClaimed={...manifest,evidence:Object.fromEntries(
 Object.keys(manifest.evidence).map(k=>[k,"APPROVED"]))};
assert.equal(run(allEvidenceClaimed).readyForPilot,false,
 "Self-edited evidence must never override independent approval");
assert.equal(run(allEvidenceClaimed).decision,"NO_GO_CONTROLLED_PILOT");
assert(!/\bwriteFileSync\s*\(|\bfirebase\s+deploy\b|\bgcloud\s+.*\b(update|create|delete)\b/m.test(script),
 "Read-only pilot script must never mutate cloud or local evidence");
assert(script.includes("await probe()"));
assert(script.includes("loadLocalQa()"));
assert(script.includes("loadCustomerAppEvidence()"));
assert(script.includes("assessOperations(localSource.backend)"));
assert(!/"uid"\s*:|"email"\s*:|"secret"\s*:/i.test(JSON.stringify(manifest)));
console.log("PASS: closed cohort <=5, <=4h, non-public flags, test-only admission contract");
console.log("PASS: unsafe flags/UID list in Git/broad signup/long TTL blocked");
console.log("PASS: absent real Secret, IAM, Monitoring, legal, browser QA and owner evidence never authorize pilot");
console.log("PASS: read-only source and remote status inspection only; user evidence cannot self-authorize");
console.log("RESULT: PACKTOOK V7.2 CLOSED PILOT READINESS SAFETY PASS (source-only NO-GO)");
