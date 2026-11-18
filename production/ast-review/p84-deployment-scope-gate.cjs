"use strict";
/* P84 strictly offline safety review of the P82/P83 evidence boundary.
 * A shared source archive is a warning to review deploy scope, NOT evidence
 * that a particular Firebase deployment command would be safe or unsafe.
 */
const fs=require("node:fs");
const TARGETS=["recordingStatus","usageStatus"];
const EXCLUDED=["reserveCredit","finalizeCredit","recoverStaleVideoReservation"];
function verify(p82,p83,observation){
 const blocked=(reason)=>({schema:"P84_RESULT_V1",state:"INVALID_OR_INCOMPLETE",
   reason,deploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!p82||p82.schema!=="P82_REMEDIATION_PACKAGE_V1"||
    p82.project!=="packtook-staging"||p82.deployAllowed!==false||
    p82.release!=="NO_GO_RELEASE"||p82.scope?.cloudChangesPermitted!==false||
    JSON.stringify(p82.scope.existingCallableNames)!==JSON.stringify(TARGETS)||
    JSON.stringify(p82.scope.creditCallableNamesUnaffected)!==JSON.stringify(EXCLUDED))
  return blocked("P82_SCOPE_INVALID");
 if(!p83||p83.schema!=="P83_DEPLOYMENT_EVIDENCE_V1"||
    p83.project!=="packtook-staging"||!p83.checks||
    Object.keys(p83.checks).length!==12||
    Object.values(p83.checks).some(x=>x!=="NOT_VERIFIED"))
  return blocked("P83_EVIDENCE_INVALID");
 if(!observation||observation.schema!=="P84_OWNER_P83_OBSERVATION_V1"||
    observation.project!=="packtook-staging"||
    JSON.stringify(observation.functions)!==JSON.stringify([...TARGETS,...EXCLUDED])||
    observation.p83MetadataStable!==true||
    observation.p83AllSourceGenerationsPresent!==true||
    observation.p83AllRuntimeIdentitiesPresent!==true||
    observation.p83CodebaseLabelsPresent!==false||
    observation.p83RuntimeIdentitiesShared!==true||
    observation.rollbackRestorable!=="NOT_VERIFIED"||
    observation.codebaseOwnership!=="NOT_VERIFIED"||
    observation.backendAppCheck!=="NOT_PROVEN"||
    observation.leastPrivilegeIam!=="NOT_VERIFIED"||
    observation.deployPerformed!==false)
  return blocked("OPERATOR_EVIDENCE_INVALID");
 return {schema:"P84_RESULT_V1",
   state:"OBSERVED_METADATA_ONLY_REVIEW_REQUIRED",
   statusTargets:TARGETS,excludedCreditTargets:EXCLUDED,
   sourceGeneration:"PRESENT_NOT_RESTORABILITY_PROOF",
   codebaseOwnership:"NOT_VERIFIED",
   frontendSemanticCompatibility:"NOT_PROVEN",
   sharedRuntimeIdentity:"CONFIRMED_NEEDS_IAM_REVIEW",
   deployedStatusGuards:"P80_DRIFT_CONFIRMED",
   rollbackRestorable:"NOT_VERIFIED",
   backendAppCheck:"NOT_PROVEN",
   deploy:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={verify};
if(require.main===module){
 try{
  const [a,b,c]=process.argv.slice(2);
  const data=[a,b,c].map(x=>JSON.parse(fs.readFileSync(x,"utf8")));
  const r=verify(...data);process.stdout.write(JSON.stringify(r)+"\n");
  if(r.state!=="OBSERVED_METADATA_ONLY_REVIEW_REQUIRED")process.exitCode=2;
 }catch{
  process.stdout.write('{"schema":"P84_RESULT_V1","state":"NOT_VERIFIABLE","deploy":"BLOCKED","release":"NO_GO_RELEASE"}\n');
  process.exitCode=2;
 }
}
