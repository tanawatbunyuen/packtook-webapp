// PACKTOOK V7.2 — SECRET_ONLY guarded operator path, OFFLINE regression.
// No gcloud, no real Secret, no deployments. Validate conservative gating only.
import assert from "node:assert/strict";
import fs from "node:fs";
import {assessSecretOnlyGate} from "./v72-secret-only-gate.mjs";

const shell=fs.readFileSync(new URL("./v72-provision-secret-only.sh",import.meta.url),"utf8");
const gate=fs.readFileSync(new URL("./v72-secret-only-gate.mjs",import.meta.url),"utf8");
const base={
 project:"packtook-prod-01",phase:"SECRET_CREATE_APPROVAL_REQUIRED",
 candidateForOwnerApprovedSecretProvision:true,
 publicProbe:{closed:true,explicitEnabledSeen:false},
 observed:{secretResource:"NOT_FOUND",pilotFunctionDeployed:false,
  statusFunctionDeployed:true},
 errors:[],decision:"NO_GO_CONTROLLED_PILOT",readyForPilot:false,
 readyForPublic:false,productionChangesPerformed:false,
 productionProvisioningAuthorized:false,functionsDeploymentAuthorized:false
};
const success=assessSecretOnlyGate(base);
assert.equal(success.pass,true);
assert.equal(success.iamChangeAuthorized,false);
assert.equal(success.functionsDeployAuthorized,false);
assert.equal(success.cloudMutationPerformed,false);
assert.equal(success.pilotGoAuthorized,false);
assert.equal(success.requiresInteractiveOwnerExecution,true);
console.log("PASS: exact source and Prod Public OFF + missing Secret + Owner execution required");

const mutations=[
 {project:"packtook-staging"}, {phase:"HALT_INSPECTION_REQUIRED"},
 {candidateForOwnerApprovedSecretProvision:false},
 {publicProbe:{closed:false,explicitEnabledSeen:false}},
 {publicProbe:{closed:true,explicitEnabledSeen:true}},
 {observed:{...base.observed,secretResource:"FOUND"}},
 {observed:{...base.observed,pilotFunctionDeployed:true}},
 {observed:{...base.observed,statusFunctionDeployed:false}},
 {errors:["STATUS_CALLABLE_UNVERIFIED"]},{decision:"GO"},
 {readyForPilot:true},{readyForPublic:true},
 {productionChangesPerformed:true},{productionProvisioningAuthorized:true},
 {functionsDeploymentAuthorized:true}
];
for(const mutation of mutations){
 const verdict=assessSecretOnlyGate({...base,...mutation});
 assert.equal(verdict.pass,false,"Unexpected secret creation candidate: "+JSON.stringify(mutation));
 assert(verdict.reasons.length>0);
}
console.log("PASS: staging, existing Secret, Public ON/unknown, deployed Pilot, changed cloud and release GO all blocked");

for(const required of [
 "set +x","set -Eeuo pipefail","umask 077",
 "packtook-prod-01","PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX",
 '"--dry-run"','"--execute"',
 "v72-secret-only-gate.mjs", "check_secret_absent",
 "CREATE-PACKTOOK-HMAC-SECRET-ONLY",
 "secrets.token_hex(32)", "gcloud secrets create",
 "--data-file=-","--replication-policy=automatic",
 "gcloud secrets versions list","grep -qx \"ENABLED\""
])assert(shell.includes(required),"Required guard missing: "+required);
assert.equal(shell.match(/review_gate\b/g).length,3,
 "Expected only definition + initial check + final just-before-create gate");
assert(shell.indexOf("read -r -p")<shell.indexOf("gcloud secrets create"),
 "Owner confirmation must precede actual mutation");
assert(shell.indexOf("review_gate",shell.indexOf("read -r -p"))<
 shell.indexOf("gcloud secrets create"),"Second fresh read-only check needed before create");
assert(shell.includes('output" != *"NOT_FOUND"*'));
assert(shell.includes('output" == *"PERMISSION_DENIED"*'));
assert(shell.includes('output" == *"403"*'));
assert(shell.includes('output" == *"UNAUTHENTICATED"*'));
assert(gate.includes("readPublicSafetyEvidence()"));
assert(gate.includes("auditWithRunner(source)"));
assert(gate.includes("productionProvisioningAuthorized"));
const forbidden=[
 "gcloud secrets versions access","gcloud secrets versions add",
 "gcloud secrets versions destroy","gcloud secrets versions disable",
 "gcloud secrets delete","gcloud secrets add-iam-policy-binding",
 "gcloud projects add-iam-policy-binding",
 "firebase deploy","gcloud functions deploy",
 "gcloud services enable", "gcloud config set project",
 "firebase functions:secrets:set", "print-access-token"
];
for(const item of forbidden)assert(!shell.includes(item),"Unexpected mutation/secret-read code: "+item);
assert(!gate.includes("gcloud secrets create"));
console.log("PASS: fail-closed Shell guards, one create-only mutation, no IAM/Functions/Public changes or payload reads");
console.log("RESULT: PACKTOOK V7.2 SECRET_ONLY OPERATOR SCRIPT OFFLINE SAFETY PASS (not executed on Production)");
