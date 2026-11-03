// PACKTOOK V7.2 — offline, non-mutating remediation plan regression tests.
// Never invokes GCP or HTTP, and never supplies real identities/secret bytes.
import assert from "node:assert/strict";
import fs from "node:fs";
import {planV72SecretRemediation} from "./v72-secret-changeplan.mjs";
const source=fs.readFileSync(new URL("./v72-secret-changeplan.mjs",import.meta.url),"utf8");
const base={
 source:{pass:true},
 secret:{resourcePresent:false,inspectionError:"NOT_FOUND",enabledVersionCount:null},
 cloudFunctions:[
  {name:"publicSignupStatus",deployed:true,secretBound:false},
  {name:"completeFreeSignup",deployed:null},
  {name:"pilotInvitationStatus",deployed:null},
  {name:"completePilotFreeSignup",deployed:null}
 ],
 checks:{secretIAMPolicyReadable:false,runtimeAccountsIdentified:true,
  deployedPublicStatus:true,secretPolicyBroadGrant:null,projectPolicyBroadGrant:false},
 iam:{runtimeBindings:[]}
};
const remote={
 marketing:{http:200},customer:{http:200},
 status:{http:200,reachable:true,publicSignupEnabled:false,publicAccessEnabled:false}
};
const evaluate=(a=base,r=remote)=>planV72SecretRemediation(a,r);
const expected=evaluate();
assert.equal(expected.phase,"SECRET_CREATE_APPROVAL_REQUIRED");
assert.equal(expected.candidateForOwnerApprovedSecretProvision,true);
assert.equal(expected.productionChangesPerformed,false);
assert.equal(expected.productionProvisioningAuthorized,false);
assert.equal(expected.functionsDeploymentAuthorized,false);
assert.equal(expected.readyForPilot,false);
assert.equal(expected.readyForPublic,false);
assert.equal(expected.decision,"NO_GO_CONTROLLED_PILOT");
assert.equal(expected.observed.statusSecretBound,false);
assert.equal(expected.observed.secretResource,"NOT_FOUND");
assert.equal(expected.steps.length,4);
assert(!JSON.stringify(expected).includes("serviceAccount:"));
console.log("PASS: observed missing HMAC Secret yields owner-approval-only candidate; no Production changes authorized");

for(const mutation of [
 {source:{pass:false}}, {secret:{resourcePresent:false,inspectionError:"PERMISSION_DENIED"}},
 {secret:{resourcePresent:false,inspectionError:"UNVERIFIED"}},
 {cloudFunctions:base.cloudFunctions.map(f=>
  f.name==="pilotInvitationStatus"?{...f,deployed:true}:f)},
 {cloudFunctions:base.cloudFunctions.map(f=>
  f.name==="publicSignupStatus"?{...f,deployed:null}:f)}
]){
 const result=evaluate({...base,...mutation});
 assert.equal(result.candidateForOwnerApprovedSecretProvision,false);
 assert.equal(result.phase,"HALT_INSPECTION_REQUIRED");
 assert.equal(result.readyForPilot,false);
}
for(const status of [
 {...remote,status:{...remote.status,publicSignupEnabled:true}},
 {...remote,status:{...remote.status,publicAccessEnabled:true}},
 {...remote,status:{...remote.status,http:null,reachable:false,
  publicSignupEnabled:null,publicAccessEnabled:null}},
 {...remote,marketing:{http:503}},
 {...remote,customer:{http:null}}
]){
 const result=evaluate(base,status);
 assert.equal(result.candidateForOwnerApprovedSecretProvision,false);
 assert(result.errors.includes("PUBLIC_FLAGS_OR_HOSTING_NOT_CONFIRMED_CLOSED"));
}
console.log("PASS: unverified Secret, deployed Pilot, missing status, Public ON and web outage stop provisioning plan");

const secretExists=evaluate({...base,
 secret:{resourcePresent:true,enabledVersionCount:1},
 checks:{...base.checks,secretIAMPolicyReadable:true},
 iam:{runtimeBindings:[{directSecretAccessor:true}]}});
assert.equal(secretExists.phase,"SCOPED_IAM_AND_FUNCTION_REVISION_REVIEW_REQUIRED");
assert.equal(secretExists.candidateForOwnerApprovedSecretProvision,false);
assert.equal(secretExists.observed.enabledVersionVerified,true);
const missingVersion=evaluate({...base,
 secret:{resourcePresent:true,enabledVersionCount:0}});
assert.equal(missingVersion.phase,"SECRET_VERSION_SECURITY_REVIEW_REQUIRED");
const broad=evaluate({...base,secret:{resourcePresent:true,enabledVersionCount:1},
 checks:{...base.checks,secretIAMPolicyReadable:true,secretPolicyBroadGrant:true}});
assert.equal(broad.phase,"OVERBROAD_IAM_REVIEW_REQUIRED");
console.log("PASS: existing Secret never reprovisioned or rotated; disabled version and broad IAM separately flagged");

for(const forbidden of [
 "secrets versions access","add-iam-policy-binding","firebase deploy",
 "gcloud secrets create","functions:secrets:set",
 "writeFileSync","execFileSync","spawnSync","getAuth"
])assert(!source.includes(forbidden),"Planner must never contain executable write method: "+forbidden);
assert(source.includes("auditWithRunner(source)"));
assert(source.includes("probe()"));
assert(!source.includes("secretPayload"));
console.log("PASS: planner only imports read-only audit and HTTP preflight; no writes or secret payload");
console.log("RESULT: PACKTOOK V7.2 SECRET CHANGEPLAN OFFLINE REGRESSION PASS (NOT Production approval)");
