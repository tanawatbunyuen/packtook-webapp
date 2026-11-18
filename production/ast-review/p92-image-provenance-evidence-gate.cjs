"use strict";
/* P92 operator P91 results are metadata observations only. No image,
 * archive, prior version or rollback is verified as safe or recoverable.
 */
const fs=require("node:fs"),path=require("node:path");
const BASE={recordingStatus:20,usageStatus:21};
function template(){return {
 schema:"P92_IMAGE_PROVENANCE_EVIDENCE_V1",
 project:"packtook-staging",
 p91Counts:{...BASE},
 p91CurrentRevisionPresent:{recordingStatus:true,usageStatus:true},
 p91UniqueImageReferences:{...BASE},
 p92DigestClassification:{recordingStatus:"NOT_CHECKED",usageStatus:"NOT_CHECKED"},
 verifiedPriorKnownGoodImage:false,
 imageRegistryRetrievability:"NOT_VERIFIED",
 immutableSourceToRevisionMapping:"NOT_VERIFIED",
 sourceToGitCommit:"NOT_VERIFIED",
 rollbackDryRun:"NOT_PERFORMED",
 appCheckRuntime:"NOT_PROVEN",
 IAMLeastPrivilege:"NOT_VERIFIED",
 deployment:false,trafficChanges:false,release:"NO_GO_RELEASE"
};}
function assess(x){
 const invalid=(reason)=>({schema:"P92_GATE_V1",state:"INVALID_EVIDENCE",
 reason,rollback:"NOT_VERIFIED",deploy:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!x||x.schema!=="P92_IMAGE_PROVENANCE_EVIDENCE_V1"||
    x.project!=="packtook-staging")return invalid("WRONG_PROJECT_OR_SCHEMA");
 for(const key of ["p91Counts","p91UniqueImageReferences"]){
  const data=x[key];
  if(!data||Object.keys(data).sort().join("|")!==Object.keys(BASE).sort().join("|")||
   Object.entries(BASE).some(([k,n])=>data[k]!==n))return invalid("P91_OBSERVATIONS_INVALID");
 }
 const present=x.p91CurrentRevisionPresent;
 if(!present||Object.keys(present).sort().join("|")!==Object.keys(BASE).sort().join("|")||
   Object.keys(BASE).some(k=>present[k]!==true))return invalid("CURRENT_REVISION_NOT_VERIFIED");
 const classified=x.p92DigestClassification;
 if(!classified||Object.keys(classified).sort().join("|")!==Object.keys(BASE).sort().join("|")||
    Object.keys(BASE).some(k=>!["NOT_CHECKED","IMAGE_METADATA_CLASSIFIED_ONLY","NOT_VERIFIABLE"].includes(classified[k])))
  return invalid("DIGEST_OBSERVATION_INVALID");
 if(x.verifiedPriorKnownGoodImage!==false||
   x.imageRegistryRetrievability!=="NOT_VERIFIED"||
   x.immutableSourceToRevisionMapping!=="NOT_VERIFIED"||
   x.sourceToGitCommit!=="NOT_VERIFIED"||
   x.rollbackDryRun!=="NOT_PERFORMED"||
   x.appCheckRuntime!=="NOT_PROVEN"||
   x.IAMLeastPrivilege!=="NOT_VERIFIED"||
   x.deployment!==false||x.trafficChanges!==false||
   x.release!=="NO_GO_RELEASE")return invalid("UNAUTHORIZED_EVIDENCE_PROMOTION");
 const count=Object.values(classified).filter(v=>v==="IMAGE_METADATA_CLASSIFIED_ONLY").length;
 return {
  schema:"P92_GATE_V1",
  state:count===2?"DIGEST_METADATA_REVIEW_ONLY":"DIGEST_CLASSIFICATION_INCOMPLETE",
  inspectedCount:count,targetCount:2,
  knownGoodImage:"NOT_SELECTED",
  imageAvailable:"NOT_VERIFIED",
  priorSourceToRevision:"NOT_VERIFIED",
  rollback:"NOT_VERIFIED",
  guardDrift:"P80_UNREMEDIATED",
  deploy:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={template,assess};
if(require.main===module){
 try{
  const p=path.resolve(__dirname,"../staging-candidates/p92-image-provenance-evidence.json");
  const x=JSON.parse(fs.readFileSync(p,"utf8"));
  const r=assess(x);console.log(JSON.stringify(r));
  if(r.state==="INVALID_EVIDENCE")process.exitCode=2;
 }catch{
  console.log('{"schema":"P92_GATE_V1","state":"INVALID_EVIDENCE","deploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
