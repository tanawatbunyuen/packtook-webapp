"use strict";
/* P78 consolidated release preflight is intentionally NOT an authorization
 * engine. No evidence flags or green test suite can unlock deploy.
 */
const fs=require("node:fs");
const {classify:security}=require("./p74-security-evidence.cjs");
const {classify:operations}=require("./p77-operating-readiness.cjs");
function assess({securityEvidence,operationsEvidence,manifest}){
 const sec=security(securityEvidence),ops=operations(operationsEvidence);
 const safeManifest=manifest&&manifest.id==="P70"&&
  manifest.environment==="packtook-staging"&&
  manifest.deployAllowed===false&&
  manifest.stagingDeploymentPerformed===false&&
  manifest.productionRelease==="NO_GO_RELEASE";
 const blockers=[
  ...(sec.blockerFields||[]).map(x=>"SECURITY:"+x),
  ...(ops.outstanding||[]).map(x=>"OPERATIONS:"+x),
  "P63_DEPLOYED_STAGING_GUARD_DRIFT",
  "POSITIVE_LIVE_APP_CHECK_AUTH_E2E",
  "LIVE_OMISE_TEST_PROVIDER_404_UNRESOLVED",
  "SIGNED_OWNER_AND_COMPLIANCE_APPROVAL",
  "IMMUTABLE_ROLLBACK_AND_STAGING_CHANGE_WINDOW"
 ];
 if(!safeManifest)blockers.push("DEPLOY_MANIFEST_INVALID");
 if(sec.state==="EVIDENCE_INVALID")blockers.push("SECURITY_EVIDENCE_INVALID");
 if(ops.state==="EVIDENCE_INVALID")blockers.push("OPERATIONS_EVIDENCE_INVALID");
 return Object.freeze({
  schema:"P78_FINAL_PRECHECK_V1",project:"packtook-staging",
  reviewScope:"OFFLINE_EVIDENCE_ONLY",
  securityVerified:sec.verifiedCount??0,
  operationsVerified:ops.verifiedCount??0,
  openBlockerCount:blockers.length,
  blockerCategories:Object.freeze({
   security:sec.blockerCount??17,
   operations:ops.outstandingCount??18,
   sourceDrift:"UNRESOLVED",
   cloudBackendAppCheck:"NOT_PROVEN",
   paymentProvider:"NOT_VERIFIED"
  }),
  decision:"NO_GO_CONTROLLED_PILOT",
  stagingDeploy:"BLOCKED",
  publicSignup:"CLOSED_ASSUMED_NOT_LIVE_ATTESTED",
  productionRelease:"NO_GO_RELEASE"
 });
}
module.exports={assess};
if(require.main===module){
 try{
  if(process.argv.length!==5)throw Error("P78_INPUTS");
  const data=process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p,"utf8")));
  process.stdout.write(JSON.stringify(assess({
   securityEvidence:data[0],operationsEvidence:data[1],manifest:data[2]
  }))+"\n");
 }catch{
  process.stdout.write('{"schema":"P78_FINAL_PRECHECK_V1","decision":"NO_GO_CONTROLLED_PILOT","stagingDeploy":"BLOCKED","productionRelease":"NO_GO_RELEASE"}\n');
  process.exitCode=2;
 }
}
