"use strict";
/* P74 review evidence classifier, no Google SDK/network/cloud calls.
 * Never print raw evidence, function source, service account emails or secrets.
 */
const fs=require("node:fs");
const TARGETS=["recordingStatus","usageStatus","reserveCredit","finalizeCredit","recoverStaleVideoReservation"];
const STATUSES=["VERIFIED","DRIFT","NOT_VERIFIED","NOT_APPLICABLE"];
const KEYS=["backendAppCheckEnforced","negativeInvalidAppCheckDenied",
 "negativeMissingAppCheckDenied","authIdTokenEnforced","stagingProjectIdentity",
 "runtimeServiceIdentity","leastPrivilegeIamReviewed","iamBindingsReviewed",
 "secretsBindingsReviewed","sourceArchivePinned","sourceRevisionStable",
 "fiveFunctionConfigReviewed","pilotClosed","publicSignupClosed",
 "monitoringAlertingReviewed","rollbackRevisionRecorded","ownerApproval"];
function strictShape(e){
 if(!e||typeof e!=="object"||Array.isArray(e)||
    Object.keys(e).sort().join("|")!==["schema","project","observations"].sort().join("|"))return false;
 if(e.schema!=="P74_EVIDENCE_V1"||e.project!=="packtook-staging"||
    !e.observations||typeof e.observations!=="object"||Array.isArray(e.observations))return false;
 const o=e.observations;
 if(Object.keys(o).sort().join("|")!==KEYS.slice().sort().join("|"))return false;
 return KEYS.every(k=>STATUSES.includes(o[k]));
}
function classify(e){
 if(!strictShape(e))return {schema:"P74_RESULT_V1",state:"EVIDENCE_INVALID",
  blockerCount:KEYS.length,backendAppCheck:"NOT_PROVEN",stagingDeploy:"BLOCKED",release:"NO_GO_RELEASE"};
 const o=e.observations;
 // P63 read-only results already report guard drift in deployed Staging.
 // No local evidence may turn source drift into a deployment approval.
 const blockers=KEYS.filter(k=>o[k]!=="VERIFIED");
 const critical=["backendAppCheckEnforced","negativeInvalidAppCheckDenied",
  "negativeMissingAppCheckDenied","authIdTokenEnforced",
  "stagingProjectIdentity","runtimeServiceIdentity","leastPrivilegeIamReviewed",
  "sourceArchivePinned","sourceRevisionStable","pilotClosed","publicSignupClosed","ownerApproval"];
 const severe=critical.filter(k=>o[k]!=="VERIFIED");
 return {
  schema:"P74_RESULT_V1",
  state:blockers.length?"EVIDENCE_REVIEW_REQUIRED":"EVIDENCE_COMPLETE_REVIEW_ONLY",
  verifiedCount:KEYS.length-blockers.length,requiredCount:KEYS.length,
  blockerCount:blockers.length,
  blockerFields:blockers,
  criticalBlockerCount:severe.length,
  backendAppCheck:o.backendAppCheckEnforced==="VERIFIED"&&
   o.negativeMissingAppCheckDenied==="VERIFIED"&&
   o.negativeInvalidAppCheckDenied==="VERIFIED"?"EVIDENCE_REPORTED_NOT_INDEPENDENTLY_ATTESTED":"NOT_PROVEN",
  p63StagingGuardDrift:"UNRESOLVED",
  stagingDeploy:"BLOCKED",
  release:"NO_GO_RELEASE"
 };
}
function template(){
 return {schema:"P74_EVIDENCE_V1",project:"packtook-staging",
  observations:Object.fromEntries(KEYS.map(k=>[k,"NOT_VERIFIED"]))};
}
module.exports={TARGETS,KEYS,strictShape,classify,template};
if(require.main===module){
 let out;
 try{
  const raw=fs.readFileSync(0,"utf8");
  if(Buffer.byteLength(raw)>10000)throw Error("TOO_LARGE");
  out=classify(JSON.parse(raw));
 }catch{out=classify(null);}
 process.stdout.write(JSON.stringify(out)+"\n");
 if(out.state==="EVIDENCE_INVALID")process.exitCode=2;
}
