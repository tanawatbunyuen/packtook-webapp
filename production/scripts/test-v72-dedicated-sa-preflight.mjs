// PACKTOOK V7.2 — Dedicated Public/Pilot SA no-write source+metadata fixtures.
import assert from "node:assert/strict";
import fs from "node:fs";
import {readServiceAccountMetadata,assessDedicatedSaPreflight,
 ACCOUNT,PROJECT} from "./v72-dedicated-sa-preflight.mjs";
import {verifySourceBinding} from "./v72-secret-iam-audit.mjs";

const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
assert.equal(verifySourceBinding(source).pass,true);
assert.equal(verifySourceBinding(source).checks.betaSharedOptionsUnchanged,true);
const backendOptions=source.match(/const options=\{[^}]+\}/g)||[];
assert.equal(backendOptions.length,1);
assert(!backendOptions[0].includes("serviceAccount"));
const planned="packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com";
assert.equal(ACCOUNT,planned);
assert.equal((source.match(/serviceAccount:PUBLIC_PILOT_RUNTIME_SA/g)||[]).length,4);
for(const name of ["publicSignupStatus","completeFreeSignup",
 "pilotInvitationStatus","completePilotFreeSignup"]){
 const begin=source.indexOf("exports."+name+"=onCall(");
 const end=source.indexOf("},async",begin);
 assert(begin>0&&end>begin);
 assert(source.slice(begin,end).includes("serviceAccount:PUBLIC_PILOT_RUNTIME_SA"),
  "Missing per-function SA: "+name);
}
for(const beta of ["usageStatus","reserveCredit","finalizeCredit","recordingStatus",
 "registerDevice","accountRole","subscriptionOverview"]){
 assert(source.includes("exports."+beta+"=guardedCall(options,async"),
  "Unexpected changed Beta runtime options: "+beta);
}
console.log("PASS: exactly four Public/Pilot callables pinned; all existing Beta use untouched shared options");

const audit={
 source:{pass:true},
 secret:{resourcePresent:true,versionsInspected:true,enabledVersionCount:1},
 cloudFunctions:[
  {name:"publicSignupStatus",deployed:true},
  {name:"completeFreeSignup",deployed:null},
  {name:"pilotInvitationStatus",deployed:null},
  {name:"completePilotFreeSignup",deployed:null}
 ]
};
const closed={diagnostic:{closed:true,explicitEnabledSeen:false,reasons:[],
 marketingHttp:200,customerHttp:200,statusHttp:200,
 statusReachable:true,publicSignupEnabled:false,publicAccessEnabled:false,
 attempts:1,initialStatusHttp:200,initialReasons:[]}};
const absent={ok:false,error:"NOT_FOUND",data:null};
const run=(sa=absent,r=closed,a=audit,s=source)=>assessDedicatedSaPreflight({
 source:s,audit:a,publicEvidence:r,serviceAccount:sa});
const expected=run();
assert.equal(expected.phase,"DEDICATED_SA_CREATION_APPROVAL_REQUIRED");
assert.equal(expected.account.resourcePresent,false);
assert.equal(expected.candidateForSeparateSAOnlyApproval,true);
assert.equal(expected.accountCreationAuthorized,false);
assert.equal(expected.accountCreationPerformed,false);
assert.equal(expected.secretIamGrantAuthorized,false);
assert.equal(expected.firestoreIamGrantAuthorized,false);
assert.equal(expected.firebaseAuthIamGrantAuthorized,false);
assert.equal(expected.functionsDeployAuthorized,false);
assert.equal(expected.readyForPilot,false);
assert.equal(expected.decision,"NO_GO_CONTROLLED_PILOT");
const actualMeta={ok:true,data:{email:ACCOUNT,name:
 "projects/"+PROJECT+"/serviceAccounts/"+ACCOUNT},error:null};
const exists=run(actualMeta);
assert.equal(exists.phase,"DEDICATED_SA_EXISTS_PERMISSIONS_AND_DEPLOY_REVIEW_REQUIRED");
assert.equal(exists.account.resourcePresent,true);
assert.equal(exists.account.active,true);
assert.equal(exists.candidateForSeparateSAOnlyApproval,false);
const disabled=run({ok:true,data:{...actualMeta.data,disabled:true},error:null});
assert.equal(disabled.phase,"DEDICATED_SA_REVIEW_BLOCKED");
const wrongAccount=run({ok:true,data:{email:"unapproved@fake.invalid"},error:null});
assert.equal(wrongAccount.phase,"DEDICATED_SA_REVIEW_BLOCKED");
for(const q of ["PERMISSION_DENIED","TIMEOUT","CLI_NOT_FOUND","UNVERIFIED"]){
 const r=run({ok:false,error:q});
 assert.equal(r.phase,"DEDICATED_SA_REVIEW_BLOCKED");
 assert(r.errors.includes("PROPOSED_SERVICE_ACCOUNT_EXISTENCE_UNKNOWN"));
}
console.log("PASS: absent SA requests separate approval; exists/disabled/403/wrong account all handled conservatively");

