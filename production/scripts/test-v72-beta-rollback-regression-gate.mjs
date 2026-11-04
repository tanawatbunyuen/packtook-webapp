import assert from "node:assert/strict";
import {assess} from "./v72-beta-rollback-regression-gate.mjs";
const names=["usageStatus","reserveCredit","finalizeCredit","registerDevice","deviceStatus","recordingStatus","pendingVideoReservations","recoverStaleVideoReservation","removeDevice","authorizeDuplicate","accountRole","subscriptionOverview","publicSignupStatus","pilotInvitationStatus","completePilotFreeSignup"];
const make=name=>({name,state:"ACTIVE",runService:name.toLowerCase(),revision:"rev",
 revisionReadable:true,matchingService:true,imageCaptured:true,
 identity:name.startsWith("pilot")?"packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com":"267344264661-compute@developer.gserviceaccount.com",
 codebaseLabelVerified:true,trafficReadable:true,trafficTargetsCount:1,
 servingRevision:"rev",servingPercent:100,totalTrafficPercent:100,
 latestRevisionRouting:false,runtimeConfigComparable:true});
const a=names.map(make);
const b={functions:a,publicOff:true,branch:"feature/v7.2-controlled-public-pilot-readiness",clean:true,project:"packtook-prod-01",ownerApproved:true,betaSmokeEvidence:true,rollbackDrillEvidence:true};
assert.equal(assess(b).technicalBaselinePass,true);
const negatives=[
 {functions:a.slice(1)},{publicOff:false},{clean:false},{branch:"main"},{project:"other"},
 ...["state","revisionReadable","matchingService","imageCaptured","identity","trafficReadable","servingPercent","latestRevisionRouting","codebaseLabelVerified","runtimeConfigComparable"].map((field)=>({
  functions:a.map((f,i)=>i===0?{...f,[field]:({state:"FAILED",revisionReadable:false,matchingService:false,imageCaptured:false,identity:"wrong",trafficReadable:false,servingPercent:50,latestRevisionRouting:true,codebaseLabelVerified:false,runtimeConfigComparable:false})[field]}:f)
 })),
 {ownerApproved:false},{betaSmokeEvidence:false},{rollbackDrillEvidence:false}
];
for(const delta of negatives){
 const r=assess({...b,...delta});
 assert.equal(r.technicalBaselinePass,false);
 assert.equal(r.prodWrites,false);
 assert.equal(r.deployApproved,false);
}
console.log("PASS: 15 functions, protected scopes and single fixed-revision traffic baseline");
console.log("PASS: "+negatives.length+" fail-closed negative fixtures");
console.log("DECISION: NO_GO_CONTROLLED_PILOT");
