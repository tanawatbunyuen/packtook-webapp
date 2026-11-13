'use strict';
const {dryRunPilot}=require('./p61-pilot-dryrun.cjs');
// P62: evidence-only, never starts automation or deployment.
function evaluateReadiness({proofs,approvals,limits,observations}={}){
 const pilot=dryRunPilot({proofs,approvals,limits});
 const obs=observations&&typeof observations==='object'?observations:{};
 const metricsValid=Number.isSafeInteger(obs.testCases)&&obs.testCases>0
  &&Number.isSafeInteger(obs.unreconciled)&&obs.unreconciled===0
  &&Number.isSafeInteger(obs.duplicateEntitlements)&&obs.duplicateEntitlements===0
  &&obs.rollbackExercise==='VERIFIED'&&obs.alertingExercise==='VERIFIED'
  &&obs.incidentRunbookReviewed===true;
 const reasons=[...pilot.gaps];
 if(!metricsValid)reasons.push('P62:real_pilot_observation_and_rollback_evidence_missing');
 return Object.freeze({decision:'NO_GO',stage:'RELEASE_DECISION_DRAFT_ONLY',
  reasons,metricsValid,requiresHumanApproval:true,
  publicSignupClosed:true,productionChanges:0,releaseAuthorized:false});
}
module.exports={evaluateReadiness};
