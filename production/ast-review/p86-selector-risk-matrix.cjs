"use strict";
/* P86 offline selector-risk review, NOT a CLI deployment command builder.
 * No subprocesses, network, Cloud calls, IAM changes or deploy operations.
 * Source ownership is repo-only, not evidence of live Staging ownership.
 */
const fs=require("node:fs"),path=require("node:path");
const {audit,EXPECTED}=require("./p85-repository-codebase-ownership.cjs");
const TARGETS=Object.freeze(["recordingStatus","usageStatus"]);
const CREDIT=Object.freeze(["reserveCredit","finalizeCredit","recoverStaleVideoReservation"]);
const STRATEGIES=Object.freeze([
 {id:"REPLACE_BETA_SOURCE_DIRECTORY",
  scope:"FULL_CODEBASE",
  risk:"BLOCKED_UNRELATED_EXPORTS",
  reason:"The reviewed beta source contains status and credit callables; swapping whole source is not a narrow remediation."},
 {id:"TARGET_TWO_EXISTING_FUNCTIONS",
  scope:"FUNCTION_SCOPED",
  risk:"REVIEW_REQUIRED_SELECTOR_NOT_PROVEN",
  reason:"Function-scoped selection needs independently verified deployed ownership, Firebase CLI behavior and rollback."},
 {id:"REGISTER_NEW_ALIAS_CODEBASE",
  scope:"NEW_CODEBASE",
  risk:"BLOCKED_CONTRACT_AND_LIFECYCLE",
  reason:"New names or codebases change the existing client contract and cannot remediate original callable guard drift automatically."}
]);
function blocked(reason){return {schema:"P86_SELECTOR_REVIEW_V1",state:"INVALID_REVIEW_INPUT",
 reason,stagingDeploy:"BLOCKED",release:"NO_GO_RELEASE"};}
function inspect({config,sources,package82,observation84}){
 const owners=audit(config,sources);
 if(owners.state!=="CHECKED_OUT_REPOSITORY_OWNERSHIP_VERIFIED_ONLY")
   return blocked("REPOSITORY_OWNERSHIP_INVALID");
 if(!package82||package82.schema!=="P82_REMEDIATION_PACKAGE_V1"||
    package82.deployAllowed!==false||package82.project!=="packtook-staging"||
    package82.scope?.cloudChangesPermitted!==false||
    JSON.stringify(package82.scope?.existingCallableNames)!==JSON.stringify(TARGETS)||
    JSON.stringify(package82.scope?.creditCallableNamesUnaffected)!==JSON.stringify(CREDIT))
   return blocked("P82_SCOPE_OR_RELEASE_INVALID");
 if(!observation84||observation84.schema!=="P84_OWNER_P83_OBSERVATION_V1"||
    observation84.project!=="packtook-staging"||
    observation84.p83MetadataStable!==true||
    observation84.p83AllSourceGenerationsPresent!==true||
    observation84.p83RuntimeIdentitiesShared!==true||
    observation84.p83CodebaseLabelsPresent!==false||
    observation84.codebaseOwnership!=="NOT_VERIFIED"||
    observation84.rollbackRestorable!=="NOT_VERIFIED"||
    observation84.backendAppCheck!=="NOT_PROVEN"||
    observation84.deployPerformed!==false)
   return blocked("OPERATOR_EVIDENCE_UNTRUSTED");
 return {
  schema:"P86_SELECTOR_REVIEW_V1",
  state:"OFFLINE_SELECTOR_RISK_MATRIX_PREPARED",
  project:"packtook-staging",
  existingStatusTargets:TARGETS,
  excludedCreditFunctions:CREDIT,
  repositoryCodebase:"beta",
  repositoryStatusAndCreditShareCodebase:true,
  p84SourceGenerationNotSharedAcrossGroups:true,
  sourcePinNotEquivalentToCodebaseOwnership:true,
  strategies:STRATEGIES,
  candidateSelector:"NOT_SELECTED",
  safeSelectorVerified:false,
  liveCodebaseOwnership:"NOT_VERIFIED",
  immutableRestoreSource:"NOT_VERIFIED",
  restorationDryRun:"NOT_PERFORMED",
  backendAppCheck:"NOT_PROVEN",
  leastPrivilegeIam:"NOT_VERIFIED",
  originalStagingGuardDrift:"UNREMEDIATED",
  stagingDeploy:"BLOCKED",release:"NO_GO_RELEASE"
 };
}
module.exports={inspect,STRATEGIES};
if(require.main===module){
 try{
  const root=path.resolve(__dirname,"..");
  const config=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
  const sources=Object.fromEntries(EXPECTED.map(x=>[x.source,
   fs.readFileSync(path.join(root,x.source,"index.js"),"utf8")]));
  const package82=JSON.parse(fs.readFileSync(path.join(root,"staging-candidates/p82-remediation-package.json"),"utf8"));
  const observation84=JSON.parse(fs.readFileSync(path.join(root,"staging-candidates/p84-p83-operator-observation.json"),"utf8"));
  const result=inspect({config,sources,package82,observation84});
  console.log(JSON.stringify(result));
  if(result.state!=="OFFLINE_SELECTOR_RISK_MATRIX_PREPARED")process.exitCode=2;
 }catch{
  console.log(JSON.stringify(blocked("NOT_VERIFIABLE")));
  process.exitCode=2;
 }
}
