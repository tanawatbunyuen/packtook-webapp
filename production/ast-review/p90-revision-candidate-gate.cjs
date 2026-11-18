"use strict";
/* P90 observed historical revision counts are not rollback proof.
 * An older Ready revision is not known-good, nor necessarily restorable.
 */
const fs=require("node:fs"),path=require("node:path");
const EXPECTED={recordingStatus:20,usageStatus:21};
function baseline(){return {
 schema:"P90_OWNER_REVISION_OBSERVATION_V1",project:"packtook-staging",
 observedAt:"P89_OWNER_READ_ONLY",
 visibleRevisionCounts:{...EXPECTED},
 currentPinnedSourcesReadable:true,
 knownGoodPriorRevision:"NOT_VERIFIED",
 priorSourceGenerationMapping:"NOT_VERIFIED",
 safeDeploySelector:"NOT_VERIFIED",
 candidateSelected:false,trafficChanged:false,deployPerformed:false,
 release:"NO_GO_RELEASE"};
}
function check(x){
 const bad=()=>({schema:"P90_GATE_V1",state:"INVALID_EVIDENCE",
   rollback:"NOT_VERIFIED",deploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!x||x.schema!=="P90_OWNER_REVISION_OBSERVATION_V1"||
  x.project!=="packtook-staging"||x.observedAt!=="P89_OWNER_READ_ONLY"||
  !x.visibleRevisionCounts||Object.keys(x.visibleRevisionCounts).sort().join("|")!==
   Object.keys(EXPECTED).sort().join("|")||
  Object.entries(EXPECTED).some(([k,n])=>x.visibleRevisionCounts[k]!==n)||
  x.currentPinnedSourcesReadable!==true||
  x.knownGoodPriorRevision!=="NOT_VERIFIED"||
  x.priorSourceGenerationMapping!=="NOT_VERIFIED"||
  x.safeDeploySelector!=="NOT_VERIFIED"||
  x.candidateSelected!==false||x.trafficChanged!==false||
  x.deployPerformed!==false||x.release!=="NO_GO_RELEASE")return bad();
 return {schema:"P90_GATE_V1",state:"HISTORY_COUNTS_CONFIRMED_ONLY",
  recordingStatusVisible:20,usageStatusVisible:21,
  knownGoodCandidate:"NOT_SELECTED",
  previousBinaryProvenSafe:false,
  priorSourceGenerationMapping:"NOT_VERIFIED",
  rollback:"NOT_VERIFIED",deploy:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={baseline,check};
if(require.main===module){
 try{
  const input=JSON.parse(fs.readFileSync(path.resolve(__dirname,
   "../staging-candidates/p90-owner-history-evidence.json"),"utf8"));
  console.log(JSON.stringify(check(input)));
 }catch{
  console.log('{"schema":"P90_GATE_V1","state":"INVALID_EVIDENCE","deploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
