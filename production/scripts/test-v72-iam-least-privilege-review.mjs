// PACKTOOK V7.2 IAM review OFFLINE fixtures: no GCP requests, no writes.
import assert from "node:assert/strict";
import fs from "node:fs";
import {assessV72IamReview} from "./v72-iam-least-privilege-review.mjs";

const src=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const toolSource=fs.readFileSync(new URL("./v72-iam-least-privilege-review.mjs",import.meta.url),"utf8");
const audit={
 source:{pass:true},
 secret:{resourcePresent:true,versionsInspected:true,enabledVersionCount:1},
 checks:{secretPolicyBroadGrant:false,projectPolicyBroadGrant:false},
 iam:{secretPolicyReadable:true,projectPolicyReadable:true},
 cloudFunctions:[
  {name:"publicSignupStatus",deployed:true,secretBound:false,
   runtimeServiceAccountKnown:true,metadataReadable:true},
  {name:"completeFreeSignup",deployed:null,metadataReadable:false,inspectionError:"NOT_FOUND"},
  {name:"pilotInvitationStatus",deployed:null,metadataReadable:false,inspectionError:"NOT_FOUND"},
  {name:"completePilotFreeSignup",deployed:null,metadataReadable:false,inspectionError:"NOT_FOUND"}
 ]
};
const remoteEvidence={diagnostic:{closed:true,explicitEnabledSeen:false,
 attempts:1,reasons:[]}};
const run=(a=audit,r=remoteEvidence,s=src)=>assessV72IamReview({audit:a,
 remoteEvidence:r,source:s});
const ok=run();
assert.equal(ok.phase,"SCOPED_IAM_REVIEW_CANDIDATE_NOT_AUTHORIZED");
assert.equal(ok.reviewCandidate,true);
assert.equal(ok.statuses.secretResourceExists,true);
assert.equal(ok.statuses.enabledVersionPresent,true);
assert.equal(ok.statuses.statusRuntimeAccountKnown,true);
assert.equal(ok.statuses.statusCurrentRevisionSecretBound,false);
assert.equal(ok.statuses.futureRuntimeIdentityVerified,false);
assert.equal(ok.statuses.futureFunctionRuntimeServiceAccountPinnedInSource,true);
assert.equal(ok.canGrantIAMNow,false);
assert.equal(ok.iamChangeAuthorized,false);
assert.equal(ok.performedIAMWrites,false);
assert.equal(ok.deployedFunctionChangesAuthorized,false);
assert.equal(ok.readSecretPayload,false);
assert.equal(ok.readyForPilot,false);
assert.equal(ok.decision,"NO_GO_CONTROLLED_PILOT");
assert(ok.blockers.includes("PROPOSED_DEDICATED_RUNTIME_ACCOUNT_EXISTENCE_AND_PERMISSIONS_NOT_VERIFIED"));
assert(ok.blockers.includes("EXACT_SECRET_SCOPED_IAM_GRANT_OWNER_APPROVAL_REQUIRED"));
assert(ok.blockers.includes("CURRENT_STATUS_REVISION_HAS_NO_SECRET_BINDING"));
assert.equal(run(audit,remoteEvidence,
 src.replace('serviceAccount:PUBLIC_PILOT_RUNTIME_SA','serviceAccount:UNSAFE_DEFAULT')
 ).statuses.futureFunctionRuntimeServiceAccountPinnedInSource,false,
 "One modified Public/Pilot source must invalidate the dedicated account contract");

console.log("PASS: HMAC Secret present, current status Function account observed, future revision IAM NOT authorized");

const unsafe=[
 {audit:{...audit,source:{pass:false}}},
 {audit:{...audit,secret:{...audit.secret,resourcePresent:false}}},
 {audit:{...audit,secret:{...audit.secret,enabledVersionCount:0}}},
 {audit:{...audit,iam:{...audit.iam,secretPolicyReadable:false}}},
 {audit:{...audit,checks:{...audit.checks,secretPolicyBroadGrant:true}}},
 {audit:{...audit,checks:{...audit.checks,projectPolicyBroadGrant:null}}},
 {audit:{...audit,cloudFunctions:audit.cloudFunctions.map(f=>f.name==="publicSignupStatus"?
  {...f,runtimeServiceAccountKnown:false}:f)}},
 {audit:{...audit,cloudFunctions:audit.cloudFunctions.map(f=>f.name==="pilotInvitationStatus"?
  {...f,deployed:true}:f)}},
 {audit:{...audit,cloudFunctions:audit.cloudFunctions.map(f=>f.name==="completeFreeSignup"?
  {...f,inspectionError:"PERMISSION_DENIED"}:f)}},
 {remoteEvidence:{diagnostic:{closed:false,explicitEnabledSeen:false}}},
 {remoteEvidence:{diagnostic:{closed:true,explicitEnabledSeen:true}}}
];
for(const item of unsafe){
 const result=run(item.audit||audit,item.remoteEvidence||remoteEvidence);
 assert.equal(result.reviewCandidate,false,"Unsafe readiness unexpectedly passed");
 assert.equal(result.canGrantIAMNow,false);
 assert.equal(result.iamChangeAuthorized,false);
 assert.equal(result.performedIAMWrites,false);
}
console.log("PASS: missing Secret/version, 403, unknown policy, broader IAM, Pilot live and public flags ON deny review");

const content=JSON.stringify(ok);
assert(!/serviceAccount:|iam\.gserviceaccount\.com|@/.test(content),"No IAM member or email output");
assert(!content.includes("secretPayload"),"No payload included");
const banned=[
 "gcloud secrets add-iam-policy-binding","gcloud projects add-iam-policy-binding",
 "setIamPolicy(","firebase deploy","secrets versions access",
 "gcloud functions deploy","gcloud secrets versions add",
 "execFileSync(","spawnSync(","writeFileSync(",
 "getSecretValue","console.log(source)"
];
for(const bad of banned)assert(!toolSource.includes(bad),"IAM review must be read-only: "+bad);
assert(toolSource.includes("auditWithRunner(source)"));
assert(toolSource.includes("readPublicSafetyEvidence()"));
assert(toolSource.includes("NO_GO_CONTROLLED_PILOT"));
console.log("PASS: no runtime principal or payload in sanitized output; source contains no IAM/Cloud writes");
console.log("RESULT: PACKTOOK V7.2 IAM LEAST PRIVILEGE OFFLINE SAFETY PASS (not production authorization)");
