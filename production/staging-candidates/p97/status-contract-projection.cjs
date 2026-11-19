"use strict";
/* P97 candidate-only status response projection for existing account data.
 * NOT registered with Firebase. No account writes/provisioning or Cloud reads.
 * Unverified deployed-source equivalence remains a release blocker.
 */
const LIMITS=Object.freeze({Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null});
function projectUsageStatus(a,{now=Date.now(),HttpsError=Error}={}){
 if(!a||typeof a!=="object")throw new HttpsError("failed-precondition","Account not provisioned");
 const limit=LIMITS[a.plan];
 if(limit===undefined)throw new HttpsError("failed-precondition","Invalid plan");
 const period=new Date(now).toISOString().slice(0,7);
 const walletEnabled=a.creditWalletV1===true;
 const validCounter=name=>{
  const v=a[name]===undefined?0:a[name];
  if(!Number.isSafeInteger(v)||v<0)throw new HttpsError("failed-precondition","Credit counters need review");
  return v;
 };
 const reserved=walletEnabled||a.period===period?validCounter("reserved"):(
   validCounter("reserved"),0);
 const used=a.period===period?a.used||0:0;
 let remaining=null;
 if(limit!==null){
  if(walletEnabled){
   if(!Number.isSafeInteger(a.creditWalletRemaining)||a.creditWalletRemaining<0)
    throw new HttpsError("failed-precondition","Credit balance needs review");
   remaining=a.creditWalletRemaining;
  }else{
   const consumed=validCounter("used")+validCounter("reserved");
   if(!Number.isSafeInteger(consumed))throw new HttpsError("failed-precondition","Credit counters exceed supported range");
   remaining=Math.max(0,limit-(a.period===period?consumed:0));
  }
 }
 let subscriptionStatus;
 if(a.plan==="Free")subscriptionStatus="free";
 else if(!a.planExpiresAt)subscriptionStatus="unconfigured";
 else{
  const expiry=Date.parse(a.planExpiresAt);
  subscriptionStatus=!Number.isFinite(expiry)?"invalid":expiry<=now?"expired":"active";
 }
 return {plan:a.plan,limit,used,reserved,remaining,walletEnabled,
  walletStartingCredits:walletEnabled?a.walletStartingCredits??null:null,
  period,openBillingRequestId:a.openBillingRequestId||null,
  canBuyMore:false,purchaseReason:null,
  planExpiresAt:typeof a.planExpiresAt==="string"?a.planExpiresAt:null,
  subscriptionStatus};
}
module.exports={projectUsageStatus,LIMITS};
