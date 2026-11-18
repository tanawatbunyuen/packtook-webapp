"use strict";
/* P85 offline SOURCE ownership audit. Checked-out Firebase config is not
 * authoritative about currently deployed Staging codebase ownership.
 * Immutable: no API call, write or deploy path, independent signoff required.
 */
const fs=require("node:fs"),path=require("node:path");
const TARGETS=Object.freeze(["recordingStatus","usageStatus"]);
const CREDIT=Object.freeze(["reserveCredit","finalizeCredit","recoverStaleVideoReservation"]);
const ALL=Object.freeze([...TARGETS,...CREDIT]);
const EXPECTED=Object.freeze([
 {codebase:"beta",source:"functions"},
 {codebase:"owner",source:"owner-functions"},
 {codebase:"promptpay",source:"payment-functions"}]);
function invalid(reason){return {schema:"P85_OWNERSHIP_AUDIT_V1",state:"REVIEW_BLOCKED",
 reason,deploySelector:"NOT_VERIFIED",deploy:"BLOCKED",release:"NO_GO_RELEASE"};}
function audit(config,sources){
 if(!config||!Array.isArray(config.functions)||config.functions.length!==3||
  !config.functions.every((item,i)=>item&&
   item.codebase===EXPECTED[i].codebase&&item.source===EXPECTED[i].source))
  return invalid("FIREBASE_CONFIG_MISMATCH");
 if(!sources||typeof sources!=="object"||Object.keys(sources).sort().join("|")!==
  EXPECTED.map(x=>x.source).sort().join("|"))return invalid("SOURCE_TREE_INCOMPLETE");
 const entries=EXPECTED.map(item=>({
  ...item,content:sources[item.source]
 }));
 if(entries.some(x=>typeof x.content!=="string"||!x.content||
   Buffer.byteLength(x.content)>1048576))return invalid("SOURCE_LIMIT");
 const owners={};
 for(const name of ALL){
  const re=new RegExp("^\\s*exports\\."+name+"\\s*=","gm");
  const found=entries.filter(x=>[...x.content.matchAll(re)].length>0);
  if(found.length!==1)return invalid("EXPORT_OWNERSHIP_AMBIGUOUS_"+name);
  if([...found[0].content.matchAll(re)].length!==1)
   return invalid("DUPLICATE_EXPORT_"+name);
  owners[name]={source:found[0].source,codebase:found[0].codebase};
 }
 if(ALL.some(n=>owners[n].codebase!=="beta"))return invalid("UNEXPECTED_OWNER_FOR_TARGETS");
 return {
  schema:"P85_OWNERSHIP_AUDIT_V1",
  state:"CHECKED_OUT_REPOSITORY_OWNERSHIP_VERIFIED_ONLY",
  repositoryCodebaseForTargets:"beta",
  sourcePathForTargets:"production/functions",
  inspectedExports:ALL.length,
  statusTargets:TARGETS,excludedCredit: CREDIT,
  sharedCodebaseAcrossStatusAndCredit:true,
  observedP84SourcePinsSharedAcrossStatusAndCredit:false,
  codebaseVsSourcePinInterpretation:"NOT_EQUIVALENT",
  exactDeployedCodebaseOwnership:"NOT_VERIFIED",
  safeFirebaseCliSelector:"NOT_VERIFIED",
  rollbackRestorable:"NOT_VERIFIED",
  backendAppCheck:"NOT_PROVEN",
  deployedGuardDrift:"UNREMEDIATED",
  deploy:"BLOCKED",release:"NO_GO_RELEASE"
 };
}
module.exports={audit,EXPECTED,ALL};
if(require.main===module){
 try{
  const base=path.resolve(__dirname,"..");
  const config=JSON.parse(fs.readFileSync(path.join(base,"firebase.json"),"utf8"));
  const sources=Object.fromEntries(EXPECTED.map(x=>
   [x.source,fs.readFileSync(path.join(base,x.source,"index.js"),"utf8")]));
  const result=audit(config,sources);
  console.log(JSON.stringify(result));
  if(result.state!=="CHECKED_OUT_REPOSITORY_OWNERSHIP_VERIFIED_ONLY")process.exitCode=2;
 }catch{
  console.log(JSON.stringify(invalid("NOT_VERIFIABLE")));
  process.exitCode=2;
 }
}