for(const mutation of [
 {a:{...audit,secret:{resourcePresent:false,versionsInspected:false,enabledVersionCount:0}}},
 {a:{...audit,cloudFunctions:audit.cloudFunctions.map(x=>x.name==="pilotInvitationStatus"?{...x,deployed:true}:x)}},
 {r:{diagnostic:{closed:false,explicitEnabledSeen:false,reasons:["STATUS_UNKNOWN"]}}},
 {r:{diagnostic:{closed:true,explicitEnabledSeen:true,reasons:[]}}},
 {s:source.replace('serviceAccount:PUBLIC_PILOT_RUNTIME_SA','serviceAccount:UNSAFE_DEFAULT')}
]){
 const r=run(absent,mutation.r||closed,mutation.a||audit,mutation.s||source);
 assert.equal(r.candidateForSeparateSAOnlyApproval,false,"Must fail closed");
 assert.equal(r.accountCreationPerformed,false);
}
console.log("PASS: missing Secret/version, live Pilot, Public ON and missing binding block SA creation candidate");
const doubleNetworkFailure={diagnostic:{...closed.diagnostic,
 closed:false,attempts:2,
 marketingHttp:null,customerHttp:null,statusHttp:null,
 statusReachable:false,publicSignupEnabled:null,publicAccessEnabled:null,
 initialStatusHttp:null,
 initialReasons:["MARKETING_HOSTING_HTTP_NOT_200",
  "CUSTOMER_HOSTING_HTTP_NOT_200","PUBLIC_STATUS_CALLABLE_UNVERIFIED",
  "PUBLIC_SIGNUP_FLAG_UNKNOWN","PUBLIC_ACCESS_FLAG_UNKNOWN"],
 reasons:["MARKETING_HOSTING_HTTP_NOT_200",
  "CUSTOMER_HOSTING_HTTP_NOT_200","PUBLIC_STATUS_CALLABLE_UNVERIFIED",
  "PUBLIC_SIGNUP_FLAG_UNKNOWN","PUBLIC_ACCESS_FLAG_UNKNOWN"],
 marketingError:"TimeoutError",customerError:"TimeoutError",
 statusError:"TimeoutError"}};
const unsafeHttp=run(absent,doubleNetworkFailure);
assert.equal(unsafeHttp.phase,"DEDICATED_SA_REVIEW_BLOCKED");
assert.equal(unsafeHttp.candidateForSeparateSAOnlyApproval,false);
assert.equal(unsafeHttp.publicProbe.attempts,2);
assert.equal(unsafeHttp.publicProbe.statusHttp,null);
assert.equal(unsafeHttp.publicProbe.marketingHttp,null);
assert.equal(unsafeHttp.publicProbe.marketingError,"TimeoutError");
assert(unsafeHttp.errors.includes("PUBLIC_STATUS_CALLABLE_UNVERIFIED"));
assert(unsafeHttp.errors.includes("PUBLIC_FLAGS_OR_HOSTING_NOT_VERIFIED_OFF"));
const transientRecovery=run(absent,{diagnostic:{...closed.diagnostic,
 attempts:2,initialStatusHttp:null,
 initialReasons:["PUBLIC_STATUS_CALLABLE_UNVERIFIED"]}});
assert.equal(transientRecovery.phase,"DEDICATED_SA_CREATION_APPROVAL_REQUIRED");
assert.equal(transientRecovery.publicProbe.attempts,2);
assert.equal(transientRecovery.publicProbe.initialStatusHttp,null);
const explicitPreviouslyOn=run(absent,{diagnostic:{...closed.diagnostic,
 initialSignupEnabled:true,explicitEnabledSeen:false}});
assert.equal(explicitPreviouslyOn.candidateForSeparateSAOnlyApproval,false,
 "A previous explicit Public ON must never be hidden by an apparently closed final probe");
assert.equal(explicitPreviouslyOn.publicProbe.explicitEnabledSeen,true);
const explicitCurrentlyOn=run(absent,{diagnostic:{...closed.diagnostic,
 publicAccessEnabled:true,explicitEnabledSeen:false}});
assert.equal(explicitCurrentlyOn.candidateForSeparateSAOnlyApproval,false);
assert.equal(explicitCurrentlyOn.publicProbe.explicitEnabledSeen,true);
const textReport=JSON.stringify(unsafeHttp);
assert(!/iam\\.gserviceaccount\\.com|serviceAccount:/.test(textReport));
console.log("PASS: network timeout diagnostics show individual services; two unknown probes remain BLOCKED");
console.log("PASS: one transient read-only retry may recover; any observed ON flag blocks despite contradictory closed status");

const commands=[];
const fn=(_cmd,args)=>{commands.push(args);return JSON.stringify(actualMeta.data)};
const read=readServiceAccountMetadata("gcloud",["iam","service-accounts","describe",
 ACCOUNT,"--project="+PROJECT,"--format=json"],fn);
assert.equal(read.ok,true);
assert.equal(commands.length,1);
assert.throws(()=>readServiceAccountMetadata("gcloud",["iam","service-accounts","create",
 "danger"],fn),/SAFETY BLOCK/);
const err=msg=>{const error=new Error(msg);error.stderr=msg;throw error};
assert.equal(readServiceAccountMetadata("gcloud",
 ["iam","service-accounts","describe",ACCOUNT,"--project="+PROJECT,"--format=json"],
 ()=>err("PERMISSION_DENIED: never disclose identity")).error,"PERMISSION_DENIED");
assert.equal(readServiceAccountMetadata("gcloud",
 ["iam","service-accounts","describe",ACCOUNT,"--project="+PROJECT,"--format=json"],
 ()=>err("NOT_FOUND")).error,"NOT_FOUND");
const textSource=fs.readFileSync(new URL("./v72-dedicated-sa-preflight.mjs",import.meta.url),"utf8");
for(const forbidden of ["gcloud iam service-accounts create",
 "gcloud projects add-iam-policy-binding","add-iam-policy-binding","firebase deploy",
 "writeFileSync(","gcloud functions deploy","secrets versions access"]){
 assert(!textSource.includes(forbidden),"No Cloud mutation permitted: "+forbidden);
}
assert(!JSON.stringify(expected).includes("@"),"Never show SA email in sanitized output");
console.log("PASS: allowlisted service account metadata-only command; zero SA/IAM/Functions writes or identity leaks");
console.log("RESULT: PACKTOOK V7.2 DEDICATED SA OFFLINE SAFETY PASS (not Production permission)");
