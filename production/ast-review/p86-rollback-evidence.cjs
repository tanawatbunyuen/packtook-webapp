"use strict";
/* P86 immutable rollback evidence classifier: no claim of restore unless
 * separately attested. This classifier NEVER approves deploy automatically.
 */
const REQUIRED=Object.freeze([
 "fiveFunctionRevisionInventory",
 "statusFunctionSourceGenerations",
 "creditFunctionSourceGenerations",
 "sourceGenerationReadability",
 "previousSourceDependenciesCaptured",
 "runtimeServiceIdentityBindingsReviewed",
 "rollbackBuildReproducibility",
 "isolatedStagingRestoreDryRun",
 "statusFunctionsAfterRestoreParity",
 "creditFunctionsUnaffectedReattestation",
 "operationalRollbackTriggers",
 "operatorAndOwnerChangeApproval"
]);
const STATUS=Object.freeze(["NOT_VERIFIED","VERIFIED","BLOCKED","DRIFT"]);
function empty(){
 return {schema:"P86_ROLLBACK_EVIDENCE_V1",project:"packtook-staging",
  functions:["recordingStatus","usageStatus","reserveCredit","finalizeCredit","recoverStaleVideoReservation"],
  fields:Object.fromEntries(REQUIRED.map(k=>[k,"NOT_VERIFIED"])),
  completedRestore:false,
  stagingDeployAllowed:false,productionRelease:"NO_GO_RELEASE"};
}
function inspect(data){
 const deny=(reason)=>({schema:"P86_ROLLBACK_REVIEW_V1",state:"EVIDENCE_INVALID",
  reason,restorableRollback:"NOT_VERIFIED",deploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!data||data.schema!=="P86_ROLLBACK_EVIDENCE_V1"||
    data.project!=="packtook-staging"||
    JSON.stringify(data.functions)!==JSON.stringify(empty().functions)||
    !data.fields||Object.keys(data.fields).sort().join("|")!==REQUIRED.slice().sort().join("|")||
    REQUIRED.some(k=>!STATUS.includes(data.fields[k]))||
    data.stagingDeployAllowed!==false||data.productionRelease!=="NO_GO_RELEASE"||
    typeof data.completedRestore!=="boolean")
   return deny("SOURCE_OR_RELEASE_BOUNDARY");
 const unverified=REQUIRED.filter(k=>data.fields[k]!=="VERIFIED");
 const rollbackReported=data.completedRestore===true&&unverified.length===0;
 return {
  schema:"P86_ROLLBACK_REVIEW_V1",
  state:rollbackReported?"REPORTED_EVIDENCE_NEEDS_INDEPENDENT_ATTESTATION":"ROLLBACK_NOT_VERIFIED",
  verifiedCount:REQUIRED.length-unverified.length,
  requiredCount:REQUIRED.length,
  missingOrBlocked:unverified,
  restoredLiveFunctions:"NOT_ATTESTED",
  restorableRollback:"NOT_VERIFIED",
  stagingDeploySelector:"NOT_VERIFIED",
  deploy:"BLOCKED",release:"NO_GO_RELEASE"
 };
}
module.exports={REQUIRED,empty,inspect};
if(require.main===module){
 try{
  const fs=require("node:fs"),path=require("node:path");
  const input=JSON.parse(fs.readFileSync(path.resolve(__dirname,
   "../staging-candidates/p86-rollback-evidence.json"),"utf8"));
  const result=inspect(input);
  console.log(JSON.stringify(result));
  if(result.state==="EVIDENCE_INVALID")process.exitCode=2;
 }catch{
  console.log('{"schema":"P86_ROLLBACK_REVIEW_V1","state":"EVIDENCE_INVALID","deploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
