// PACKTOOK V7.2 — read-only gate used immediately before a SECRET_ONLY change.
// No Secret/IAM/Cloud writes. Prints no account emails, tokens or raw gcloud output.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {auditWithRunner} from "./v72-secret-iam-audit.mjs";
import {readPublicSafetyEvidence,planV72SecretRemediation} from "./v72-secret-changeplan.mjs";

const PROJECT="packtook-prod-01";

export function assessSecretOnlyGate(plan){
 const reasons=[];
 if(plan?.project!==PROJECT)reasons.push("WRONG_PROJECT");
 if(plan?.phase!=="SECRET_CREATE_APPROVAL_REQUIRED")
  reasons.push("INCORRECT_CHANGE_PHASE");
 if(plan?.candidateForOwnerApprovedSecretProvision!==true)
  reasons.push("SECRET_PROVISION_NOT_A_CANDIDATE");
 if(plan?.observed?.secretResource!=="NOT_FOUND")
  reasons.push("SECRET_MUST_BE_CONFIRMED_ABSENT");
 if(plan?.publicProbe?.closed!==true||plan?.publicProbe?.explicitEnabledSeen===true)
  reasons.push("PUBLIC_STATUS_NOT_VERIFIED_CLOSED");
 if(plan?.observed?.pilotFunctionDeployed!==false)
  reasons.push("PILOT_FUNCTION_DEPLOYMENT_UNEXPECTED_OR_UNKNOWN");
 if(plan?.observed?.statusFunctionDeployed!==true)
  reasons.push("STATUS_FUNCTION_NOT_VERIFIED");
 if(!Array.isArray(plan?.errors)||plan.errors.length>0)
  reasons.push("CHANGEPLAN_BLOCKERS_PRESENT");
 if(plan?.decision!=="NO_GO_CONTROLLED_PILOT"||
    plan?.readyForPilot!==false||plan?.readyForPublic!==false)
  reasons.push("UNEXPECTED_RELEASE_STATE");
 if(plan?.productionChangesPerformed!==false||
    plan?.productionProvisioningAuthorized!==false||
    plan?.functionsDeploymentAuthorized!==false)
  reasons.push("CHANGEPLAN_MUST_REMAIN_READ_ONLY");
 return {pass:reasons.length===0,reasons,
  scope:"SECRET_ONLY_CANDIDATE",project:PROJECT,
  requiresInteractiveOwnerExecution:true,
  cloudMutationPerformed:false,
  iamChangeAuthorized:false,functionsDeployAuthorized:false,
  pilotGoAuthorized:false,readyForPilot:false};
}

const isMain=process.argv[1]&&
 path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("SAFETY BLOCK: exact project required");
  process.exitCode=2;
 }else{
  const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
  const [safety,audit]=await Promise.all([
   readPublicSafetyEvidence(),
   Promise.resolve().then(()=>auditWithRunner(source))
  ]);
  const plan=planV72SecretRemediation(audit,safety.remote,safety.diagnostic);
  const decision=assessSecretOnlyGate(plan);
  console.log(JSON.stringify({
   ...decision,
   phase:plan.phase,
   publicProbe:{closed:plan.publicProbe.closed,
    attempts:plan.publicProbe.attempts,
    reasons:plan.publicProbe.reasons,
    explicitEnabledSeen:plan.publicProbe.explicitEnabledSeen},
   observed:{secretResource:plan.observed.secretResource,
    statusFunctionDeployed:plan.observed.statusFunctionDeployed,
    pilotFunctionDeployed:plan.observed.pilotFunctionDeployed}
  },null,2));
  if(!decision.pass)process.exitCode=2;
 }
}
