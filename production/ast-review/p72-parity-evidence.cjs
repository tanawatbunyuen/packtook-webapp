"use strict";
/* P72 scoped parity evidence. Never marks deployment or full equivalence GO. */
const fs=require("node:fs");
function evaluate(original,credit,status,semantic){
 const checks={
  subscriptionClassifier:/function subscriptionState\(a\)/.test(original)&&
    /planState\(a,clock\(\)\)/.test(credit)&&
    /function planState\(a,now=Date\.now\(\)\)/.test(semantic),
  usageSchema:/walletStartingCredits:/.test(original)&&
    /openBillingRequestId:/.test(semantic)&&/subscriptionStatus:/.test(semantic)&&
    /usageResponse\(snap\.data\(\)\)/.test(status),
  legacyMonthCounters:/creditAvailable\(a,clock\(\)\)/.test(credit)&&
    /if\(!Number\.isSafeInteger\(used\+reserved\)\)/.test(semantic),
  walletCarryover:/a\.creditWalletV1===true/.test(semantic)&&
    /return validNumber\(a,"creditWalletRemaining"/.test(semantic),
  autoProvisioningPolicy:"INTENTIONALLY_DIFFERENT_PREPROVISION_ONLY",
  duplicateRequestLinkage:/duplicateRequests/.test(credit),
  productionSourceIdentity:"NOT_PROVEN",
  endToEndAuthorizedCallable:"NOT_PROVEN",
  deployedAppCheck:"NOT_PROVEN"
 };
 const allStatic=checks.subscriptionClassifier&&checks.usageSchema&&
  checks.legacyMonthCounters&&checks.walletCarryover&&checks.duplicateRequestLinkage;
 return {p:"P72",parityChecks:checks,scopedStaticParity:allStatic?"MATCH_CANDIDATE":"REVIEW_REQUIRED",
  semanticParity:"REVIEW_REQUIRED",stagingGuardDrift:"OPEN",
  backendAppCheck:"NOT_PROVEN",deployment:"BLOCKED",release:"NO_GO_RELEASE"};
}
if(require.main===module){
 const args=process.argv.slice(2);
 try{
  if(args.length!==4)throw Error("P72_INPUT_REQUIRED");
  console.log(JSON.stringify(evaluate(...args.map(x=>fs.readFileSync(x,"utf8"))),null,2));
 }catch{
  console.log(JSON.stringify({p:"P72",semanticParity:"NOT_VERIFIABLE",release:"NO_GO_RELEASE"}));
  process.exitCode=2;
 }
}
module.exports={evaluate};
