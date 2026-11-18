"use strict";
/* P75 readiness state machine. All output is review guidance. Never returns deploy approval.
 * No Google SDK access, network calls, secrets or runtime writes.
 */
const fs=require("node:fs");
const {classify,strictShape,KEYS}=require("./p74-security-evidence.cjs");
const TARGETS=Object.freeze(["recordingStatus","usageStatus"]);
const CANDIDATES=Object.freeze(["p69UsageStatus","p69RecordingStatus"]);
function inspect({evidence,manifest,candidate,legacy}){
 const fail=reason=>({schema:"P75_READINESS_V1",state:"NOT_VERIFIABLE",
  issue:reason,stageDeployment:"BLOCKED",guardDrift:"UNRESOLVED",
  backendAppCheck:"NOT_PROVEN",release:"NO_GO_RELEASE"});
 if(!strictShape(evidence))return fail("P74_EVIDENCE_INVALID");
 if(!manifest||manifest.id!=="P70"||manifest.environment!=="packtook-staging"||
   manifest.deployAllowed!==false||manifest.stagingDeploymentPerformed!==false||
   manifest.productionRelease!=="NO_GO_RELEASE"||manifest.replacementOfExistingCallables!==false)
  return fail("DEPLOY_MANIFEST_NOT_FAIL_CLOSED");
 if(typeof candidate!=="string"||typeof legacy!=="string"||
   candidate.length>300000||legacy.length>100000)return fail("SOURCE_INVALID");
 const expected=[
  ["usageStatus","p69UsageStatus"],["recordingStatus","p69RecordingStatus"]
 ];
 if(!expected.every(([orig,alias])=>
    candidate.includes("exports."+alias+"=protect(")&&
    legacy.includes("const "+orig+"=protect(")))
  return fail("SCOPED_GUARD_MISSING");
 if(!candidate.includes("enforceAppCheck:true"))return fail("STATIC_APPCHECK_NOT_TRUE");
 if(candidate.includes("exports.recordingStatus=")||candidate.includes("exports.usageStatus="))
  return fail("LEGACY_NAMES_ALREADY_REGISTERED");
 if(/require\(["']firebase-(?:admin|functions)/.test(legacy)||
    /packtook-prod-01|PACKTOOK_PRODUCTION_PROJECT_ID|packtookProductionBeta/.test(legacy))
  return fail("LEGACY_CANDIDATE_BOUNDARY_INVALID");
 const ev=classify(evidence);
 const blocked=KEYS.filter(k=>evidence.observations[k]!=="VERIFIED");
 return {
  schema:"P75_READINESS_V1",state:"REVIEW_CANDIDATE_ONLY",
  legacyNames:TARGETS,guardCandidate:"STATIC_PROTECT_WRAPPER_PRESENT",
  appCheckOption:"EXPLICIT_TRUE_IN_DIFFERENT_CANDIDATE",
  unresolvedEvidenceCount:blocked.length,
  runtimeEvidence:ev.state,
  evidenceBlockers:blocked,
  semanticParity:"REVIEW_REQUIRED",
  sourceAttestation:"REQUIRED_POST_APPROVED_DEPLOY",
  guardDrift:"UNRESOLVED",
  backendAppCheck:"NOT_PROVEN",
  stageDeployment:"BLOCKED",release:"NO_GO_RELEASE"
 };
}
module.exports={inspect};
if(require.main===module){
 try{
  const [e,m,c,l]=process.argv.slice(2);
  if(!e||!m||!c||!l)throw Error("P75_MISSING_ARGUMENTS");
  const r=inspect({evidence:JSON.parse(fs.readFileSync(e,"utf8")),
   manifest:JSON.parse(fs.readFileSync(m,"utf8")),
   candidate:fs.readFileSync(c,"utf8"),legacy:fs.readFileSync(l,"utf8")});
  process.stdout.write(JSON.stringify(r)+"\n");
  if(r.state!=="REVIEW_CANDIDATE_ONLY")process.exitCode=2;
 }catch{
  process.stdout.write('{"schema":"P75_READINESS_V1","state":"NOT_VERIFIABLE","stageDeployment":"BLOCKED","release":"NO_GO_RELEASE"}\n');
  process.exitCode=2;
 }
}
