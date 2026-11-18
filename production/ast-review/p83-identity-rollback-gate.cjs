"use strict";
/* P83 deployment identity + rollback evidence gate.
 * Local review-only evidence; never authorizes a Cloud deployment.
 */
const fs=require("node:fs");
const REQUIRED=["statusFunctionsMappedToCodebase","creditFunctionsMappedToCodebase",
 "runtimeServiceIdentityReviewed","iamLeastPrivilegeIndependentlyApproved",
 "pinnedSourceGenerationCaptured","rollbackSourceAccessible",
 "rollbackRestoreDrillPassed","noUnrelatedFunctionsInDeployScope",
 "backendAppCheckEnforcementProven","sourceSemanticCompatibilityReviewed",
 "monitoringAndRollbackTriggersApproved","ownerScopedStagingDeployApproval"];
const VALUES=["VERIFIED","NOT_VERIFIED","DRIFT","BLOCKED"];
function template(){
 return {schema:"P83_DEPLOYMENT_EVIDENCE_V1",project:"packtook-staging",
  checks:Object.fromEntries(REQUIRED.map(k=>[k,"NOT_VERIFIED"]))};
}
function classify(e,m){
 const invalid=()=>({schema:"P83_RESULT_V1",state:"INVALID_OR_UNTRUSTED_EVIDENCE",
  stagedDeploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!e||e.schema!=="P83_DEPLOYMENT_EVIDENCE_V1"||
    e.project!=="packtook-staging"||!e.checks||
    Object.keys(e.checks).sort().join("|")!==REQUIRED.slice().sort().join("|")||
    REQUIRED.some(k=>!VALUES.includes(e.checks[k]))||
    !m||m.schema!=="P82_REMEDIATION_PACKAGE_V1"||
    m.project!=="packtook-staging"||m.deployAllowed!==false||
    m.release!=="NO_GO_RELEASE"||
    JSON.stringify(m.scope?.existingCallableNames)!==
      JSON.stringify(["recordingStatus","usageStatus"])||
    m.scope?.cloudChangesPermitted!==false)
  return invalid();
 const unresolved=REQUIRED.filter(k=>e.checks[k]!=="VERIFIED");
 return {
  schema:"P83_RESULT_V1",
  state:unresolved.length?"ROLLBACK_AND_IDENTITY_REVIEW_REQUIRED":"EVIDENCE_REPORTED_UNATTESTED",
  verifiedCount:REQUIRED.length-unresolved.length,
  requiredCount:REQUIRED.length,unresolved,
  sourceMetadata:"P79_STABLE_P80_DRIFT_CONFIRMED",
  codebaseMapping:"NOT_INDEPENDENTLY_VERIFIED",
  runtimeIAM:"NOT_INDEPENDENTLY_VERIFIED",
  rollbackRestore:"NOT_PROVEN",
  backendAppCheck:"NOT_PROVEN",
  stagedDeploy:"BLOCKED",release:"NO_GO_RELEASE"
 };
}
module.exports={REQUIRED,template,classify};
if(require.main===module){
 try{
  const [ev,manifest]=process.argv.slice(2);
  const e=JSON.parse(fs.readFileSync(ev,"utf8"));
  const m=JSON.parse(fs.readFileSync(manifest,"utf8"));
  console.log(JSON.stringify(classify(e,m)));
 }catch{
  console.log('{"schema":"P83_RESULT_V1","state":"NOT_VERIFIABLE","stagedDeploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
