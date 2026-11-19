"use strict";
/* P99: strictly offline release blocker. Evidence from checked-out source
 * and hermetic original ensureAccount behavior tests ONLY, no Cloud calls.
 */
const fs=require("node:fs"),path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const TARGETS=["recordingStatus","usageStatus"];
const CREDIT=["reserveCredit","finalizeCredit","recoverStaleVideoReservation"];
function analyze({source=fs.readFileSync(path.join(ROOT,"functions/index.js"),"utf8"),
 firebase=JSON.parse(fs.readFileSync(path.join(ROOT,"firebase.json"),"utf8")),
 candidate=fs.readFileSync(path.join(ROOT,"staging-candidates/p98/guarded-status-integration-candidate.cjs"),"utf8"),
 legacy=fs.readFileSync(path.join(ROOT,"staging-candidates/p81/legacy-status-live-gate-candidate.cjs"),"utf8"),
 delegate=fs.readFileSync(path.join(ROOT,"staging-candidates/p75/legacy-status-guard-candidate.cjs"),"utf8")}={}){
 const findings=[];
 const check=(id,ok)=>{if(!ok)findings.push(id)};
 const codebases=Array.isArray(firebase.functions)?firebase.functions:[firebase.functions];
 const beta=codebases.filter(x=>x&&x.codebase==="beta"&&x.source==="functions");
 check("P99_BETA_CODEBASE_UNVERIFIED",beta.length===1);
 for(const fn of TARGETS.concat(CREDIT))
  check("P99_ORIGINAL_FUNCTION_MISSING_"+fn,source.includes("exports."+fn+"="));
 check("P99_WRONG_LEGACY_PROVISIONING_PATTERN",
  source.includes("async function ensureAccount(id)")&&
  source.includes("live.customClaims?.packtookProductionBeta!==true")&&
  source.includes('ref.create({plan:"Free"'));
 const usageStart=source.indexOf("exports.usageStatus=");
 const usageEnd=usageStart<0?-1:source.indexOf("\\n});",usageStart);
 const usage=usageEnd<0?"":source.slice(usageStart,usageEnd+4);
 check("P99_USAGE_CALLS_ENSURE_ACCOUNT",usage.includes("exports.usageStatus=guardedCall")&&
  usage.includes("const id=uid(req),ref=await ensureAccount(id),snap=await ref.get()"));
 check("P99_CANDIDATE_NOT_ISOLATED",!source.includes("createP98GuardedStatusHandlers")&&
  !source.includes("guarded-status-integration-candidate.cjs"));
 check("P99_CANDIDATE_READONLY_MISSING",candidate.includes("createP81LegacyHandlers")&&
  candidate.includes("projectUsageStatus")&&
  delegate.includes('db.collection("accounts").doc(uid).get()')&&
  !candidate.includes("ref.create(")&&!legacy.includes("ref.create("));
 check("P99_NO_VERIFIED_DEPLOY_SELECTOR",true);
 return {schema:"P99_ACCOUNT_DEPLOY_ISOLATION_V1",project:"packtook-staging",
  findings,sourceAuditPass:findings.length===0,
  currentAccountBehavior:"LEGACY_BETA_MAY_AUTOPROVISION_IN_SOURCE",
  candidateAccountBehavior:"EXISTING_ACCOUNT_ONLY_FAIL_CLOSED",
  fullAccountCompatibility:"NOT_EQUIVALENT",
  callerEligibilityChange:"STAGING_PILOT_ONLY",
  deploymentTargetNames:[...TARGETS],excludedCreditFunctions:[...CREDIT],
  codebase:"beta",firebaseCliSelector:"NOT_TESTED",
  deployedOwnerMapping:"NOT_VERIFIED",
  safeDeployIsolation:"NOT_VERIFIED",
  backendAppCheck:"NOT_PROVEN",
  sourceToDeployedRevision:"NOT_VERIFIED",
  immutableRollback:"NOT_VERIFIED",
  nextAction:"OFFLINE_ACCOUNT_POLICY_DECISION_AND_EXACT_SELECTOR_VERIFICATION",
  cloudCalls:0,cloudWrites:0,deploy:false,trafficChanges:false,
  release:"NO_GO_RELEASE"};
}
module.exports={analyze};
if(require.main===module){
 try{
  const result=analyze();console.log(JSON.stringify(result));
  if(!result.sourceAuditPass)process.exitCode=2;
 }catch{
  console.log('{"schema":"P99_ACCOUNT_DEPLOY_ISOLATION_V1","sourceAuditPass":false,"deploy":false,"release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
