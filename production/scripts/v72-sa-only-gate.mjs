// PACKTOOK V7.2 — exact-account SA_ONLY proposal gate; READ ONLY.
// Does not create accounts or keys, modify IAM, deploy, or change Public flags.
// Usage: node scripts/v72-sa-only-gate.mjs packtook-prod-01
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {auditWithRunner} from "./v72-secret-iam-audit.mjs";
import {readPublicSafetyEvidence} from "./v72-secret-changeplan.mjs";
import {PROJECT,ACCOUNT,readServiceAccountMetadata,
 assessDedicatedSaPreflight} from "./v72-dedicated-sa-preflight.mjs";

const describe=["iam","service-accounts","describe",ACCOUNT,
 "--project="+PROJECT,"--format=json"];

export function assessSaOnlyGate(report){
 const reasons=[];
 if(report?.project!==PROJECT)reasons.push("WRONG_PROJECT");
 if(report?.phase!=="DEDICATED_SA_CREATION_APPROVAL_REQUIRED")
  reasons.push("NOT_IN_SA_CREATION_APPROVAL_PHASE");
 if(report?.candidateForSeparateSAOnlyApproval!==true)
  reasons.push("SERVICE_ACCOUNT_CREATION_NOT_A_CANDIDATE");
 if(report?.account?.resourcePresent!==false||
    report?.account?.inspectionError!=="NOT_FOUND")
  reasons.push("EXACT_SERVICE_ACCOUNT_ABSENCE_NOT_VERIFIED");
 if(report?.publicProbe?.closed!==true||
    report?.publicProbe?.explicitEnabledSeen!==false||
    report?.publicProbe?.marketingHttp!==200||
    report?.publicProbe?.customerHttp!==200||
    report?.publicProbe?.statusHttp!==200||
    report?.publicProbe?.publicSignupEnabled!==false||
    report?.publicProbe?.publicAccessEnabled!==false)
  reasons.push("PUBLIC_FLAGS_OR_HOSTING_NOT_VERIFIED_OFF");
 if(report?.source?.fourFunctionBindingVerified!==true||
    report?.source?.betaSharedOptionsUnchanged!==true)
  reasons.push("DEDICATED_RUNTIME_SOURCE_ISOLATION_UNVERIFIED");
 if(report?.secret?.resourcePresent!==true||
    report?.secret?.hasEnabledVersion!==true)
  reasons.push("HMAC_SECRET_NOT_READY");
 if(!Array.isArray(report?.errors)||report.errors.length>0)
  reasons.push("SOURCE_PREFLIGHT_ERRORS_PRESENT");
 if(report?.decision!=="NO_GO_CONTROLLED_PILOT"||
    report?.readyForPilot!==false||report?.readyForPublic!==false)
  reasons.push("RELEASE_STATE_NOT_NO_GO");
 if(report?.accountCreationAuthorized!==false||
    report?.accountCreationPerformed!==false||
    report?.secretIamGrantAuthorized!==false||
    report?.functionsDeployAuthorized!==false)
  reasons.push("SOURCE_GATE_MUST_NOT_AUTHORIZE_WRITES");
 return {
  project:PROJECT,scope:"DEDICATED_SA_ONLY",
  pass:reasons.length===0,reasons,
  proposedAccountId:"packtook-public-pilot-v72",
  readOnly:true,accountCreated:false,
  operatorOwnerApprovalRequired:true,
  iamGrantsAuthorized:false,functionDeploymentAuthorized:false,
  publicAccessAuthorized:false,pilotAuthorized:false,
  decision:"NO_GO_CONTROLLED_PILOT"
 };
}
const isMain=process.argv[1]&&
 path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("SAFETY BLOCK: exact project required");
  process.exitCode=2;
 }else{
  const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
  // Finish the live HTTP probe before running synchronous gcloud commands.
  // execFileSync blocks the event loop and can starve concurrent fetch timers.
  // Keep fresh, fail-closed evidence; no cached probe or safety bypass.
  const publicEvidence=await readPublicSafetyEvidence();
  const audit=auditWithRunner(source);
  const serviceAccount=readServiceAccountMetadata("gcloud",describe);
  const plan=assessDedicatedSaPreflight({source,audit,publicEvidence,serviceAccount});
  const gate=assessSaOnlyGate(plan);
  console.log(JSON.stringify({...gate,
   sourcePreflightPhase:plan.phase,
   sourcePreflightErrors:plan.errors,
   secretReady:plan.secret.resourcePresent&&plan.secret.hasEnabledVersion,
   publicClosed:plan.publicProbe.closed,
   publicProbe:plan.publicProbe,
   accountResourcePresent:plan.account.resourcePresent,
   accountInspectionError:plan.account.inspectionError},null,2));
  if(!gate.pass)process.exitCode=2;
 }
}
