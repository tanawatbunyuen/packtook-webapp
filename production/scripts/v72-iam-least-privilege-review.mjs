// PACKTOOK V7.2 — Secret-level IAM Least Privilege readiness, READ-ONLY.
// No IAM mutation, no Secret value access, no function deployment.
// Usage: node scripts/v72-iam-least-privilege-review.mjs packtook-prod-01
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {auditWithRunner} from "./v72-secret-iam-audit.mjs";
import {readPublicSafetyEvidence} from "./v72-secret-changeplan.mjs";

const PROJECT="packtook-prod-01";
const SECRET="PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX";
export function assessV72IamReview({audit,source,remoteEvidence}){
 const publicProbe=remoteEvidence?.diagnostic||{};
 const c=audit?.checks||{};
 const iam=audit?.iam||{};
 const secret=audit?.secret||{};
 const actual=audit?.cloudFunctions||[];
 const get=name=>actual.find(f=>f.name===name)||{};
 const status=get("publicSignupStatus");
 const publicSignup=get("completeFreeSignup");
 const pilotStatus=get("pilotInvitationStatus");
 const pilotSignup=get("completePilotFreeSignup");
 const match=source.match(/const options\s*=\s*\{([^}]+)\}/);
 const runtimeServiceAccountPinned=!!match&&/\bserviceAccount\s*:/.test(match[1]);
 const statusDeployedWithIdentity=status.deployed===true&&status.runtimeServiceAccountKnown===true;
 const unknownFunctionMetadata=[publicSignup,pilotStatus,pilotSignup].some(f=>
  f.metadataReadable!==true&&f.inspectionError!=="NOT_FOUND");
 const publicSafe=publicProbe.closed===true&&publicProbe.explicitEnabledSeen===false;
 const secretSafe=secret.resourcePresent===true&&secret.versionsInspected===true&&
  secret.enabledVersionCount>0&&iam.secretPolicyReadable===true&&
  iam.projectPolicyReadable===true;
 const noUnexpectedPilot=pilotStatus.deployed!==true&&pilotSignup.deployed!==true;
 const noBroadGrant=c.secretPolicyBroadGrant===false&&c.projectPolicyBroadGrant===false;
 const statuses={
  sourceBindingVerified:audit?.source?.pass===true,
  publicStatusObservedClosed:publicSafe,
  secretResourceExists:secret.resourcePresent===true,
  enabledVersionPresent:secret.enabledVersionCount>0,
  secretAndProjectPolicyReadable:iam.secretPolicyReadable===true&&iam.projectPolicyReadable===true,
  noPublicPrincipalSecretGrantDetected:noBroadGrant,
  statusRuntimeAccountKnown:statusDeployedWithIdentity,
  statusCurrentRevisionSecretBound:status.secretBound===true,
  publicSignupFunctionDeployed:publicSignup.deployed===true,
  pilotStatusDeployed:pilotStatus.deployed===true,
  pilotSignupDeployed:pilotSignup.deployed===true,
  futureFunctionRuntimeServiceAccountPinnedInSource:runtimeServiceAccountPinned,
  futureRuntimeIdentityVerified:false,
  effectiveRuntimeSecretAccessVerified:false
 };
 const blockers=[];
 if(!statuses.sourceBindingVerified)blockers.push("SECRET_PARAM_SOURCE_BINDING_UNVERIFIED");
 if(!publicSafe)blockers.push("PUBLIC_CLOSED_STATUS_NOT_FRESHLY_VERIFIED");
 if(!secretSafe)blockers.push("SECRET_VERSION_OR_IAM_METADATA_INCOMPLETE");
 if(!noBroadGrant)blockers.push("BROAD_OR_UNKNOWN_SECRET_IAM_POLICY");
 if(!statusDeployedWithIdentity)blockers.push("DEPLOYED_STATUS_RUNTIME_IDENTITY_UNVERIFIED");
 if(status.secretBound!==true)blockers.push("CURRENT_STATUS_REVISION_HAS_NO_SECRET_BINDING");
 if(unknownFunctionMetadata)blockers.push("OTHER_FUNCTION_METADATA_UNVERIFIED");
 if(!noUnexpectedPilot)blockers.push("UNEXPECTED_PILOT_DEPLOYMENT");
 if(!runtimeServiceAccountPinned)
  blockers.push("FUTURE_RUNTIME_SERVICE_ACCOUNT_NOT_PINNED_IN_SOURCE");
 blockers.push("FUTURE_FUNCTION_REVISION_AND_RUNTIME_IDENTITY_REVIEW_REQUIRED");
 blockers.push("EXACT_SECRET_SCOPED_IAM_GRANT_OWNER_APPROVAL_REQUIRED");
 blockers.push("EFFECTIVE_RUNTIME_SECRET_ACCESS_NOT_PROVEN");
 blockers.push("APP_CHECK_MONITORING_BILLING_PDPA_AND_PILOT_OWNER_GO_REQUIRED");
 const reviewCandidate=source.includes('defineSecret("'+SECRET+'")')&&
  statuses.sourceBindingVerified&&publicSafe&&secretSafe&&noBroadGrant&&
  statusDeployedWithIdentity&&!unknownFunctionMetadata&&noUnexpectedPilot;
 return {
  version:"7.2",project:PROJECT,secretName:SECRET,
  mode:"READ_ONLY_SECRET_SCOPED_IAM_PLAN",
  phase:reviewCandidate?"SCOPED_IAM_REVIEW_CANDIDATE_NOT_AUTHORIZED":
   "IAM_REVIEW_BLOCKED_NEEDS_INVESTIGATION",
  statuses,
  publicProbe:{closed:publicProbe.closed===true,attempts:publicProbe.attempts??null,
   reasons:Array.isArray(publicProbe.reasons)?publicProbe.reasons:[],
   explicitEnabledSeen:publicProbe.explicitEnabledSeen===true},
  identities:{deployedFunctionPrincipalsListed:false,
   currentDeployedStatusAccountVerified:statusDeployedWithIdentity,
   futureFunctionsAccountVerified:false,
   rawMemberValuesPrinted:false},
  reviewCandidate,
  canGrantIAMNow:false,iamChangeAuthorized:false,
  deployedFunctionChangesAuthorized:false,
  performedIAMWrites:false,readSecretPayload:false,
  readyForPilot:false,readyForPublic:false,
  decision:"NO_GO_CONTROLLED_PILOT",blockers,
  nextAction:"Privately compare exact intended per-Function revision serviceAccountEmail with current deployed status account; record immutable revision and rollback scope. Request separate owner approval for one secret-scoped grant only after runtime identity verified.",
  note:"Current deployed publicSignupStatus account does NOT establish the future Public/Pilot revision runtime identities. Never grant to a guessed default or the entire project. Metadata cannot prove effective secret access."
 };
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("SAFETY BLOCK: only exact Production project accepted");
  process.exitCode=2;
 }else{
  const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
  const [remoteEvidence,audit]=await Promise.all([
   readPublicSafetyEvidence(),Promise.resolve().then(()=>auditWithRunner(source))
  ]);
  const report=assessV72IamReview({audit,source,remoteEvidence});
  console.log(JSON.stringify(report,null,2));
  console.log("RESULT: V7.2 SECRET-SCOPED IAM READ-ONLY REVIEW — NO IAM WRITES / NO-GO");
  if(!report.reviewCandidate)process.exitCode=2;
 }
}
