// PACKTOOK V7.2 admission-only preflight OFFLINE unit fixtures (NO CLOUD CALLS).
import assert from "node:assert/strict";
import fs from "node:fs";
import {assess} from "./v72-admission-deploy-preflight.mjs";
const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const config=JSON.parse(fs.readFileSync(new URL("../firebase.json",import.meta.url),"utf8"));
const status={name:"publicSignupStatus",deployed:true,state:"ACTIVE",
 serviceAccountClass:"LEGACY_COMPUTE",secretBound:false};
const pilots=["pilotInvitationStatus","completePilotFreeSignup"].map(name=>({
 name,deployed:false,inspectionError:"NOT_FOUND"}));
const publicProbe={closed:true,explicitEnabledSeen:false,
 marketingHttp:200,customerHttp:200,statusHttp:200,
 publicSignupEnabled:false,publicAccessEnabled:false};
const safe={source,config,branch:"feature/v7.2-controlled-public-pilot-readiness",
 clean:true,project:"packtook-prod-01",publicProbe,status,pilots,
 serviceAccountActive:true,roleVerified:true,secretGrantVerified:true,cliAvailable:true};
const good=assess(safe);
assert.equal(good.pass,true,JSON.stringify(good.errors));
assert.equal(good.decision,"NO_GO_CONTROLLED_PILOT");
assert.equal(good.productionDeployPerformed,false);
assert.equal(good.deployAuthorized,false);
assert.equal(good.pilotAuthorized,false);
assert(!good.proposedTargetSelector.includes("publicSignupStatus"));
const bad=[
 {project:"unapproved"},
 {branch:"main"},
 {clean:false},
 {publicProbe:{...publicProbe,publicAccessEnabled:true}},
 {publicProbe:{...publicProbe,statusHttp:503}},
 {publicProbe:{...publicProbe,explicitEnabledSeen:true}},
 {status:{...status,state:"UNKNOWN"}},
 {status:{...status,serviceAccountClass:"DEDICATED_V72"}},
 {status:{...status,secretBound:true}},
 {pilots:[{...pilots[0],deployed:true},pilots[1]]},
 {pilots:[{...pilots[0],inspectionError:"PERMISSION_DENIED",deployed:null},pilots[1]]},
 {serviceAccountActive:false},{roleVerified:false},{secretGrantVerified:false},
 {cliAvailable:false},{source:source.replace("exports.pilotInvitationStatus=onCall(","exports.fakePilot=onCall(")},
 {config:{functions:[{codebase:"wrong",source:"functions"}]}}
];
for(const c of bad) {
 const outcome=assess({...safe,...c});
 assert.equal(outcome.pass,false,JSON.stringify(c));
 assert(outcome.errors.length>0);
 assert.equal(outcome.decision,"NO_GO_CONTROLLED_PILOT");
}
console.log("PASS: exact beta target selector excludes live public status and all other codebases");
console.log("PASS: safe closed Public + active legacy status + absent Pilot targets + scoped runtime IAM");
console.log("PASS: 17 negative fixtures fail closed without deploying, creating IAM or enabling Pilot");
console.log("RESULT: V7.2 ADMISSION DEPLOY PREFLIGHT OFFLINE FIXTURES PASS; NOT CLOUD RUNTIME APPROVAL");
