"use strict";
const fs=require("node:fs");
const path=require("node:path");
const FUNCTIONS=["recordingStatus","usageStatus"];
const CREDITS=["reserveCredit","finalizeCredit","recoverStaleVideoReservation"];
function baseline(){return {
 schema:"P95_SOURCE_FIRST_RECOVERY_V1",
 project:"packtook-staging",
 currentStatusSourceArchives:{recordingStatus:"READABLE_METADATA_ONLY",usageStatus:"READABLE_METADATA_ONLY"},
 currentRevisionDigestPins:{recordingStatus:"20_OF_20",usageStatus:"21_OF_21"},
 currentRegistryLookups:{recordingStatus:"TWO_METHODS_NOT_FOUND_REPO_VISIBLE",usageStatus:"NOT_CHECKED"},
 statusGuardDrift:"P80_UNREMEDIATED",
 statusFunctions:[...FUNCTIONS],
 excludedCreditFunctions:[...CREDITS],
 proposedPatch:"P81_P82_CANDIDATE_ONLY",
 candidateSourceToCurrentRevision:"NOT_VERIFIED",
 sourceToGitCommit:"NOT_VERIFIED",
 exactDeploySelector:"NOT_VERIFIED",
 priorKnownGood:"NOT_SELECTED",
 restoreDrill:"NOT_PERFORMED",
 liveAppCheck:"NOT_PROVEN",
 IAMLeastPrivilege:"NOT_VERIFIED",
 cloudWrites:0,trafficChanges:0,deployed:false,
 release:"NO_GO_RELEASE"
};}
function evaluate(x){
 const fail=(reason)=>({schema:"P95_RECOVERY_GATE_V1",state:"INVALID_EVIDENCE",reason,
   action:"NO_DEPLOY",release:"NO_GO_RELEASE"});
 const expected=baseline();
 if(!x||typeof x!=="object"||x.schema!==expected.schema||x.project!=="packtook-staging")return fail("SCOPE");
 for(const [key,expectedValues] of [
  ["statusFunctions",FUNCTIONS],["excludedCreditFunctions",CREDITS]]){
   if(!Array.isArray(x[key])||x[key].length!==expectedValues.length||
    x[key].some((value,i)=>value!==expectedValues[i]))return fail("FUNCTION_BOUNDARY");
 }
 for(const key of ["currentStatusSourceArchives","currentRevisionDigestPins","currentRegistryLookups"]){
   if(!x[key]||Object.keys(x[key]).sort().join("|")!==Object.keys(expected[key]).sort().join("|")||
      Object.entries(expected[key]).some(([k,v])=>x[key][k]!==v))return fail("SOURCE_EVIDENCE_CHANGED");
 }
 for(const key of ["statusGuardDrift","proposedPatch","candidateSourceToCurrentRevision","sourceToGitCommit",
    "exactDeploySelector","priorKnownGood","restoreDrill","liveAppCheck","IAMLeastPrivilege","release"]){
    if(x[key]!==expected[key])return fail("UNAUTHORIZED_EVIDENCE_PROMOTION");
 }
 if(x.cloudWrites!==0||x.trafficChanges!==0||x.deployed!==false)return fail("CLOUD_CHANGE");
 return {schema:"P95_RECOVERY_GATE_V1",state:"SOURCE_FIRST_RECOVERY_PREFLIGHT_ONLY",
  sourceAvailability:"P88_CURRENT_SOURCE_READABLE",
  registryEvidence:"REPO_VISIBLE_CURRENT_IMAGE_NOT_FOUND_BY_TWO_LOOKUPS",
  excludedCreditFunctions:3,
  statusGuardDrift:"P80_UNREMEDIATED",
  recommendedNext:"VERIFY_CANDIDATE_SOURCE_AND_HANDLER_LEVEL_DIFF_OFFLINE",
  alternative:"BUILD_NEW_STAGING_ONLY_IMAGE_AFTER_AUTHORIZED_CHANGE_REVIEW",
  priorImageRestorability:"NOT_VERIFIED",knownGood:"NOT_SELECTED",
  action:"NO_DEPLOY",release:"NO_GO_RELEASE"};
}
module.exports={baseline,evaluate};
if(require.main===module){
 try{
   const x=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../staging-candidates/p95-source-first-recovery.json"),"utf8"));
   const y=evaluate(x);console.log(JSON.stringify(y));
   if(y.state==="INVALID_EVIDENCE")process.exitCode=2;
 }catch{
   console.log('{"schema":"P95_RECOVERY_GATE_V1","state":"INVALID_EVIDENCE","action":"NO_DEPLOY","release":"NO_GO_RELEASE"}');
   process.exitCode=2;
 }
}
