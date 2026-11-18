"use strict";
/* P89 history-only operator evidence. Revision counts are never proof of
 * a safe prior binary, retrievable source generation, or tested restore.
 */
const fs=require("node:fs"),path=require("node:path");
const names=["recordingStatus","usageStatus"];
function baseline(){return {
 schema:"P89_STAGING_HISTORY_EVIDENCE_V1",project:"packtook-staging",
 currentArchiveReadable:{recordingStatus:true,usageStatus:true},
 history:Object.fromEntries(names.map(n=>[n,"NOT_CHECKED"])),
 sourceGenerationToPreviousRevision:"NOT_VERIFIED",
 previousRevisionSecurityReviewed:"NOT_VERIFIED",
 restoreDrillPerformed:false,backendAppCheck:"NOT_PROVEN",
 iamLeastPrivilege:"NOT_VERIFIED",deployment:false,release:"NO_GO_RELEASE"
};}
const states=["NOT_CHECKED","HISTORY_METADATA_ONLY","NOT_VERIFIABLE","METADATA_CHANGED_REVIEW_REQUIRED"];
function classify(x){
 const fail=()=>({schema:"P89_HISTORY_GATE_V1",state:"INVALID_EVIDENCE",
  rollback:"NOT_VERIFIED",stagingDeploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!x||x.schema!=="P89_STAGING_HISTORY_EVIDENCE_V1"||x.project!=="packtook-staging"||
  !x.currentArchiveReadable||Object.keys(x.currentArchiveReadable).sort().join("|")!==names.slice().sort().join("|")||
  names.some(n=>x.currentArchiveReadable[n]!==true)||
  !x.history||Object.keys(x.history).sort().join("|")!==names.slice().sort().join("|")||
  names.some(n=>!states.includes(x.history[n]))||
  x.sourceGenerationToPreviousRevision!=="NOT_VERIFIED"||
  x.previousRevisionSecurityReviewed!=="NOT_VERIFIED"||
  x.restoreDrillPerformed!==false||x.backendAppCheck!=="NOT_PROVEN"||
  x.iamLeastPrivilege!=="NOT_VERIFIED"||x.deployment!==false||
  x.release!=="NO_GO_RELEASE")return fail();
 const observed=names.filter(n=>x.history[n]==="HISTORY_METADATA_ONLY").length;
 return {schema:"P89_HISTORY_GATE_V1",
  state:observed===2?"HISTORY_METADATA_OBSERVED_ONLY":"HISTORY_CHECK_INCOMPLETE",
  currentSourceReadability:"2_OF_2_P88_CONFIRMED",
  revisionHistoryInspected:observed,historyTargets:2,
  knownGoodPreviousRevision:"NOT_VERIFIED",
  priorArchiveRestorable:"NOT_VERIFIED",
  sourceCommitEquivalence:"NOT_VERIFIED",
  deployedStagingGuardDrift:"P80_UNREMEDIATED",
  rollback:"NOT_VERIFIED",stagingDeploy:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={baseline,classify};
if(require.main===module){
 try{
  const input=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../staging-candidates/p89-history-evidence.json"),"utf8"));
  console.log(JSON.stringify(classify(input)));
 }catch{
  console.log('{"schema":"P89_HISTORY_GATE_V1","state":"INVALID_EVIDENCE","stagingDeploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
