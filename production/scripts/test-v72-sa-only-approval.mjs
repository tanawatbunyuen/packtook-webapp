// PACKTOOK V7.2 SA_ONLY no-write fixtures. Real Bash syntax parsing, no GCP.
import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {assessSaOnlyGate} from "./v72-sa-only-gate.mjs";

const shellPath=fileURLToPath(new URL("./v72-create-dedicated-sa-only.sh",import.meta.url));
const shell=fs.readFileSync(shellPath,"utf8");
const gate=fs.readFileSync(new URL("./v72-sa-only-gate.mjs",import.meta.url),"utf8");
assert.doesNotThrow(()=>
 execFileSync("bash",["-n",shellPath],{stdio:"pipe",timeout:5000}),
 "SA_ONLY shell syntax must parse before operator uses it");
const bad=shell.replace('== "feature/v7.2-controlled-public-pilot-readiness" ]]',
 '==\n "feature/v7.2-controlled-public-pilot-readiness" ]]');
assert.notEqual(bad,shell);
assert.throws(()=>execFileSync("bash",["-n","-c",bad],{stdio:"pipe",timeout:5000}),
 "Bash parser must reject broken multiline comparison");
console.log("PASS: real SA_ONLY Bash parser valid and previously broken branch conditional rejected");

const safe={
 project:"packtook-prod-01",
 phase:"DEDICATED_SA_CREATION_APPROVAL_REQUIRED",
 candidateForSeparateSAOnlyApproval:true,
 account:{resourcePresent:false,inspectionError:"NOT_FOUND"},
 publicProbe:{closed:true,explicitEnabledSeen:false,marketingHttp:200,
  customerHttp:200,statusHttp:200,publicSignupEnabled:false,
  publicAccessEnabled:false},source:{fourFunctionBindingVerified:true,
  betaSharedOptionsUnchanged:true},
 secret:{resourcePresent:true,hasEnabledVersion:true},
 errors:[],decision:"NO_GO_CONTROLLED_PILOT",
 readyForPilot:false,readyForPublic:false,
 accountCreationAuthorized:false,accountCreationPerformed:false,
 secretIamGrantAuthorized:false,functionsDeployAuthorized:false
};
const pass=assessSaOnlyGate(safe);
assert.equal(pass.pass,true);
assert.equal(pass.readOnly,true);
assert.equal(pass.accountCreated,false);
assert.equal(pass.operatorOwnerApprovalRequired,true);
assert.equal(pass.iamGrantsAuthorized,false);
assert.equal(pass.functionDeploymentAuthorized,false);
assert.equal(pass.pilotAuthorized,false);
for(const change of [
 {project:"another-project"},
 {phase:"DEDICATED_SA_EXISTS_PERMISSIONS_AND_DEPLOY_REVIEW_REQUIRED"},
 {candidateForSeparateSAOnlyApproval:false},
 {account:{resourcePresent:true,inspectionError:null}},
 {account:{resourcePresent:null,inspectionError:"PERMISSION_DENIED"}},
 {account:{resourcePresent:null,inspectionError:"TIMEOUT"}},
 {publicProbe:{...safe.publicProbe,closed:false}},
 {publicProbe:{...safe.publicProbe,marketingHttp:null}},
 {publicProbe:{...safe.publicProbe,customerHttp:503}},
 {publicProbe:{...safe.publicProbe,statusHttp:null}},
 {publicProbe:{...safe.publicProbe,publicSignupEnabled:null}},
 {publicProbe:{...safe.publicProbe,publicAccessEnabled:true}},
 {publicProbe:{...safe.publicProbe,explicitEnabledSeen:true}},
 {source:{fourFunctionBindingVerified:false,betaSharedOptionsUnchanged:true}},
 {source:{fourFunctionBindingVerified:true,betaSharedOptionsUnchanged:false}},
 {secret:{resourcePresent:false,hasEnabledVersion:false}},
 {errors:["UNVERIFIED"]},
 {decision:"GO"}, {readyForPilot:true}, {readyForPublic:true},
 {accountCreationAuthorized:true}, {accountCreationPerformed:true},
 {secretIamGrantAuthorized:true},{functionsDeployAuthorized:true}
]){
 const badResult=assessSaOnlyGate({...safe,...change});
 assert.equal(badResult.pass,false,
  "Unsafe state must fail closed: "+JSON.stringify(change));
 assert(badResult.reasons.length>0);
}
console.log("PASS: Source, Public, Secret, wrong project, existing SA, IAM/deploy GO and 403 all blocked");

const expected=[
 "set +x","set -Eeuo pipefail","umask 077",
 "ACCOUNT_ID=\"packtook-public-pilot-v72\"",
 "v72-sa-only-gate.mjs","--dry-run","--execute",
 "check_account_absent","NOT_FOUND","PERMISSION_DENIED",
 "CREATE-PACKTOOK-DEDICATED-SA-ONLY",
 "gcloud iam service-accounts create",
 "--display-name","--description",
 "gcloud iam service-accounts describe",
 "git rev-parse --abbrev-ref HEAD"
];
for(const k of expected)assert(shell.includes(k),"Missing safe operator guard: "+k);
assert.equal(shell.split('gcloud iam service-accounts create "$ACCOUNT_ID"').length-1,1);
assert.equal(shell.split("review_gate").length-1,3,
 "Expected definition, initial check and pre-create recheck only");
assert(shell.indexOf('read -r -p')<shell.indexOf('gcloud iam service-accounts create "$ACCOUNT_ID"'));
assert(shell.indexOf("review_gate",shell.indexOf("read -r -p"))<
 shell.indexOf('gcloud iam service-accounts create "$ACCOUNT_ID"'));
for(const forbidden of [
 "gcloud projects add-iam-policy-binding",
 "gcloud iam service-accounts add-iam-policy-binding",
 "gcloud secrets add-iam-policy-binding",
 "gcloud iam service-accounts keys create",
 "firebase deploy", "gcloud functions deploy",
 "gcloud services enable","gcloud config set project","gcloud secrets versions access"
]){
 assert(!shell.includes(forbidden),"Operator script may not include "+forbidden);
 assert(!gate.includes(forbidden),"Read-only gate may not include "+forbidden);
}
assert(!gate.includes('gcloud iam service-accounts create'));
console.log("PASS: single create-only SA action after two read-only gates and owner typed confirmation");
console.log("RESULT: V7.2 SA_ONLY OFFLINE REGRESSION PASS — NOT GCP EXECUTION OR APPROVAL");
