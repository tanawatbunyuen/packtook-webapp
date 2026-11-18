"use strict";
/* P87 provenance and rollback evidence classifier. It never authorizes deploy.
 * Existing P84 operator assertions are bound to observed categories only.
 */
const fs=require("node:fs"),path=require("node:path");
const REQUIRED=Object.freeze([
 "pinnedSourceGenerationReadable",
 "priorKnownGoodSourceIdentified",
 "priorKnownGoodRuntimeRevisionIdentified",
 "deployedSourceToGitCommitMapped",
 "currentFiveFunctionRuntimeMappingReviewed",
 "stagingBetaCodebaseOwnershipIndependentlyVerified",
 "rollbackSourceDependenciesReproducible",
 "rollbackRestoreDryRunPassed",
 "creditFunctionsNoImpactVerified",
 "backendAppCheckRuntimeVerified",
 "leastPrivilegeIAMIndependentlyReviewed",
 "ownerApprovedStagingChangeWindow"
]);
const ALLOWED=new Set(["NOT_VERIFIED","VERIFIED","DRIFT","BLOCKED"]);
function blank(){return {schema:"P87_PROVENANCE_EVIDENCE_V1",
 project:"packtook-staging",
 baseline:"P84_OWNER_RESULT",
 statusGuardDrift:"CONFIRMED_UNREMEDIATED",
 sourcePinAcrossScopes:"NOT_SHARED",
 runtimeIdentitiesShared:true,
 checks:Object.fromEntries(REQUIRED.map(k=>[k,"NOT_VERIFIED"])),
 stagingDeployAllowed:false,release:"NO_GO_RELEASE"};}
function classify(e){
 const invalid=()=>({schema:"P87_PROVENANCE_GATE_V1",state:"EVIDENCE_INVALID",
  deployment:"BLOCKED",release:"NO_GO_RELEASE"});
 if(!e||typeof e!=="object"||Array.isArray(e)||
  e.schema!=="P87_PROVENANCE_EVIDENCE_V1"||e.project!=="packtook-staging"||
  e.baseline!=="P84_OWNER_RESULT"||
  e.statusGuardDrift!=="CONFIRMED_UNREMEDIATED"||
  e.sourcePinAcrossScopes!=="NOT_SHARED"||
  e.runtimeIdentitiesShared!==true||e.stagingDeployAllowed!==false||
  e.release!=="NO_GO_RELEASE"||
  !e.checks||typeof e.checks!=="object"||Array.isArray(e.checks)||
  Object.keys(e.checks).sort().join("|")!==REQUIRED.slice().sort().join("|")||
  REQUIRED.some(k=>!ALLOWED.has(e.checks[k])))return invalid();
 const missing=REQUIRED.filter(k=>e.checks[k]!=="VERIFIED");
 return {schema:"P87_PROVENANCE_GATE_V1",
  state:missing.length?"PROVENANCE_AND_ROLLBACK_REVIEW_REQUIRED":"CLAIMED_EVIDENCE_REQUIRES_INDEPENDENT_REVIEW",
  verifiedCount:REQUIRED.length-missing.length,requiredCount:REQUIRED.length,
  unresolved:missing,
  strictPinnedSourceArchive:"OPERATOR_INSPECTION_REQUIRED",
  deployedSourceToCommitMapping:"NOT_PROVEN",
  priorKnownGoodRestore:"NOT_PROVEN",
  safeDeploySelector:"NOT_VERIFIED",
  backendAppCheck:"NOT_PROVEN",
  statusGuardDrift:"CONFIRMED_UNREMEDIATED",
  deployment:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={REQUIRED,blank,classify};
if(require.main===module){
 try{
  const x=JSON.parse(fs.readFileSync(path.resolve(__dirname,
   "../staging-candidates/p87-provenance-evidence.json"),"utf8"));
  const result=classify(x);console.log(JSON.stringify(result));
  if(result.state==="EVIDENCE_INVALID")process.exitCode=2;
 }catch{
  console.log('{"schema":"P87_PROVENANCE_GATE_V1","state":"EVIDENCE_INVALID","deployment":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
