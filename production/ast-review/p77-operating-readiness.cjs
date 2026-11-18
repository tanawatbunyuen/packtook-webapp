"use strict";
/* P77 offline operational readiness classifier. No provider calls, no secrets.
 * Evidence in source control is a review template, never a signed attestation.
 */
const fs=require("node:fs");
const FIELDS=Object.freeze([
 "cloudBillingBudgetAlerts","cloudBillingSpendingCapPolicy",
 "functionsFailureRateAlerts","functionsLatencyAndAvailabilityAlerts",
 "firestoreQuotaAndErrorAlerts","omiseTestProviderReadProbe",
 "omisePaymentSettlementReconciliation","omiseWebhookSignatureVerification",
 "paymentRefundDisputeRunbook","creditLedgerReconciliation",
 "backupRestoreDryRun","immutableRollbackRevision",
 "incidentOwnerEscalation","incidentResponseDrill",
 "pdpaConsentAndPrivacyReview","dataRetentionAndDeletionPolicy",
 "videoPrivacyAccessReview","supportAndCustomerCommsRunbook"]);
const VALUES=["VERIFIED","NOT_VERIFIED","BLOCKED","NOT_APPLICABLE"];
function template(){
 return {schema:"P77_OPERATIONS_EVIDENCE_V1",project:"packtook-staging",
  evidence:Object.fromEntries(FIELDS.map(f=>[f,"NOT_VERIFIED"]))};
}
function classify(data){
 const invalid=()=>{
  return {schema:"P77_OPERATIONS_RESULT_V1",state:"EVIDENCE_INVALID",
   productionRelease:"NO_GO_RELEASE",controlledPilot:"BLOCKED",deployAllowed:false};
 };
 if(!data||typeof data!=="object"||Array.isArray(data)||
  data.schema!=="P77_OPERATIONS_EVIDENCE_V1"||data.project!=="packtook-staging"||
  !data.evidence||typeof data.evidence!=="object"||Array.isArray(data.evidence)||
  Object.keys(data.evidence).sort().join("|")!==FIELDS.slice().sort().join("|")||
  !FIELDS.every(f=>VALUES.includes(data.evidence[f])))return invalid();
 const outstanding=FIELDS.filter(f=>data.evidence[f]!=="VERIFIED");
 return {
  schema:"P77_OPERATIONS_RESULT_V1",
  state:outstanding.length?"REVIEW_REQUIRED":"EVIDENCE_COMPLETE_NOT_RELEASE_APPROVED",
  verifiedCount:FIELDS.length-outstanding.length,
  totalCount:FIELDS.length,
  outstandingCount:outstanding.length,outstanding,
  omiseLiveSettlement:"NOT_PROVEN",
  pdpaApproval:"NOT_PROVEN",
  independentSecurityReview:"NOT_PROVEN",
  stagingGuardDrift:"UNRESOLVED",
  controlledPilot:"BLOCKED",deployAllowed:false,
  productionRelease:"NO_GO_RELEASE"
 };
}
module.exports={FIELDS,template,classify};
if(require.main===module){
 try{
  const raw=fs.readFileSync(0,"utf8");
  if(raw.length>12000)throw Error("P77_EVIDENCE_TOO_LARGE");
  const out=classify(JSON.parse(raw));
  process.stdout.write(JSON.stringify(out)+"\n");
  if(out.state==="EVIDENCE_INVALID")process.exitCode=2;
 }catch{
  process.stdout.write(JSON.stringify(classify(null))+"\n");process.exitCode=2;
 }
}
