"use strict";
/* P93 observed P92: 41/41 pinned historical digest refs.
 * A successful Artifact Registry read validates metadata accessibility only,
 * never runnable container, tested rollback or known-good security.
 */
const fs=require("node:fs"),path=require("node:path");
const BASE={recordingStatus:20,usageStatus:21};
function template(){return {
 schema:"P93_REGISTRY_EVIDENCE_V1",project:"packtook-staging",
 p92DigestPinnedCount:{...BASE},
 currentRevisionPresent:{recordingStatus:true,usageStatus:true},
 registry:{recordingStatus:"NOT_CHECKED",usageStatus:"NOT_CHECKED"},
 knownGoodPriorImage:"NOT_VERIFIED",
 imagePullAndExecution:"NOT_VERIFIED",
 sourceToGitCommit:"NOT_VERIFIED",
 testedRollback:"NOT_PERFORMED",
 backendAppCheck:"NOT_PROVEN",
 leastPrivilegeIAM:"NOT_VERIFIED",
 safeDeploySelector:"NOT_VERIFIED",
 stagingDeploy:false,trafficChange:false,
 release:"NO_GO_RELEASE"
};}
function classify(x){
 const bad=()=>({schema:"P93_GATE_V1",state:"INVALID_EVIDENCE",
  deploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!x||x.schema!=="P93_REGISTRY_EVIDENCE_V1"||x.project!=="packtook-staging"||
    !x.p92DigestPinnedCount||
    Object.keys(x.p92DigestPinnedCount).sort().join("|")!==Object.keys(BASE).sort().join("|")||
    Object.entries(BASE).some(([key,count])=>x.p92DigestPinnedCount[key]!==count)||
    !x.currentRevisionPresent||
    Object.keys(x.currentRevisionPresent).sort().join("|")!==Object.keys(BASE).sort().join("|")||
    Object.keys(BASE).some(k=>x.currentRevisionPresent[k]!==true)||
    !x.registry||
    Object.keys(x.registry).sort().join("|")!==Object.keys(BASE).sort().join("|")||
    Object.keys(BASE).some(k=>!["NOT_CHECKED","REGISTRY_DIGEST_METADATA_MATCHED_ONLY","NOT_VERIFIABLE"].includes(x.registry[k]))||
    x.knownGoodPriorImage!=="NOT_VERIFIED"||
    x.imagePullAndExecution!=="NOT_VERIFIED"||
    x.sourceToGitCommit!=="NOT_VERIFIED"||
    x.testedRollback!=="NOT_PERFORMED"||
    x.backendAppCheck!=="NOT_PROVEN"||
    x.leastPrivilegeIAM!=="NOT_VERIFIED"||
    x.safeDeploySelector!=="NOT_VERIFIED"||
    x.stagingDeploy!==false||x.trafficChange!==false||
    x.release!=="NO_GO_RELEASE")return bad();
 const inspected=Object.values(x.registry).filter(v=>v==="REGISTRY_DIGEST_METADATA_MATCHED_ONLY").length;
 return {schema:"P93_GATE_V1",state:inspected===2?"REGISTRY_METADATA_REVIEW_ONLY":"REGISTRY_LIVE_INSPECTION_INCOMPLETE",
  inspected,required:2,
  imageDigestMetadata:"P92_ALL_41_PINNED",
  imagePullAndExecution:"NOT_VERIFIED",
  priorKnownGood:"NOT_SELECTED",
  restoreDrill:"NOT_PERFORMED",
  existingGuardDrift:"P80_UNREMEDIATED",
  deploy:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={template,classify};
if(require.main===module){
 try{
  const input=JSON.parse(fs.readFileSync(path.resolve(__dirname,
   "../staging-candidates/p93-registry-evidence.json"),"utf8"));
  console.log(JSON.stringify(classify(input)));
 }catch{
  console.log('{"schema":"P93_GATE_V1","state":"INVALID_EVIDENCE","deploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
