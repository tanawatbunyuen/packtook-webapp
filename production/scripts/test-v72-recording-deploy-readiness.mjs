// PACKTOOK V7.2 recording readiness OFFLINE fixtures (no Cloud access).
import assert from "node:assert/strict";
import fs from "node:fs";
import {evaluate} from "./v72-recording-deploy-readiness.mjs";
const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const config=JSON.parse(fs.readFileSync(new URL("../firebase.json",import.meta.url),"utf8"));
const names=["usageStatus","reserveCredit","finalizeCredit","registerDevice",
 "deviceStatus","recordingStatus","pendingVideoReservations",
 "recoverStaleVideoReservation","removeDevice","authorizeDuplicate",
 "accountRole","subscriptionOverview"];
const active=(name,identity="LEGACY_BETA")=>({
 name,exists:true,state:"ACTIVE",identity,revision:"test-revision-001",
 revisionCaptured:true,codebaseLabel:"beta",secretBindings:[],hasSecretVolumes:false
});
const publicProbe={closed:true,explicitEnabledSeen:false,
 marketingHttp:200,customerHttp:200,statusHttp:200,
 publicSignupEnabled:false,publicAccessEnabled:false};
const baseline={source,config,branch:"feature/v7.2-controlled-public-pilot-readiness",
 clean:true,project:"packtook-prod-01",publicProbe,
 admission:[active("pilotInvitationStatus","DEDICATED_PILOT"),
   active("completePilotFreeSignup","DEDICATED_PILOT")].map(x=>({
    ...x,secretBindings:["PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX"]})),
 pub:active("publicSignupStatus"),
 recording:names.map(x=>active(x)),ownerRollbackReviewed:true};
const ok=evaluate(baseline);
assert.equal(ok.metadataGatePass,true,JSON.stringify(ok));
assert.equal(ok.deploymentApproved,false);
assert.equal(ok.prodWrites,false);
assert.equal(ok.decision,"NO_GO_CONTROLLED_PILOT");
assert.equal(ok.publicStatusNotTargeted,true);
assert.equal(ok.admissionNotTargeted,true);
assert.equal(ok.selectorForFutureApproval.split(",").length,12);
const cases=[
 {clean:false},{branch:"main"},{project:"other"},
 {publicProbe:{...publicProbe,closed:false}},
 {publicProbe:{...publicProbe,publicAccessEnabled:true}},
 {pub:{...baseline.pub,identity:"DEDICATED_PILOT"}},
 {admission:baseline.admission.map((x,i)=>i===0?{...x,secretBindings:[]}:x)},
 {recording:baseline.recording.slice(1)},
 {recording:baseline.recording.map((x,i)=>i===0?{...x,state:"FAILED"}:x)},
 {recording:baseline.recording.map((x,i)=>i===0?{...x,identity:"OTHER_OR_UNKNOWN"}:x)},
 {recording:baseline.recording.map((x,i)=>i===0?{...x,revision:null,revisionCaptured:false}:x)},
 {recording:baseline.recording.map((x,i)=>i===0?{...x,codebaseLabel:null}:x)},
 {source:source.replace("exports.finalizeCredit=guardedCall(options","exports.finalizeCredit=onCall(options")},
 {ownerRollbackReviewed:false}
];
for(const item of cases){
 const result=evaluate({...baseline,...item});
 assert.equal(result.metadataGatePass,false,"negative fixture unexpectedly passed");
 assert.equal(result.deploymentApproved,false);
 assert.equal(result.prodWrites,false);
}
console.log("PASS: 12 exact recording export targets; Public/Admission excluded");
console.log("PASS: metadata source/Beta/rollback fixture without any Cloud API");
console.log("PASS: 14 negative fixtures fail closed for drift, missing revision and owner approval");
console.log(JSON.stringify({mode:"OFFLINE_RECORDING_READINESS_TEST",
 pass:true,negativeCases:cases.length,prodWrites:false,
 deployApproved:false,decision:"NO_GO_CONTROLLED_PILOT"},null,2));
