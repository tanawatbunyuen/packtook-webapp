"use strict";
const assert=require("node:assert/strict");
const {summarize,PACKAGE,EXPECTED_DIGEST,logWindow}=require("./verify");
const policy=()=>({cleanupPolicies:{"firebase-functions-cleanup":{
 action:"DELETE",condition:{olderThan:"604800s",tagState:"ANY"},id:"firebase-functions-cleanup"}}});
const q=()=>({project:"packtook-staging",service:"artifactregistry.googleapis.com",
 methodContains:"BatchDeleteVersions",start:logWindow.start,end:logWindow.end});
const sample=()=>({policy:policy(),versions:[],logs:[],logsQuery:q(),exitCode:0});
let count=0;const t=(name,fn)=>{fn();count++;console.log("P201_"+name+"=PASS")};
t("SEVEN_DAY_DELETE_POLICY_IDENTIFIED",()=>{
 const x=summarize(sample());assert.equal(x.policyConfiguredForDeleteAfterSevenDays,true);
});
t("MISSING_DRY_RUN_IS_UNKNOWN",()=>{
 const x=summarize(sample());assert.equal(x.cleanupPolicyDryRun,"UNKNOWN");
});
t("EXPLICIT_DRY_RUN_TRUE",()=>{
 const x=summarize({...sample(),policy:{...policy(),cleanupPolicyDryRun:true}});
 assert.equal(x.cleanupPolicyDryRun,true);
});
t("EXPLICIT_DRY_RUN_FALSE",()=>{
 const x=summarize({...sample(),policy:{...policy(),cleanupPolicyDryRun:false}});
 assert.equal(x.cleanupPolicyDryRun,false);
});
t("EMPTY_VERSION_IS_NOT_PROOF_OF_DELETE",()=>{
 const x=summarize(sample());assert.equal(x.visibleVersionCount,0);
 assert.equal(x.deletionProven,false);
 assert(x.unknown.includes("NO_VISIBLE_VERSIONS_DOES_NOT_PROVE_DELETION"));
});
t("EMPTY_AUDIT_LOG_IS_NOT_PROOF_OF_NO_DELETE",()=>{
 const x=summarize(sample());assert.equal(x.deletionLogCount,0);
 assert.equal(x.absenceOfDeletionProven,false);
 assert(x.unknown.includes("EMPTY_LOG_RESULT_DOES_NOT_PROVE_NO_DELETION"));
});
t("LOG_QUERY_EMPTY_WITH_EXIT_ZERO_STILL_UNKNOWN",()=>{
 const x=summarize(sample());assert.equal(x.issues.length,0);
 assert.equal(x.g02Decision,"NO_GO");
});
t("WRONG_PROJECT_LOG_QUERY_REJECTED",()=>{
 const x=summarize({...sample(),logsQuery:{...q(),project:"packtook-prod-01"}});
 assert(x.issues.includes("LOG_QUERY_SCOPE_NOT_VERIFIED"));
});
t("WRONG_TIME_WINDOW_LOG_QUERY_REJECTED",()=>{
 const x=summarize({...sample(),logsQuery:{...q(),start:"2026-01-01T00:00:00Z"}});
 assert(x.issues.includes("LOG_QUERY_SCOPE_NOT_VERIFIED"));
});
t("NONZERO_COMMAND_EXIT_REJECTED",()=>{
 const x=summarize({...sample(),exitCode:1});
 assert(x.issues.includes("LOG_QUERY_EXIT_NONZERO"));
});
t("INVALID_POLICY_REJECTED",()=>{
 const x=policy();x.cleanupPolicies["firebase-functions-cleanup"].condition.olderThan="1200s";
 assert(summarize({...sample(),policy:x}).issues.includes("CLEANUP_AGE_DRIFT"));
});
t("PACKAGE_WRONG_NOT_DELETE_PROOF",()=>{
 const x=summarize({...sample(),logs:[{protoPayload:{
 serviceName:"artifactregistry.googleapis.com",methodName:"BatchDeleteVersions",
 resourceName:"packages/another_function"}}]});
 assert.equal(x.deletionProven,false);
});
t("MATCHING_LOG_ONLY_EVIDENCE_NOT_RELEASE_APPROVAL",()=>{
 const x=summarize({...sample(),logs:[{protoPayload:{
 serviceName:"artifactregistry.googleapis.com",methodName:"BatchDeleteVersions",
 resourceName:"projects/packtook-staging/locations/asia-southeast1/repositories/gcf-artifacts/packages/"+PACKAGE}}]});
 assert.equal(x.matchingDeletionLogSeen,true);
 assert.equal(x.g02Decision,"NO_GO");
});
t("VERSION_DIGEST_MATCH_CLASSIFIED",()=>{
 const x=summarize({...sample(),versions:[{name:PACKAGE+"/versions/"+EXPECTED_DIGEST}]});
 assert.equal(x.targetDigestVisible,true);
});
t("OTHER_PACKAGE_VERSION_NOT_MISCLASSIFIED",()=>{
 const x=summarize({...sample(),versions:[{name:"other/versions/"+EXPECTED_DIGEST}]});
 assert.equal(x.targetDigestVisible,false);
});
t("MISSING_LOGS_NOT_REPRESENTED_AS_EMPTY",()=>{
 const input=sample();delete input.logs;
 assert.equal(summarize(input).deletionLogCount,null);
});
t("PII_NEVER_IN_RESULT",()=>{
 const x=sample();x.logs=[{secret:"PRIVATE_TOKEN",email:"somebody@example.test"}];
 const y=JSON.stringify(summarize(x));
 assert(!y.includes("PRIVATE_TOKEN")&&!y.includes("somebody@example.test"));
});
t("PRODUCTION_DECISION_ALWAYS_NO_GO",()=>{
 const x=summarize(sample());
 assert.equal(x.releaseDecision,"NO_GO_RELEASE");
 assert.equal(x.deployDecision,"NO_GO_DEPLOY");
 assert.equal(x.publicSignup,"KEEP_CLOSED");
});
t("OPERATOR_ATTESTED_FLAG_CANNOT_UNLOCK",()=>{
 const x=summarize({...sample(),operatorAttested:true});
 assert.equal(x.operatorIndependentlyAttested,false);
 assert.equal(x.g02Decision,"NO_GO");
});
t("WRONG_LOG_METHOD_NOT_DELETE_PROOF",()=>{
 const x=summarize({...sample(),logs:[{protoPayload:{
 serviceName:"artifactregistry.googleapis.com",methodName:"GetVersion",
 resourceName:PACKAGE}}]});
 assert.equal(x.deletionProven,false);
});
console.log("P201_OFFLINE_CLEANUP_EVIDENCE_FIXTURES="+count+"/"+count+"_PASS");
console.log("P201_CLOUD_CALLS=0 CLOUD_WRITES=0");
console.log("P201_G02=NO_GO");
