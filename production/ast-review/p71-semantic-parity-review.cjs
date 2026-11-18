"use strict";
/* P71 static semantic parity review - discrepancy detection, never release approval */
const fs=require("node:fs");
function assess(prod,p70,runtime){
 if([prod,p70,runtime].some(x=>typeof x!=="string"||!x.length))throw Error("P71_INPUT_REQUIRED");
 const checks=[
  {
   id:"DUPLICATE_REQUEST_LINKAGE",
   severity:"HIGH",
   source:/approvalSnap\.data\(\)\.requestId/.test(prod),
   candidate:/duplicateRequests/.test(p70)&&/linkedRequest/.test(p70),
   note:"Consumed duplicateApproval must update linked duplicateRequest"
  },
  {
   id:"AUTO_PROVISION_EQUIVALENCE",
   severity:"HIGH",
   source:/const ref=await ensureAccount\(id\)/.test(prod),
   candidate:/async function ensureAccount/.test(runtime),
   note:"Production reserve/usage/recover can auto-provision eligible Beta users; P70 does not"
  },
  {
   id:"SUBSCRIPTION_STATE_PARITY",
   severity:"HIGH",
   source:/const sub=subscriptionState\(a\)/.test(prod),
   candidate:/subscriptionState\(/.test(p70),
   note:"P70 paid-plan validity uses a simplified check without exact subscriptionState behavior"
  },
  {
   id:"USAGE_RESPONSE_SCHEMA",
   severity:"MEDIUM",
   source:/walletStartingCredits:/.test(prod)&&/openBillingRequestId:/.test(prod)&&/subscriptionStatus:/.test(prod),
   candidate:/walletStartingCredits:/.test(runtime)&&/openBillingRequestId:/.test(runtime)&&/subscriptionStatus:/.test(runtime),
   note:"P69 Usage status omits fields required by existing clients"
  },
  {
   id:"DUPLICATE_REQUEST_IDENTIFIER_POLICY",
   severity:"MEDIUM",
   source:/tx\.update\(ref\.collection\("duplicateRequests"\)\.doc\(approvalSnap\.data\(\)\.requestId\)/.test(prod),
   candidate:!(/if\(overridden&&approvalSnap\.data\(\)\.requestId&&/.test(p70)),
   note:"P70 rejects malformed linked request IDs that Production handled differently"
  },
  {
   id:"REVIEWED_STAGING_APP_CHECK_PROOF",
   severity:"CRITICAL",
   source:/guardedCall\(options/.test(prod),
   candidate:false,
   note:"Static source cannot prove deployed App Check backend enforcement"
  },
  {
   id:"EXACT_HANDLER_SOURCE_PARITY",
   severity:"HIGH",
   source:/exports\.reserveCredit=guardedCall/.test(prod),
   candidate:prod===p70,
   note:"P70 is a rewrite and has not been proven fully behavior-equivalent"
  }
 ];
 return {
  checkId:"P71",
  checks:checks.map(c=>({id:c.id,severity:c.severity,
   verdict:c.source?(c.candidate?"STATIC_MATCH_CANDIDATE":"REVIEW_REQUIRED"):"NOT_VERIFIABLE",
   note:c.note})),
  parityStatus:"REVIEW_REQUIRED",
  backendAppCheck:"NOT_PROVEN",
  runtimeEquivalence:"NOT_PROVEN",
  release:"NO_GO_RELEASE"
 };
}
if(require.main===module){
 try{
  const [prod,p70,runtime]=process.argv.slice(2);
  if(!prod||!p70||!runtime)throw Error("P71_PATHS_REQUIRED");
  console.log(JSON.stringify(assess(fs.readFileSync(prod,"utf8"),
   fs.readFileSync(p70,"utf8"),fs.readFileSync(runtime,"utf8")),null,2));
 }catch{
  console.log(JSON.stringify({checkId:"P71",parityStatus:"NOT_VERIFIABLE",release:"NO_GO_RELEASE"}));
  process.exitCode=2;
 }
}
module.exports={assess};
