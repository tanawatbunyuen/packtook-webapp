// PACKTOOK V7.2 — source-backed, read-only Secret/IAM change plan.
// Zero writes; Production provisioning, IAM grants and deployments are NEVER run.
// Usage: node scripts/v72-secret-changeplan.mjs packtook-prod-01
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {auditWithRunner} from "./v72-secret-iam-audit.mjs";
import {probe} from "./probe-free-deployment.mjs";
import {diagnosePublicServices,shouldRetryPublicProbe}
 from "./v72-live-surfaces-preflight.mjs";

const PROJECT="packtook-prod-01";
// A bounded read-only repeat is allowed for UNKNOWN/HTTP failures only.
// Never retry over an explicitly observed ON flag; never substitute old logs.
// Returned evidence includes only generic statuses/errors and zero credentials.
export async function readPublicSafetyEvidence(request=probe){
 const first=await request();
 const initial=diagnosePublicServices(first);
 const retry=shouldRetryPublicProbe(initial);
 const latest=retry?await request():first;
 const result=diagnosePublicServices(latest);
 return {remote:latest,
  diagnostic:{...result,attempts:retry?2:1,
   initialStatusHttp:initial.statusHttp,
   initialReasons:initial.reasons,
   initialSignupEnabled:initial.publicSignupEnabled,
   initialAccessEnabled:initial.publicAccessEnabled,
   explicitEnabledSeen:initial.publicSignupEnabled===true||
     initial.publicAccessEnabled===true||
     result.publicSignupEnabled===true||result.publicAccessEnabled===true}
 };
}

