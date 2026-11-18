"use strict";
/* P88 offline interpretation gate. Bounded current-source read success never
 * proves a prior, safe, reproducible or restorable deployment.
 */
const fs=require("node:fs"),path=require("node:path");
const NAMES=["recordingStatus","usageStatus"];
const OPTIONS=["NOT_CHECKED","CURRENT_PINNED_ARCHIVE_READABLE_ONLY","NOT_VERIFIABLE","METADATA_DRIFT_REVIEW_REQUIRED"];
function template(){
 return {schema:"P88_OPERATOR_CURRENT_SOURCE_V1",project:"packtook-staging",
  functions:Object.fromEntries(NAMES.map(n=>[n,"NOT_CHECKED"])),
  knownGoodPriorRevision:"NOT_VERIFIED",
  restoreDryRun:"NOT_VERIFIED",
  sourceToCommitParity:"NOT_VERIFIED",
  backendAppCheck:"NOT_PROVEN",
  safeDeploySelector:"NOT_VERIFIED",
  deployPerformed:false};
}
function classify(x){
 const fail=()=>({schema:"P88_SOURCE_EVIDENCE_GATE",state:"INVALID",
   deployment:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!x||x.schema!=="P88_OPERATOR_CURRENT_SOURCE_V1"||
  x.project!=="packtook-staging"||!x.functions||
  Object.keys(x.functions).sort().join("|")!==NAMES.slice().sort().join("|")||
  NAMES.some(n=>!OPTIONS.includes(x.functions[n]))||
  x.knownGoodPriorRevision!=="NOT_VERIFIED"||
  x.restoreDryRun!=="NOT_VERIFIED"||
  x.sourceToCommitParity!=="NOT_VERIFIED"||
  x.backendAppCheck!=="NOT_PROVEN"||
  x.safeDeploySelector!=="NOT_VERIFIED"||
  x.deployPerformed!==false)return fail();
 const count=NAMES.filter(n=>x.functions[n]==="CURRENT_PINNED_ARCHIVE_READABLE_ONLY").length;
 return {schema:"P88_SOURCE_EVIDENCE_GATE",
  state:count===2?"CURRENT_ARCHIVES_READABLE_UNATTESTED":"INSPECTION_INCOMPLETE",
  checkedCount:count,requiredCount:2,
  statusGuards:"P80_CONFIRMED_DRIFT_UNREMEDIATED",
  previousVersionRestorable:"NOT_VERIFIED",
  currentSourceOnly:"READABILITY_NOT_SAFE_ROLLBACK",
  backendAppCheck:"NOT_PROVEN",
  deployment:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={template,classify};
if(require.main===module){
 try{
  const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,
    "../staging-candidates/p88-current-source-evidence.json"),"utf8"));
  console.log(JSON.stringify(classify(data)));
 }catch{
  console.log('{"schema":"P88_SOURCE_EVIDENCE_GATE","state":"INVALID","deployment":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
