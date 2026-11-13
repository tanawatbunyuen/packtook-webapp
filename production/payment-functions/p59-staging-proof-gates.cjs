'use strict';
// P59 proof gate: fail closed until REAL staging attestations are supplied by separate audited process.
// This code does not contact Firebase, Omise, the internet, or production.
const required=['appcheckRealAttestation','appcheckReplayRejected','browserE2E','omiseTestChargeRead',
 'omiseTestAmountMatched','omiseTestOwnershipMatched','omiseTestLivemodeFalse','providerTimeoutRejected'];
function assessStagingProofs(input){
 const evidence=input&&typeof input==='object'?input:{};
 const results=required.map(key=>{
  const item=evidence[key];
  const verified=!!item&&item.status==='VERIFIED'&&item.environment==='isolated-staging'
    &&typeof item.evidenceRef==='string'&&/^https:\/\/[^\s]+$/.test(item.evidenceRef)
    &&typeof item.reviewer==='string'&&item.reviewer.length>=3;
  return {gate:key,verified};
 });
 return Object.freeze({status:results.every(x=>x.verified)?'EVIDENCE_SUBMITTED_FOR_HUMAN_REVIEW':'HOLD',
   results,missing:results.filter(x=>!x.verified).map(x=>x.gate),releaseAuthorized:false});
}
module.exports={assessStagingProofs,required};
