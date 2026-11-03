// PACKTOOK V7.1 — OFFLINE source-only operations readiness report.
// NEVER reads .env, actual Secret Manager values, Billing API or Production logs.
// Does not create/modify metrics, budgets, secrets, accounts or public flags.
// Run: node scripts/v71-ops-readiness.mjs packtook-prod-01
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const PROJECT="packtook-prod-01";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
export function assessOperations(backend){
 const requiredBinding='secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]';
 const contains=fragment=>backend.includes(fragment);
 const checks={
  secretDefined:contains('defineSecret("PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX")'),
  secretBoundToSignup:contains('exports.completeFreeSignup=onCall({...options,enforceAppCheck:true,'+requiredBinding),
  secretBoundToStatus:contains('exports.publicSignupStatus=onCall({...options,'+requiredBinding),
  runtimeSecretRead:contains("PUBLIC_FREE_EMAIL_HMAC_SECRET.value()"),
  noDirectEnvSecretRead:!contains("process.env.PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX"),
  noRawSecretLogging:!/(?:console|logger)\.(?:log|info|warn|error)\s*\([^)]*(?:publicFreeHmacKey\(|PUBLIC_FREE_EMAIL_HMAC_SECRET|live\.email|req\.auth\.uid)/.test(backend),
  aggregateAuditEvents:contains('logger.info("PACKTOOK_PUBLIC_FREE_AUDIT"')&&
   ["new_free","duplicate_email","capacity_exhausted"].every(contains),
  signupDefaultsFailClosed:contains('function publicAbuseReady()')&&
   contains('function publicSignupReady()')&&
   contains('if(!publicSignupReady())')
 };
 const sourcePass=Object.values(checks).every(Boolean);
 return {
  version:"7.1",project:PROJECT,mode:"SOURCE_ONLY / NO CLOUD ACTIONS",
  sourcePass,checks,
  production:{
   secretExistenceVerified:false,
   functionServiceAccountSecretAccessVerified:false,
   billingBudgetConfiguredVerified:false,
   cloudMonitoringMetricsConfiguredVerified:false,
   incidentOwnerVerified:false
  },
  readyForPublic:false,
  decision:"NO_GO_PUBLIC",
  remaining:["OWNER_APPROVED_SECRET_PROVISIONING",
   "EXACT_FUNCTION_SECRET_IAM_AND_DEPLOY_REVIEW",
   "CLOUD_BILLING_BUDGET_AND_ALERT_EVIDENCE",
   "CLOUD_MONITORING_FILTER_AND_ALERT_EVIDENCE",
   "FIREBASE_AUTH_VERIFICATION_EMAIL_ABUSE_CONTROLS",
   "PDPA_LEGAL_RETENTION_REVIEW",
   "REAL_BROWSER_APPCHECK_PUBLIC_PILOT",
   "OWNER_GO_NO_GO_APPROVAL"],
  note:"Source-only cannot verify Cloud Secret Manager, real costs, Logging, Firebase Auth or legal sign-off. No Production mutations."
 };
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  if(process.argv.length!==3||process.argv[2]!==PROJECT)
   throw Error("Usage: node scripts/v71-ops-readiness.mjs packtook-prod-01");
  const backend=fs.readFileSync(path.join(ROOT,"functions","index.js"),"utf8");
  const report=assessOperations(backend);
  console.log(JSON.stringify(report,null,2));
  if(!report.sourcePass)process.exitCode=2;
 }catch(e){console.error(e.message);process.exitCode=2}
}
