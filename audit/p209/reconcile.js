"use strict";
/** P209 G02 gate reconciliation: OFFLINE code/evidence sanity, not runtime signoff. */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {record}=require("../p172-release-gates");
const {REQUIREMENTS,EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {reconcile:appCheck}=require("../p208/verify");
const {reconcile:source}=require("../p207/verify");
const {dashboard}=require("../p205/dashboard");
const {REVISION,BUILD}=require("../p198/verify");
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const runtimeGate="G02_BACKEND_AUTH";
const allowed=new Set(["sourceCandidate","runtimeClaim","appCheckObservations","externalEvidenceClaims"]);
const obj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
function sourceReview(text){
 const reasons=[];
 if(typeof text!=="string")return {status:"NOT_PROVIDED",reasons:["CANDIDATE_BYTES_NOT_PROVIDED"]};
 if(sha(text)!==EXPECTED_CANDIDATE)reasons.push("CANDIDATE_SHA256_DRIFT");
 const expected=[
  'async function assertAdmin(uidValue){const ref=own(uidValue),snap=await ref.get();if(!snap.exists||snap.data().ownerUid!==uidValue)',
  'const acc=own(accountId),lock=acc.collection("barcodeLocks")',
  'if(!aSnap.exists||aSnap.data().ownerUid!==accountId)',
  'if(!snap.exists||snap.data().ownerUid!==id)',
  'ref.create({ownerUid:id,plan:"Free"'
 ];
 for(let i=0;i<expected.length;i++)if(!text.includes(expected[i]))reasons.push("OWNER_GUARD_"+(i+1)+"_ABSENT");
 if(text.includes('if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});'))reasons.push("LEGACY_OWNER_AUTOBACKFILL");
 if(text.includes('const role=ref.id===id?"admin":"operator";'))reasons.push("IMPLICIT_ADMIN_ROLE");
 for(const fn of ["ownerGrantVideoCredits","ownerUpdateCustomerExpiry",
 "ownerGetCustomerManageState","ownerGetCustomerAdjustmentHistory"]){
  if(text.includes("exports."+fn+"="))reasons.push("UNREVIEWED_OWNER_IMPORT");
 }
 return {status:reasons.length?"REJECTED":"STATIC_CANDIDATE_MATCH",
  reasons,sha256Matches:sha(text)===EXPECTED_CANDIDATE,
  deployedRuntimeAttested:false,realAuthorizationTested:false};
}
function report({sourceCandidate,appCheckObservations=[],runtimeClaim,externalEvidenceClaims}={}){
 const c=sourceReview(sourceCandidate);
 const ac=appCheck({observations:appCheckObservations});
 const legacy=dashboard();
 const gates=record.gates.map(g=>{
  const id=g.id,relatedExternal={
   G01_ROOT_RULES:[],G02_BACKEND_AUTH:["STAGING_LEGACY_INVENTORY","EXACT_RELEASE_DIFF_SECURITY_SIGNOFF"],
   G03_CALLABLE_INVALID_TOKEN_PROTOCOL:["STAGING_VALID_APPCHECK"],
   G04_PRODUCTION_TOKEN_SIGNATURE:["STAGING_VALID_APPCHECK"],
   G05_RECOVERED_OWNER_PROVENANCE:["OWNER_PROVENANCE_REMEDIATION"],
   G06_APP_CHECK_IAM_SECRETS:["STAGING_VALID_APPCHECK","PROD_LEGACY_INVENTORY"],
   G07_BILLING_MONITORING_LEGAL:[],G08_OWNER_RELEASE_APPROVAL:[]
  }[id]||[];
  const unresolved=[
   ...(id===runtimeGate&&c.status!=="STATIC_CANDIDATE_MATCH"?["PINNED_P188_STATIC_CANDIDATE_NOT_VALIDATED"]:[]),
   ...(id===runtimeGate?["BACKEND_AUTH_HANDLER_EMULATOR_AND_INDEPENDENT_REVIEW_UNATTESTED","P188_NOT_PROVEN_DEPLOYED"]:[]),
   ...(id==="G03_CALLABLE_INVALID_TOKEN_PROTOCOL"?["P168_CALLABLE_403_VS_401_NOT_RESOLVED_IN_TESTED_RUNTIME"]:[]),
   ...(id==="G04_PRODUCTION_TOKEN_SIGNATURE"?["SIGNED_TOKEN_INDEPENDENT_RUNTIME_TEST_MISSING"]:[]),
   ...(id==="G06_APP_CHECK_IAM_SECRETS"?["REAL_PRODUCTION_APPCHECK_IAM_SECRETS_ATTESTATION_MISSING"]:[]),
   ...(id==="G07_BILLING_MONITORING_LEGAL"?["BILLING_MONITORING_PDPA_OWNER_EVIDENCE_MISSING"]:[]),
   ...(id==="G08_OWNER_RELEASE_APPROVAL"?["EXPLICIT_OWNER_RELEASE_AND_DEPLOY_SIGNOFF_MISSING"]:[]),
   ...relatedExternal.map(x=>"EXTERNAL_"+x+"_UNVERIFIED")
  ];
  return {id,status:"NO_GO",priorStatus:g.status,reason:g.reason,
   externalDependencies:relatedExternal,unresolved};
 });
 return {schema:"packtook-p209-g02-true-gate-reconciliation-v1",
  mode:"OFFLINE_ONLY",g02GateId:runtimeGate,sourceCandidate:c,
  appCheckClaimedCases:ac.claimedCases,appCheckRealVerified:false,
  independentlyVerifiedExternalTracks:0,externalRequirementCount:Object.keys(REQUIREMENTS).length,
  externalTracksAreNotReleaseGates:true,gates,
  g02Progress:"STATIC_REVIEW_ONLY",g02IndependentlyVerified:false,
  revision:REVISION,build:BUILD,
  originalReleaseGateCount:gates.length,goReleaseGates:0,
  independentOwnerSignoff:false,
  operatorClaimsCannotAuthorizeRuntime:true,productionReadAuthorized:false,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",deployDecision:"NO_GO_DEPLOY",
  publicSignup:"KEEP_CLOSED",cloudReads:0,cloudWrites:0,
  note:"G02_BACKEND_AUTH is ONE of eight release gates. P190 tracks are five independent evidence requirements, not release gates. P188 offline source match is not runtime deployment proof."};
}
function local(){
 const p=path.join(__dirname,"../p188/candidate-index.js");
 return report({sourceCandidate:fs.existsSync(p)?fs.readFileSync(p,"utf8"):undefined});
}
module.exports={report,sourceReview,local};
