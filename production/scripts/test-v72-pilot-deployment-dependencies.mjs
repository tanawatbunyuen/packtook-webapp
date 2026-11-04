// PACKTOOK V7.2 — OFFLINE deployment dependency/negative regression tests.
// No GCP calls, no deploy, no IAM writes. Do not treat PASS as rollout approval.
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const firebase=JSON.parse(fs.readFileSync(new URL("../firebase.json",import.meta.url),"utf8"));
const betaCodebase=(firebase.functions||[]).find(x=>x.codebase==="beta");
assert.equal(betaCodebase?.source,"functions","Wrong beta codebase path");

const admission=["pilotInvitationStatus","completePilotFreeSignup"];
const shared=[
 "usageStatus","reserveCredit","finalizeCredit","pendingVideoReservations",
 "recoverStaleVideoReservation","recordingStatus","registerDevice",
 "deviceStatus","removeDevice","authorizeDuplicate","accountRole",
 "subscriptionOverview"
];
const protectedCore=["usageStatus","reserveCredit","finalizeCredit","registerDevice","deviceStatus","recordingStatus"];
const sourceExportNames=[...source.matchAll(/^exports\.([A-Za-z][A-Za-z0-9]*)=/gm)].map(m=>m[1]);
function hasExport(name){return sourceExportNames.includes(name)}
for(const name of [...admission,...shared]) assert(hasExport(name),"Missing export "+name);
for(const name of shared){
 assert(source.includes("exports."+name+"=guardedCall(options,async req=>{"),"Shared call is not Pilot-lease guarded: "+name);
}
assert(source.includes("function guardedCall(callOptions,handler){"));
assert(source.includes("if(isPilotToken(req))"));
assert(source.includes("await requirePilotLease(req,{claimRequired:true});"));
assert(source.includes("PILOT_VALIDATED_REQUESTS.add(req)"));
assert(source.includes("isPilotToken(req)&&PILOT_VALIDATED_REQUESTS.has(req)"));
assert(source.includes("const options={region,maxInstances:5,timeoutSeconds:30};"));
assert(!/const options=\{[^\n]*serviceAccount/.test(source),"Beta shared runtime must remain unchanged");
for(const name of admission){
 const at=source.indexOf("exports."+name+"=onCall(");
 const end=source.indexOf("},async req=>",at);
 assert(at>=0&&end>at,"No callable options: "+name);
 const opt=source.slice(at,end);
 assert(opt.includes("enforceAppCheck:true"),"Pilot App Check missing: "+name);
 assert(opt.includes("serviceAccount:PUBLIC_PILOT_RUNTIME_SA"),"Dedicated pilot identity missing: "+name);
 assert(opt.includes("secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]"),"Secret binding missing: "+name);
}
assert(source.includes('const V72_PILOT_ENABLED=process.env.PACKTOOK_V72_PILOT_ENABLED==="true";'));
assert(source.includes("!PUBLIC_SIGNUP_ENABLED&&!PUBLIC_ACCESS_ENABLED&&!PUBLIC_POLICIES_APPROVED"));
assert(source.includes("!V7_QA_ENABLED&&publicCustomerAppReady()"));
assert(source.includes("V72_PILOT_MAX_USERS=3,V72_PILOT_MAX_MS=4*60*60*1000"));
assert(source.includes('db.collection("pilotControls").doc("v72")'));
assert(source.includes("control.sessionId!==lease.sessionId") &&
 source.includes("await requirePilotLease(req)"),"Lease recheck after transaction missing");
const exactDeployTargets={
 admissionOnly:admission,
 recordingCore:[...admission,...protectedCore],
 fullPilot:[...admission,...shared]
};
assert.equal(new Set(exactDeployTargets.fullPilot).size,exactDeployTargets.fullPilot.length);
assert(exactDeployTargets.recordingCore.every(x=>exactDeployTargets.fullPilot.includes(x)));
function assessRelease(input){
 const chosen=new Set(input?.targets||[]);
 const missing=protectedCore.filter(name=>!chosen.has(name));
 const notAllowed=[...chosen].filter(name=>!exactDeployTargets.fullPilot.includes(name));
 const sourceReady=admission.every(name=>chosen.has(name))&&missing.length===0&&notAllowed.length===0;
 return {sourceReady,missing,notAllowed};
}
assert.equal(assessRelease({targets:exactDeployTargets.admissionOnly}).sourceReady,false,
 "Admission only may never be called full Pilot recording ready");
assert.equal(assessRelease({targets:exactDeployTargets.recordingCore}).sourceReady,true);
assert.equal(assessRelease({targets:exactDeployTargets.fullPilot}).sourceReady,true);
assert.equal(assessRelease({targets:[...exactDeployTargets.recordingCore,"publicSignupStatus"]}).sourceReady,false);
assert.equal(assessRelease({targets:exactDeployTargets.recordingCore.filter(x=>x!=="finalizeCredit")}).sourceReady,false);
console.log("PASS: Beta codebase and all Pilot/guarded-callable dependencies mapped");
console.log("PASS: admission/recording targets, App Check, lease guards, Public flags and 3-user/4h limits");
console.log("PASS: negative tests reject admission-only, missing recording core or unapproved extra exports");
console.log(JSON.stringify({
 mode:"OFFLINE_SOURCE_DEPENDENCY_TEST",passed:true,
 admissionOnlyTargets:exactDeployTargets.admissionOnly,
 minimumRecordingTargets:exactDeployTargets.recordingCore,
 allSharedGuardedExports:shared,
 deployedRevisionIdentityVerified:false,
 customerClientPilotFlowVerified:false,
 realAppCheckVerified:false,
 runtimeIntegrationVerified:false,
 ownerDeployApproval:false,
 productionWrites:false,
 decision:"NO_GO_CONTROLLED_PILOT"
},null,2));
