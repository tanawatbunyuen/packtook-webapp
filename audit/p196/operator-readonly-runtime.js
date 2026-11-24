"use strict";
// P196 — explicit, operator-only, staging-only GCloud Functions describe.
// The tool NEVER makes a network call itself and never reads production. It uses
// a fixed CLI argv under an independently approved Cloud Operator's credentials.
const {execFileSync}=require("node:child_process");
const crypto=require("node:crypto");
const {EXPECTED_CANDIDATE,TARGET,ENDPOINT}=require("../p195/reconcile");
const PROJECT="packtook-staging",REGION="asia-southeast1",FUNCTION="usageStatus";
const ACK="I_AUTHORIZE_P196_STAGING_METADATA_READ_ONLY";
const TICKET=/^G02-[A-Z0-9-]{8,60}$/;
function authorize({env={},project,ack,ticket}={}){
 if(project!==PROJECT)throw Error("P196_STAGING_ONLY");
 if(ack!==ACK)throw Error("P196_READ_ONLY_ACK_MISSING");
 if(env.CI==="true"||env.GITHUB_ACTIONS==="true")throw Error("P196_CI_REAL_CLOUD_BLOCKED");
 if(env.FIRESTORE_EMULATOR_HOST||env.FIREBASE_AUTH_EMULATOR_HOST||env.FUNCTIONS_EMULATOR)
  throw Error("P196_MIXED_EMULATOR_BLOCKED");
 if(env.PACKTOOK_G02_OPERATOR_APPROVED_PROJECT!==PROJECT||!TICKET.test(ticket||""))
  throw Error("P196_INDEPENDENT_OPERATOR_APPROVAL_RECORD_MISSING");
 if(env.GCLOUD_PROJECT&&env.GCLOUD_PROJECT!==PROJECT||
   env.GOOGLE_CLOUD_PROJECT&&env.GOOGLE_CLOUD_PROJECT!==PROJECT)
  throw Error("P196_WRONG_CLOUD_CONTEXT");
 return {project:PROJECT,region:REGION,functionName:FUNCTION};
}
function safeExtract(record){
 if(!record||typeof record!=="object"||Array.isArray(record))throw Error("P196_INVALID_PROVIDER_RECORD");
 // GCloud Functions v2 gets serviceConfig.uri; Gen1 has httpsTrigger.url.
 const resource=record.name;
 if(resource!==TARGET)throw Error("P196_PROVIDER_PROJECT_OR_FUNCTION_MISMATCH");
 const url=record.serviceConfig?.uri||record.url||record.httpsTrigger?.url||null;
 const revision=record.serviceConfig?.revision||record.serviceConfig?.revisionId||null;
 const runtime=record.buildConfig?.runtime||record.runtime||null;
 const state=record.state||record.status||null;
 const out={
  schema:"packtook-p196-staging-function-readonly-v1",
  project:PROJECT,functionResource:TARGET,region:REGION,
  endpointMatchesPinned:url===ENDPOINT,
  revisionPresent:typeof revision==="string"&&/^[a-z][a-z0-9-]{5,120}$/.test(revision),
  runtime:typeof runtime==="string"&&/^nodejs(?:20|22|24)$/.test(runtime)?runtime:"UNVERIFIED",
  active:state==="ACTIVE",
  sourceHashMatchesCandidate:"NOT_ATTESTED_BY_DESCRIBE",
  candidateSha256Reference:EXPECTED_CANDIDATE,
  deployedCandidateAttested:false,
  appCheckPositiveAttested:false,
  operatorIdentityIndependentlyVerified:false,
  result:"PENDING_INDEPENDENT_SECURITY_REVIEW",
  g02Decision:"NO_GO",
  releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY"
 };
 return out;
}
function observe({env=process.env,project,ack,ticket,exec=execFileSync}={}){
 authorize({env,project,ack,ticket});
 const argv=["functions","describe",FUNCTION,"--gen2","--project",PROJECT,
  "--region",REGION,"--format=json","--quiet"];
 const output=exec("gcloud",argv,{encoding:"utf8",timeout:12000,maxBuffer:256*1024,
  env:{...env,CLOUDSDK_CORE_PROJECT:PROJECT}});
 if(typeof output!=="string"||Buffer.byteLength(output)>256*1024)
  throw Error("P196_UNEXPECTED_RESPONSE_SIZE");
 let raw;try{raw=JSON.parse(output)}catch{throw Error("P196_UNPARSABLE_PROVIDER_RESPONSE")}
 return safeExtract(raw);
}
module.exports={authorize,safeExtract,observe,PROJECT,TARGET,ENDPOINT,ACK};
