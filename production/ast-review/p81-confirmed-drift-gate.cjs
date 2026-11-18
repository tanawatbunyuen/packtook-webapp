"use strict";
const fs=require("node:fs");
function assess(e,source){
 const invalid=()=>({p:"P81",state:"INVALID_EVIDENCE",stagingDeploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!e||typeof e!=="object"||e.schema!=="P81_OPERATOR_ATTESTATION_V1"||
  e.project!=="packtook-staging"||e.source!=="P80_PINNED_SOURCE_OPERATOR_RESULT"||
  e.recordingStatus!=="DRIFT_REVIEW_REQUIRED"||
  e.usageStatus!=="DRIFT_REVIEW_REQUIRED"||
  e.allFiveRevisionStable!==true||e.appCheck!=="NOT_PROVEN"||
  e.iamLeastPrivilege!=="NOT_VERIFIED"||e.cloudWrites!==0||
  e.deploy!==0||e.release!=="NO_GO_RELEASE"||typeof source!=="string"||
  !source.includes("enforceAppCheck:true")||
  !source.includes("gate.assertAuthorized(request)")||
  !source.includes("gate.uid(request)")||
  source.includes("exports.recordingStatus="))return invalid();
 return {p:"P81",state:"GUARD_DRIFT_CONFIRMED_CANDIDATE_ONLY",
  recordingStatus:"DRIFT_CONFIRMED",usageStatus:"DRIFT_CONFIRMED",
  staticGuardCandidate:"PREPARED_NOT_DEPLOYED",
  deployedGuardStatus:"UNREMEDIATED",
  allFiveMetadata:"STABLE_AS_OPERATOR_REPORTED",
  liveAppCheck:"NOT_PROVEN",liveIAM:"NOT_VERIFIED",
  stagingDeploy:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={assess};
if(require.main===module){
 try{
  const [a,b]=process.argv.slice(2);
  if(!a||!b)throw Error("ARGS");
  console.log(JSON.stringify(assess(JSON.parse(fs.readFileSync(a,"utf8")),fs.readFileSync(b,"utf8"))));
 }catch{
  console.log('{"p":"P81","state":"NOT_VERIFIABLE","stagingDeploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
