"use strict";
// P201: offline, operator-supplied metadata classification. NEVER equate no log with no delete.
const {REVISION,PROJECT}=require("../p198/verify");
const P="firebase-functions-cleanup";
const PACKAGE="packtook--staging__asia--southeast1__usage_status";
const EXPECTED_DIGEST="sha256:524bd687470632f6ad654bfe14d1d58bdfcd1f6bd897d672fcdcff4977de20fa";
const logWindow={start:"2026-11-07T00:00:00Z",end:"2026-11-24T23:59:59Z"};
const own=o=>!!o&&typeof o==="object"&&!Array.isArray(o);
function summarize({policy,versions,logs,logsQuery,exitCode,operatorAttested}={}){
 const issues=[],unknown=[];
 const bad=(ok,reason)=>{if(!ok)issues.push(reason)};
 const p=policy?.cleanupPolicies?.[P];
 bad(own(policy),"POLICY_RESPONSE_MISSING");
 if(own(policy)){
  bad(own(p),"EXPECTED_POLICY_MISSING");
  if(own(p)){
   bad(p.action==="DELETE","CLEANUP_ACTION_DRIFT");
   bad(p.condition?.olderThan==="604800s","CLEANUP_AGE_DRIFT");
   bad(p.condition?.tagState==="ANY","CLEANUP_TAG_SCOPE_DRIFT");
  }
 }
 if(versions!==undefined){
  bad(Array.isArray(versions),"VERSION_RESPONSE_MUST_BE_ARRAY");
 }else unknown.push("VERSION_LIST_NOT_PROVIDED");
 if(logs!==undefined){
  bad(Array.isArray(logs),"LOG_RESPONSE_MUST_BE_ARRAY");
 }else unknown.push("LOG_RESULT_NOT_PROVIDED");
 if(logsQuery!==undefined){
  bad(own(logsQuery)&&logsQuery.project===PROJECT&&logsQuery.service==="artifactregistry.googleapis.com"&&
   logsQuery.methodContains==="BatchDeleteVersions"&&
   logsQuery.start===logWindow.start&&logsQuery.end===logWindow.end,
   "LOG_QUERY_SCOPE_NOT_VERIFIED");
 }else unknown.push("LOG_QUERY_SCOPE_SELF_REPORTED");
 if(exitCode!==undefined)bad(exitCode===0,"LOG_QUERY_EXIT_NONZERO");
 else unknown.push("LOG_QUERY_EXIT_UNCONFIRMED");
 const v=Array.isArray(versions)?versions:null,l=Array.isArray(logs)?logs:null;
 const observedAnyVersion=v?.length>0;
 const target=v?.some(x=>
  typeof x?.name==="string"&&x.name.includes(PACKAGE)&&
  (x.name.includes(EXPECTED_DIGEST)||x.version===EXPECTED_DIGEST))||false;
 const matchingDeletion=l?.some(x=>
  x?.protoPayload?.serviceName==="artifactregistry.googleapis.com"&&
  typeof x.protoPayload.methodName==="string"&&
  x.protoPayload.methodName.includes("BatchDeleteVersions")&&
  typeof x.protoPayload.resourceName==="string"&&
  x.protoPayload.resourceName.includes(PACKAGE))||false;
 if(v&&v.length===0)unknown.push("NO_VISIBLE_VERSIONS_DOES_NOT_PROVE_DELETION");
 if(l&&l.length===0)unknown.push("EMPTY_LOG_RESULT_DOES_NOT_PROVE_NO_DELETION");
 if(!operatorAttested)unknown.push("USER_SUPPLIED_OBSERVATION_NOT_INDEPENDENTLY_ATTESTED");
 unknown.push("IMAGE_BUILD_OUTPUT_SHA256_NOT_INDEPENDENTLY_VERIFIED",
 "P188_DEPLOYED_SOURCE_NOT_VERIFIED","STAGING_APPCHECK_NOT_VERIFIED");
 return {
  schema:"packtook-p201-artifact-cleanup-evidence-v1",
  project:PROJECT,package:PACKAGE,referenceRevision:REVISION,
  policyConfiguredForDeleteAfterSevenDays:own(p)&&p.action==="DELETE"&&p.condition?.olderThan==="604800s"&&p.condition?.tagState==="ANY",
  cleanupPolicyDryRunFieldPresent:own(policy)&&Object.hasOwn(policy,"cleanupPolicyDryRun"),
  // Absent is UNKNOWN here; do not infer false from omitted provider field.
  cleanupPolicyDryRun:own(policy)&&typeof policy.cleanupPolicyDryRun==="boolean"?
   policy.cleanupPolicyDryRun:"UNKNOWN",
  visibleVersionCount:v?.length??null,
  targetDigestVisible:target,
  deletionLogCount:l?.length??null,
  matchingDeletionLogSeen:matchingDeletion,
  deletionProven:matchingDeletion&&issues.length===0,
  absenceOfDeletionProven:false,
  operatorIndependentlyAttested:false,
  issues,unknown,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED"
 };
}
module.exports={summarize,PACKAGE,EXPECTED_DIGEST,logWindow};