export function planV72SecretRemediation(audit,remote,remoteEvidence=null){
 const errors=[],steps=[];
 const secret=audit?.secret||{};
 const checks=audit?.checks||{};
 const publicProbe=diagnosePublicServices(remote);
 const explicitEnabledSeen=remoteEvidence?.explicitEnabledSeen===true||
  publicProbe.publicSignupEnabled===true||
  publicProbe.publicAccessEnabled===true;
 const publicClosed=publicProbe.closed&&!explicitEnabledSeen;
 const diagnostic=remoteEvidence?
  {...publicProbe,attempts:remoteEvidence.attempts,
   initialStatusHttp:remoteEvidence.initialStatusHttp,
   initialReasons:remoteEvidence.initialReasons,
   initialSignupEnabled:remoteEvidence.initialSignupEnabled,
   initialAccessEnabled:remoteEvidence.initialAccessEnabled,
   explicitEnabledSeen}:
  {...publicProbe,attempts:1,
   initialStatusHttp:publicProbe.statusHttp,
   initialReasons:publicProbe.reasons,
   initialSignupEnabled:publicProbe.publicSignupEnabled,
   initialAccessEnabled:publicProbe.publicAccessEnabled,
   explicitEnabledSeen};
 const sourceSafe=audit?.source?.pass===true;
 const secretAbsent=secret.resourcePresent===false&&
  secret.inspectionError==="NOT_FOUND";
 const secretPresent=secret.resourcePresent===true;
 const versionReady=secretPresent&&secret.enabledVersionCount>0;
 const functions=audit?.cloudFunctions||[];
 const liveStatus=functions.find(x=>x.name==="publicSignupStatus");
 const publicSignup=functions.find(x=>x.name==="completeFreeSignup");
 const pilotStatus=functions.find(x=>x.name==="pilotInvitationStatus");
 const pilotSignup=functions.find(x=>x.name==="completePilotFreeSignup");
 const otherPilotLive=pilotStatus?.deployed===true||pilotSignup?.deployed===true;
 if(!publicClosed){
  errors.push("PUBLIC_FLAGS_OR_HOSTING_NOT_CONFIRMED_CLOSED");
  errors.push(...publicProbe.reasons);
  if(explicitEnabledSeen&&!publicProbe.reasons.some(x=>x.includes("_ENABLED_UNEXPECTEDLY")))
   errors.push("PUBLIC_ENABLED_ON_INITIAL_OBSERVATION");
 }
 if(!sourceSafe)errors.push("SOURCE_SECRET_BINDING_UNVERIFIED");
 if(otherPilotLive)errors.push("UNEXPECTED_PILOT_FUNCTION_DEPLOYMENT");
 if(liveStatus?.deployed!==true)errors.push("PUBLIC_STATUS_FUNCTION_NOT_VERIFIED");
 if(!secretAbsent&&!secretPresent)errors.push("SECRET_EXISTENCE_UNKNOWN_DO_NOT_CREATE");
 const proposeSecretCreate=secretAbsent&&publicClosed&&sourceSafe&&
  liveStatus?.deployed===true&&!otherPilotLive;
 let phase="HALT_INSPECTION_REQUIRED";
 if(errors.length===0){
  if(secretAbsent)phase="SECRET_CREATE_APPROVAL_REQUIRED";
  else if(!versionReady)phase="SECRET_VERSION_SECURITY_REVIEW_REQUIRED";
  else if(!checks.secretIAMPolicyReadable)phase="SECRET_IAM_INSPECTION_REQUIRED";
  else if(checks.secretPolicyBroadGrant===true||checks.projectPolicyBroadGrant===true)
   phase="OVERBROAD_IAM_REVIEW_REQUIRED";
  else if(!checks.runtimeAccountsIdentified||!checks.deployedPublicStatus)
   phase="RUNTIME_IDENTITY_REVIEW_REQUIRED";
  else phase="SCOPED_IAM_AND_FUNCTION_REVISION_REVIEW_REQUIRED";
 }
 steps.push({
  id:"S1",phase:"SECRET_CREATION",
  disposition:proposeSecretCreate?
   "CANDIDATE_ONLY_OWNER_CHANGE_APPROVAL_REQUIRED":
   secretPresent?"DO_NOT_CREATE_EXISTING_SECRET":
   "BLOCKED_UNKNOWN_OR_UNSAFE",
  constraints:"Exactly one named Production HMAC secret; 32 random bytes as 64 hex characters; secure nonpersistent transfer; never copy payload to CLI args or logs; never overwrite/rotate existing secret"
 });
 steps.push({
  id:"S2",phase:"LEAST_PRIVILEGE_IAM",
  disposition:versionReady?"REVIEW_RUNTIME_IDENTITY_AND_SECRET_SCOPED_ACCESS":
   "WAIT_FOR_APPROVED_SECRET_AND_ENABLED_VERSION",
  constraints:"Identify each target Function serviceAccountEmail privately; secret-scoped roles/secretmanager.secretAccessor only; no project-wide IAM; no guessed default accounts or automatic grants"
 });
 steps.push({
  id:"S3",phase:"FUNCTION_REVISION",
  disposition:"SEPARATE_CHANGE_APPROVAL_AND_ROLLBACK_REQUIRED",
  constraints:"Do not deploy existing publicSignupStatus or new completeFreeSignup / Pilot callables as part of secret creation; independently review exact source SHA, Beta smoke, status HTTP and rollback"
 });
 steps.push({
  id:"S4",phase:"PILOT_GO_NO_GO",
  disposition:"BLOCKED",
  constraints:"Requires real App Check client+server, effective runtime IAM, Monitoring/Billing notifications, PDPA, email safeguards, tested revocation and explicit owner signoff"
 });
 return {
  version:"7.2",project:PROJECT,mode:"READ_ONLY_NO_WRITES",
  phase,
  publicProbe:diagnostic,
  observed:{
   sourceBindingVerified:sourceSafe,publicAndWebClosed:publicClosed,
   secretResource:secretAbsent?"NOT_FOUND":secretPresent?"FOUND":"UNKNOWN",
   enabledVersionVerified:versionReady,
   statusFunctionDeployed:liveStatus?.deployed===true,
   statusSecretBound:liveStatus?.secretBound===true,
   publicSignupFunctionDeployed:publicSignup?.deployed===true,
   pilotFunctionDeployed:otherPilotLive,
   secretIAMPolicyReadable:checks.secretIAMPolicyReadable===true,
   runtimeServiceAccountIdentified:checks.runtimeAccountsIdentified===true,
   secretLevelIAMGrantProven:checks.secretIAMPolicyReadable===true&&
    audit?.iam?.runtimeBindings?.length>0&&
    audit.iam.runtimeBindings.every(x=>x.directSecretAccessor===true),
   effectiveRuntimeAccessVerified:false
  },
  candidateForOwnerApprovedSecretProvision:proposeSecretCreate,
  productionChangesPerformed:false,
  productionProvisioningAuthorized:false,
  functionsDeploymentAuthorized:false,
  ownerPilotSignoff:false,
  readyForPilot:false,readyForPublic:false,
  decision:"NO_GO_CONTROLLED_PILOT",errors,steps,
  note:"This plan does not create a secret, assign IAM, deploy functions, read payload, or authorize Pilot. Cloud metadata alone does not prove runtime Secret access."
 };
}
const isMain=process.argv[1]&&
 path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("SAFETY BLOCK: expected exact packtook-prod-01; no other args accepted");
  process.exitCode=2;
 }else{
  const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
  const [publicEvidence,audit]=await Promise.all([readPublicSafetyEvidence(),Promise.resolve().then(()=>auditWithRunner(source))]);
  const report=planV72SecretRemediation(audit,publicEvidence.remote,publicEvidence.diagnostic);
  // The output is sanitized by the underlying audit; no principals or secrets are printed.
  console.log(JSON.stringify(report,null,2));
  console.log("RESULT: PACKTOOK V7.2 SECRET REMEDIATION PLAN — NO DEPLOY / NO CLOUD WRITES / NO-GO");
  if(report.errors.length||!report.candidateForOwnerApprovedSecretProvision&&
     report.phase==="HALT_INSPECTION_REQUIRED")process.exitCode=2;
 }
}
