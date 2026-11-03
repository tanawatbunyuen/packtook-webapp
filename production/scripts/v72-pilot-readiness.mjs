// PACKTOOK V7.2 — strictly READ-ONLY preparation for a CLOSED, invite-only pilot.
// NO Firebase deploy, cloud writes, Auth/Secret/Billing mutations or public flags.
// Usage: node scripts/v72-pilot-readiness.mjs packtook-prod-01 [--remote]
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {collectLocalSource,inspectSource} from "./public-launch-preflight.mjs";
import {loadLocalQa,loadCustomerAppEvidence,evaluateV71} from "./v71-public-readiness.mjs";
import {assessOperations} from "./v71-ops-readiness.mjs";
import {probe} from "./probe-free-deployment.mjs";
import {inspectPilotSource} from "./v72-pilot-source-check.mjs";

const PROJECT="packtook-prod-01";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MANIFEST=path.join(ROOT,"ops","v72-pilot-manifest.json");
const EXPECTED_FLAGS=[
 "publicSignupEnabled","publicAccessEnabled","publicPoliciesApproved",
 "v70QaEnabled","omiseLiveEnabled","pilotFlagsEnabled"
];
const REQUIRED_EVIDENCE=[
 "pilotServerAllowlistImplemented",
 "realSecretManagerProvisioningAndIAM",
 "authCreationAndVerificationEmailAbuseControls",
 "cloudLoggingMetricsAndNotifications",
 "billingBudgetAndNotificationChannel",
 "pdpaTermsPrivacyAndPilotConsent",
 "realBrowserAppCheckAndPilotE2E",
 "releaseSpecificRollbackAndRevocationDrill",
 "ownerPilotSignoff"
];
export function assessV72({manifest,baseline,operations,backend=""}){
 const blockers=[];
 const add=r=>{if(!blockers.includes(r))blockers.push(r)};
 if(!manifest||manifest.schemaVersion!=="7.2.0"||manifest.project!==PROJECT||
   manifest.mode!=="PREPARATION_ONLY"||manifest.productionDeployAuthorized!==false||
   manifest.readyForPilot!==false||manifest.readyForPublic!==false)
  add("INVALID_OR_UNSAFE_PILOT_MANIFEST");
 const plan=manifest?.pilotPlan||{};
 const cohortSafe=Number.isSafeInteger(plan.maxInvitedUsers)&&
   plan.maxInvitedUsers>=1&&plan.maxInvitedUsers<=5&&
   Number.isSafeInteger(plan.maxWindowHours)&&
   plan.maxWindowHours>=1&&plan.maxWindowHours<=4&&
   plan.admissionMode==="SERVER_SIDE_UID_ALLOWLIST_SOURCE_ONLY_DEMO_PENDING"&&
   plan.invitedUsersStoredInGit===false&&
   plan.customerAppCheckRequired===true&&
   plan.requireVerifiedFirebaseAuthEmail===true&&
   plan.requireConsentEvidence===true&&
   plan.allowPublicAuthCreation===false&&
   plan.preCreatedInvitedAuthUsersPreferred===true&&
   plan.genericSignupCTAVisible===false;
 if(!cohortSafe)add("UNSAFE_PILOT_COHORT_OR_DISCOVERY_CONFIGURATION");
 const proposedFlagsSafe=EXPECTED_FLAGS.every(k=>plan[k]===false);
 if(!proposedFlagsSafe)add("PUBLIC_QA_PILOT_OR_BILLING_FLAG_REQUESTED");
 const existingSourceSafe=baseline?.source?.criticalPass===true&&
  baseline?.source?.antiAbuseSourcePass===true&&
  baseline?.source?.secretBindingSourcePass===true&&
  operations?.sourcePass===true;
 if(!existingSourceSafe)add("V71_SOURCE_AND_SECRET_SAFETY_NOT_PROVEN");
 const localClosed=baseline?.local?.qaOff===true&&
  baseline?.local?.publicFlagsOff===true&&
  baseline?.customerAppId?.exactMatch===true;
 if(!localClosed)add("LOCAL_QA_PUBLIC_FLAGS_OR_CUSTOMER_APP_ID_UNSAFE");
 const remoteChecked=baseline?.remote?.statusChecked===true;
 const remoteClosed=remoteChecked&&baseline?.remote?.httpPass===true&&
  baseline?.remote?.publicSignupEnabled===false&&
  baseline?.remote?.publicAccessEnabled===false;
 if(!remoteChecked)add("REMOTE_PRELAUNCH_STATUS_NOT_CHECKED");
 else if(!remoteClosed)add("REMOTE_PUBLIC_NOT_CLOSED_OR_UNREACHABLE");

 // This is intentionally a *negative architecture check*, NOT proof that an
 // authorization system works: a guarded public pilot cannot reuse either
 // V7.1 generic Public signup or the V7.0 single-UID QA gate.
 const pilotSource=inspectPilotSource(backend);
 add("PILOT_SERVER_SIDE_COHORT_GUARD_NOT_RUNTIME_VERIFIED");
 if(!pilotSource.sourcePass)add("PILOT_SOURCE_SECURITY_CONTRACT_INCOMPLETE");
 // Manually editable evidence cannot authorize a pilot, even if someone
 // writes "PASS" here. Proof must come from independently reviewed artifacts.
 const evidence=manifest?.evidence||{};
 for(const key of REQUIRED_EVIDENCE)
  if(typeof evidence[key]!=="string"||!evidence[key])
   add("EVIDENCE_RECORD_INCOMPLETE");
 add("IDENTITY_AND_EMAIL_SPAM_MITIGATION_OWNER_REVIEW_REQUIRED");
 add("SECRET_MANAGER_RUNTIME_IAM_AND_ROTATION_REVIEW_REQUIRED");
 add("CLOUD_BILLING_ALERTS_AND_NOTIFICATION_CHANNEL_NOT_PROVEN");
 add("LEGAL_PDPA_PILOT_CONSENT_AND_RETENTION_NOT_APPROVED");
 add("REAL_BROWSER_APPCHECK_AND_INVITED_UNINVITED_TEST_NOT_PROVEN");
 add("PILOT_ROLLBACK_REVOCATION_AND_BETA_SMOKE_NOT_PROVEN");
 add("OWNER_GO_NO_GO_SIGNOFF_REQUIRED");
 const safetyPass=cohortSafe&&proposedFlagsSafe&&existingSourceSafe&&pilotSource.sourcePass&&localClosed&&
  remoteClosed&&blockers.every(b=>!b.startsWith("INVALID_OR_UNSAFE"));
 return {
  version:"7.2",project:PROJECT,scope:"READ-ONLY / CLOSED-PILOT PREPARATION / NO DEPLOY / OMISE LIVE OFF",
  sourceBaseline:{pilotBackendSourcePass:pilotSource.sourcePass,
   pilotProtectedCallablesChecked:pilotSource.assessedProtectedCallableCount,
   criticalPass:baseline?.source?.criticalPass===true,
   antiAbuseSourcePass:baseline?.source?.antiAbuseSourcePass===true,
   secretBindingSourcePass:baseline?.source?.secretBindingSourcePass===true,
   opsSourcePass:operations?.sourcePass===true},
  local:{qaOff:baseline?.local?.qaOff===true,
   publicFlagsOff:baseline?.local?.publicFlagsOff===true,
   exactCustomerAppId:baseline?.customerAppId?.exactMatch===true},
  remote:{statusChecked:remoteChecked,publicClosed:remoteClosed},
  proposedPilot:{maxInvitedUsers:plan.maxInvitedUsers??null,
   maxWindowHours:plan.maxWindowHours??null,serverAllowlistImplemented:false,
   pilotBackendSourcePresent:pilotSource.sourcePass,
   publicSignupWillRemainOff:plan.publicSignupEnabled===false,
   genericSignupCtaWillRemainHidden:plan.genericSignupCTAVisible===false},
  evidenceStatus:"OPERATOR_LOG_BASELINE_ONLY_NOT_PILOT_APPROVAL",
  preparationSafetyPass:safetyPass,
  readyForPilot:false,readyForPublic:false,decision:"NO_GO_CONTROLLED_PILOT",
  blockers,note:"V7.1 DEMO pass does not verify V7.2 pilot admission, Cloud billing, real App Check, policies or a deploy. No changes made."
 };
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  const args=process.argv.slice(2);
  if(args.length<1||args.length>2||args[0]!==PROJECT||
    (args[1]&&args[1]!=="--remote"))
   throw Error("Usage: node scripts/v72-pilot-readiness.mjs packtook-prod-01 [--remote]");
  const manifest=JSON.parse(fs.readFileSync(MANIFEST,"utf8"));
  const localSource=collectLocalSource();
  const source={...inspectSource(localSource),backend:localSource.backend};
  const remote=args.includes("--remote")?await probe():null;
  const baseline=evaluateV71({
   localQa:loadLocalQa(),appEvidence:loadCustomerAppEvidence(),source,remote});
  const operations=assessOperations(localSource.backend);
  const report=assessV72({manifest,baseline,operations,backend:localSource.backend});
  console.log(JSON.stringify(report,null,2));
  console.log("RESULT: V7.2 CONTROLLED PILOT READINESS NO-GO (preparation only; no writes)");
  if(!report.preparationSafetyPass&&args.includes("--remote"))process.exitCode=2;
  if(!report.sourceBaseline.criticalPass||!report.sourceBaseline.opsSourcePass)
   process.exitCode=2;
 }catch(e){console.error("V7.2 READ-ONLY PRECHECK FAILED:",e.message);process.exitCode=2}
}
