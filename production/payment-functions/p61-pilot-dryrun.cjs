'use strict';
const {assessStagingProofs}=require('./p59-staging-proof-gates.cjs');
const {assessApprovals}=require('./p60-independent-approval-gates.cjs');
// Dry-run evaluator only: never contains deployment, endpoint or payment actions.
function dryRunPilot({proofs,approvals,limits}={}){
 const staging=assessStagingProofs(proofs),review=assessApprovals(approvals);
 const safeLimits=!!limits&&Number.isSafeInteger(limits.maxTestAccounts)
   &&limits.maxTestAccounts>0&&limits.maxTestAccounts<=5
   &&limits.publicSignupClosed===true&&limits.refundExecutorDisabled===true
   &&limits.entitlementExecutorDisabled===true&&limits.rollbackDocumented===true;
 const gaps=[...staging.missing.map(x=>'P59:'+x),
   ...review.missing.map(x=>'P60:'+x)];
 if(!safeLimits)gaps.push('P61:pilot_boundaries');
 if(staging.status!=='EVIDENCE_SUBMITTED_FOR_HUMAN_REVIEW')gaps.push('P61:real_staging_not_verified');
 if(review.status!=='AWAIT_EXTERNAL_VERIFICATION')gaps.push('P61:signoffs_not_verified');
 gaps.push('P61:external_owner_release_authorization_required');
 return Object.freeze({simulation:'ONLY',decision:'NO_GO',gaps:[...new Set(gaps)],
  releaseAuthorized:false,commandsExecuted:0,productionWrites:0});
}
module.exports={dryRunPilot};
