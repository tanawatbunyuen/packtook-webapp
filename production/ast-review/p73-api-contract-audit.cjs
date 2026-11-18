"use strict";
/* P73 static API contract boundary: validate source shapes, not deployed runtime.
 * Fail-closed on unrecognized export or missing legacy response keys.
 */
const fs=require("node:fs");
const KEYS=Object.freeze(["plan","limit","used","reserved","remaining",
 "walletEnabled","walletStartingCredits","period","openBillingRequestId",
 "canBuyMore","purchaseReason","planExpiresAt","subscriptionStatus"]);
const RECORDING=Object.freeze(["recordingId","status","barcode","period","file"]);
const TARGETS=Object.freeze({
 usageStatus:"p69UsageStatus",
 recordingStatus:"p69RecordingStatus",
 reserveCredit:"p70ReserveCredit",
 finalizeCredit:"p70FinalizeCredit",
 recoverStaleVideoReservation:"p70RecoverStaleVideoReservation"
});
function audit(prod,candidate,semantics,credits){
 if([prod,candidate,semantics,credits].some(v=>typeof v!=="string"||!v))throw Error("P73_BAD_SOURCE");
 const candidateNames=Object.values(TARGETS);
 const exactExports=candidateNames.every(n=>candidate.includes("exports."+n+"=protect("));
 const productionNames=Object.keys(TARGETS).every(n=>prod.includes("exports."+n+"=guardedCall("));
 const usageKeys=KEYS.every(k=>new RegExp("\\b"+k+":").test(semantics));
 const prodKeys=KEYS.every(k=>new RegExp("\\b"+k+":").test(prod));
 const recordingKeys=RECORDING.every(k=>new RegExp("\\b"+k+":").test(candidate));
 const configuredAppCheck=/enforceAppCheck:true/.test(candidate);
 const preProvisionOnly=!/ensureAccount\(/.test(candidate)&&!/\.create\(\{plan:"Free"/.test(candidate);
 const remainingDifferences=[
  "STAGING_ACCOUNT_PREPROVISION_POLICY",
  "BACKEND_APP_CHECK_NOT_PROVEN",
  "LIVE_STAGING_P63_GUARD_DRIFT",
  "END_TO_END_AUTHORIZED_CALL_NOT_PROVEN",
  "FULL_CREDIT_SEMANTIC_PARITY_NOT_PROVEN",
  "FRONTEND_CLIENT_FIELD_CONSUMPTION_NOT_INTEGRATION_TESTED",
  "PRODUCTION_SUBSCRIPTION_PAYMENT_LIFECYCLE_NOT_VERIFIED"
 ];
 return {
  schema:"P73_V1",
  staticExportNamesMatch:productionNames&&exactExports,
  usageFieldNamesMatch:usageKeys&&prodKeys,
  recordingFieldNamesPresent:recordingKeys,
  explicitAppCheckOption:configuredAppCheck,
  stagingPolicyPreprovisionOnly:preProvisionOnly,
  creditCallbacksPresent:["async function reserve(","async function finalize(","async function recover("].every(x=>credits.includes(x)),
  unresolved:remainingDifferences,
  fullSemanticParity:"REVIEW_REQUIRED",
  clientRuntimeCompatibility:"NOT_PROVEN",
  stagingDeploy:"BLOCKED",
  productionRelease:"NO_GO_RELEASE"
 };
}
if(require.main===module){
 try{
  if(process.argv.length!==6)throw Error("P73_ARGS");
  const v=audit(...process.argv.slice(2).map(x=>fs.readFileSync(x,"utf8")));
  console.log(JSON.stringify(v,null,2));
  if(!v.staticExportNamesMatch||!v.usageFieldNamesMatch||!v.recordingFieldNamesPresent||
    !v.explicitAppCheckOption||!v.stagingPolicyPreprovisionOnly||!v.creditCallbacksPresent)
    process.exitCode=2;
 }catch{
  console.log('{"schema":"P73_V1","fullSemanticParity":"NOT_VERIFIABLE","productionRelease":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
module.exports={audit,KEYS,RECORDING,TARGETS};
