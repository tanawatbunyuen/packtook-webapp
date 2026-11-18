"use strict";
/* P72 account/period/paid-plan compatibility helpers. Staging candidate only. */
const LIMITS=Object.freeze({Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null});
function planState(a,now=Date.now()){
 if(a.plan==="Free")return "free";
 if(!a.planExpiresAt)return "unconfigured";
 const e=Date.parse(a.planExpiresAt);
 if(!Number.isFinite(e))return "invalid";
 return e<=now?"expired":"active";
}
function periodId(now=Date.now()){return new Date(now).toISOString().slice(0,7);}
function validNumber(a,k,{requirePresence=false}={}){
 const n=a[k];
 if(n===undefined&&!requirePresence)return 0;
 if(!Number.isSafeInteger(n)||n<0)throw new Error("P72_INVALID_COUNTER");
 return n;
}
function available(a,now=Date.now()){
 if(!Object.hasOwn(LIMITS,a.plan))throw new Error("P72_INVALID_PLAN");
 const limit=LIMITS[a.plan];
 if(limit===null)return null;
 if(a.creditWalletV1===true)
  return validNumber(a,"creditWalletRemaining",{requirePresence:true});
 // Mirror production: validate counter integrity even at a month boundary.
 const used=validNumber(a,"used"),reserved=validNumber(a,"reserved");
 if(!Number.isSafeInteger(used+reserved))throw new Error("P72_COUNTER_OVERFLOW");
 return Math.max(0,limit-(a.period===periodId(now)?used+reserved:0));
}
function pending(a,now=Date.now()){
 const count=validNumber(a,"reserved");
 return a.creditWalletV1===true||a.period===periodId(now)?count:0;
}
function usageResponse(a,now=Date.now()){
 if(!Object.hasOwn(LIMITS,a.plan))throw new Error("P72_INVALID_PLAN");
 const current=periodId(now);
 const used=a.period===current?validNumber(a,"used"):0;
 return {
  plan:a.plan,limit:LIMITS[a.plan],used,
  reserved:pending(a,now),remaining:available(a,now),
  walletEnabled:a.creditWalletV1===true,
  walletStartingCredits:a.creditWalletV1===true?a.walletStartingCredits??null:null,
  period:current,openBillingRequestId:a.openBillingRequestId||null,
  canBuyMore:false,purchaseReason:null,
  planExpiresAt:typeof a.planExpiresAt==="string"?a.planExpiresAt:null,
  subscriptionStatus:planState(a,now)
 };
}
module.exports={LIMITS,planState,periodId,validNumber,available,pending,usageResponse};
