"use strict";
/* P91 operator evidence: image metadata is not source/commit or rollback proof.
 * Fail closed even if an entire historical image family is visible.
 */
const fs=require("node:fs"),path=require("node:path");
const EXPECTED=Object.freeze({recordingStatus:20,usageStatus:21});
function blank(){return {schema:"P91_LINEAGE_EVIDENCE_V1",project:"packtook-staging",
 baseline:"P90_OPERATOR_RESULT",historyCounts:{...EXPECTED},
 lineage:{recordingStatus:"NOT_CHECKED",usageStatus:"NOT_CHECKED"},
 currentPinnedSourcesReadable:true,priorKnownGoodImage:"NOT_VERIFIED",
 sourceToGitCommit:"NOT_VERIFIED",liveAppCheck:"NOT_PROVEN",
 rollbackRestorable:"NOT_VERIFIED",deploySelector:"NOT_VERIFIED",
 deployment:false,trafficChanged:false,release:"NO_GO_RELEASE"};}
function assess(x){
 const invalid=()=>({schema:"P91_LINEAGE_GATE_V1",state:"INVALID_EVIDENCE",
  deploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!x||x.schema!=="P91_LINEAGE_EVIDENCE_V1"||x.project!=="packtook-staging"||
   x.baseline!=="P90_OPERATOR_RESULT"||!x.historyCounts||
   Object.keys(x.historyCounts).sort().join("|")!==Object.keys(EXPECTED).sort().join("|")||
   Object.entries(EXPECTED).some(([k,v])=>x.historyCounts[k]!==v)||
   !x.lineage||Object.keys(x.lineage).sort().join("|")!==Object.keys(EXPECTED).sort().join("|")||
   Object.keys(EXPECTED).some(k=>!["NOT_CHECKED","METADATA_OBSERVED_ONLY","NOT_VERIFIABLE"].includes(x.lineage[k]))||
   x.currentPinnedSourcesReadable!==true||x.priorKnownGoodImage!=="NOT_VERIFIED"||
   x.sourceToGitCommit!=="NOT_VERIFIED"||x.liveAppCheck!=="NOT_PROVEN"||
   x.rollbackRestorable!=="NOT_VERIFIED"||x.deploySelector!=="NOT_VERIFIED"||
   x.deployment!==false||x.trafficChanged!==false||x.release!=="NO_GO_RELEASE")
  return invalid();
 const count=Object.values(x.lineage).filter(v=>v==="METADATA_OBSERVED_ONLY").length;
 return {schema:"P91_LINEAGE_GATE_V1",state:count===2?"IMAGE_LINEAGE_OBSERVED_ONLY":"LIVE_LINEAGE_INCOMPLETE",
  checkedCount:count,total:2,
  knownGoodImage:"NOT_SELECTED",sourceToGitCommit:"NOT_VERIFIED",
  rollbackRestorable:"NOT_VERIFIED",
  deployedGuardDrift:"P80_UNREMEDIATED",
  deploy:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={blank,assess};
if(require.main===module){
 try{
  const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,
    "../staging-candidates/p91-lineage-evidence.json"),"utf8"));
  console.log(JSON.stringify(assess(data)));
 }catch{
  console.log('{"schema":"P91_LINEAGE_GATE_V1","state":"INVALID_EVIDENCE","deploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
