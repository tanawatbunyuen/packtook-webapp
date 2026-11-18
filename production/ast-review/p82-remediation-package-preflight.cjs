"use strict";
/* P82 offline review only. Never performs a deployment, remote lookup,
 * privilege change, or Cloud API call. All evidence gaps block release.
 */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const EXPECTED=Object.freeze(["recordingStatus","usageStatus"]);
const CREDIT=Object.freeze(["reserveCredit","finalizeCredit","recoverStaleVideoReservation"]);
const FILES=Object.freeze([
 "production/staging-candidates/p81/legacy-status-live-gate-candidate.cjs",
 "production/staging-candidates/p75/legacy-status-guard-candidate.cjs",
 "production/staging-candidates/p69/functions/staging-authorization.cjs",
 "production/staging-candidates/p69/functions/p72-account-semantics.cjs"
]);
function fail(reason){return {schema:"P82_PREFLIGHT_RESULT_V1",
 state:"PACKAGE_INVALID",reason,
 stagedRemediation:"NOT_DEPLOYED",deployment:"BLOCKED",
 securityGate:"NOT_PROVEN",release:"NO_GO_RELEASE"};}
function validate(m,sourceFiles){
 if(!m||typeof m!=="object"||Array.isArray(m)||
  m.schema!=="P82_REMEDIATION_PACKAGE_V1"||
  m.project!=="packtook-staging"||m.region!=="asia-southeast1"||
  m.phase!=="OFFLINE_REVIEW_ONLY"||
  m.sourceBranch!=="review/p82-staging-remediation-package-preflight"||
  m.deployAllowed!==false||m.release!=="NO_GO_RELEASE"||
  m.postDeployAttestationRequired!==true)return fail("PROJECT_OR_DEPLOYMENT_BOUNDARY");
 if(!m.scope||JSON.stringify(m.scope.existingCallableNames)!==JSON.stringify(EXPECTED)||
  JSON.stringify(m.scope.creditCallableNamesUnaffected)!==JSON.stringify(CREDIT)||
  JSON.stringify(m.scope.allowedChanges)!==JSON.stringify(["authorization_guard_source_candidate"])||
  m.scope.cloudChangesPermitted!==false||m.scope.replacementRegistered!==false)
  return fail("SCOPE_EXCEEDED");
 if(!m.candidate||m.candidate.entrypoint!==FILES[0]||
  JSON.stringify(m.candidate.supportingModules)!==JSON.stringify(FILES.slice(1))||
  m.candidate.sourceHashes!=="CALCULATED_IN_CI_NOT_PUBLISHED_AS_RELEASE_ARTIFACT")
  return fail("SOURCE_PACKAGE_INVALID");
 const checks={
  runtimeEvidence:{
   p80GuardDrift:"CONFIRMED_BOTH",fiveFunctionMetadata:"STABLE_METADATA_ONLY",
   deployedAppCheck:"NOT_PROVEN",deployedIamLeastPrivilege:"NOT_VERIFIED",
   rollbackImmutableRevision:"NOT_RECORDED",deployIdentity:"NOT_APPROVED",
   frontendCompatibility:"NOT_PROVEN"
  },
  approvals:{
   ownerDeploymentApproval:"NOT_GRANTED",
   independentSecurityReview:"NOT_COMPLETE",
   operatorChangeTicket:"NOT_OPEN",
   monitoringAndIncidentCoverage:"NOT_VERIFIED"
  },
  prerequisites:{
   exactStagingCodebaseAndRuntimeMapping:"NOT_VERIFIED",
   immutableKnownGoodRollback:"NOT_VERIFIED",
   realAppCheckNegativeAndPositiveTestPlan:"NOT_COMPLETED",
   stagingOnlyDeployProcedure:"NOT_APPROVED"
  }
 };
 for(const [group,fields] of Object.entries(checks)){
  const actual=m[group];
  if(!actual||Object.keys(actual).sort().join("|")!==Object.keys(fields).sort().join("|")||
     Object.entries(fields).some(([k,v])=>actual[k]!==v))
   return fail("EVIDENCE_OR_APPROVAL_NOT_REVIEW_STATE");
 }
 if(JSON.stringify(m.actionsForbidden)!==JSON.stringify([
  "firebase deploy","gcloud functions deploy","gcloud run deploy","gcloud iam","gcloud secrets"]))
  return fail("FORBIDDEN_ACTION_BOUNDARY");
 if(!sourceFiles||Object.keys(sourceFiles).sort().join("|")!==FILES.slice().sort().join("|"))
  return fail("SOURCE_FILES_MISSING");
 for(const file of FILES){
  if(typeof sourceFiles[file]!=="string"||!sourceFiles[file]||
     Buffer.byteLength(sourceFiles[file])>500000)return fail("SOURCE_FILE_INVALID");
 }
 const entry=sourceFiles[FILES[0]],p75=sourceFiles[FILES[1]],authorization=sourceFiles[FILES[2]];
 if(!entry.includes("enforceAppCheck:true")||
    !entry.includes("gate.assertAuthorized(request)")||
    !entry.includes("gate.uid(request)")||
    !entry.includes("legacyReadOnlyCandidate({protect,db,usageResponse,HttpsError})")||
    !p75.includes("const recordingStatus=protect(")||
    !p75.includes("const usageStatus=protect(")||
    !authorization.includes("readLiveUser(req.auth.uid)")||
    !authorization.includes("validLease(control,now())")||
    !authorization.includes("req.app?.appId!==expectedAppId")||
    /exports\.(?:recordingStatus|usageStatus|reserveCredit|finalizeCredit|recoverStaleVideoReservation)\s*=/.test(entry))
  return fail("GUARD_STATIC_REQUIREMENTS_NOT_MET");
 const digest=crypto.createHash("sha256");
 for(const file of FILES){
  digest.update(file+"\0");digest.update(sourceFiles[file]);digest.update("\0");
 }
 return {schema:"P82_PREFLIGHT_RESULT_V1",
  state:"PACKAGE_REVIEW_CANDIDATE_VALIDATED",
  scopedExistingNames:EXPECTED,excludedCreditNames:CREDIT,
  sourceBundleDigestSha256:digest.digest("hex"),
  sourceBytesVerifiedLocally:true,
  immutableDeployedRollback:"NOT_VERIFIED",
  p80DeployedGuardDrift:"CONFIRMED_UNREMEDIATED",
  appCheckBackend:"NOT_PROVEN",iamLeastPrivilege:"NOT_VERIFIED",
  stagedRemediation:"NOT_DEPLOYED",deployment:"BLOCKED",
  securityGate:"NOT_PROVEN",release:"NO_GO_RELEASE"};
}
module.exports={FILES,validate};
if(require.main===module){
 try{
  const root=path.resolve(__dirname,"../..");
  const m=JSON.parse(fs.readFileSync(path.join(root,"production/staging-candidates/p82-remediation-package.json"),"utf8"));
  const data=Object.fromEntries(FILES.map(f=>[f,fs.readFileSync(path.join(root,f),"utf8")]));
  const result=validate(m,data);
  console.log(JSON.stringify(result));
  if(result.state!=="PACKAGE_REVIEW_CANDIDATE_VALIDATED")process.exitCode=2;
 }catch{
  console.log(JSON.stringify(fail("NOT_VERIFIABLE")));process.exitCode=2;
 }
}
