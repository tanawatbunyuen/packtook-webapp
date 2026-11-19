"use strict";
/* P100 STRICTLY OFFLINE function-selector *intent* gate.
 * This is not a Firebase CLI deploy plan: Firebase CLI real targeting,
 * source-to-deployed mapping and rollback are NOT verified.
 */
const fs=require("node:fs"),path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const PROJECT="packtook-staging";
const TARGETS=Object.freeze(["recordingStatus","usageStatus"]);
const CREDIT=Object.freeze(["reserveCredit","finalizeCredit","recoverStaleVideoReservation"]);
const EXACT=TARGETS.map(n=>"functions:beta:"+n).join(",");
const FORBIDDEN=/[\s"'\\;|&$<>()\[\]{}*?!#@]/;
function inspect({selector=EXACT,project=PROJECT,
  source=fs.readFileSync(path.join(ROOT,"functions/index.js"),"utf8"),
  firebase=JSON.parse(fs.readFileSync(path.join(ROOT,"firebase.json"),"utf8")),
  candidate=fs.readFileSync(path.join(ROOT,"staging-candidates/p98/guarded-status-integration-candidate.cjs"),"utf8"),
  runtimeCliVersion=null,
  deployedMapping=null,verifiedRollback=null}={}){
 const findings=[];
 const add=(rule,pass)=>{if(!pass)findings.push(rule)};
 const parts=typeof selector==="string"?selector.split(","):[];
 add("P100_PROJECT_MISMATCH",project===PROJECT);
 add("P100_SELECTOR_NOT_CANONICAL",typeof selector==="string" &&
    selector===EXACT && !FORBIDDEN.test(selector) &&
    parts.length===2 && new Set(parts).size===2);
 add("P100_FUNCTION_FILTER_SCOPE",parts.every(x=>/^functions:beta:(recordingStatus|usageStatus)$/.test(x)));
 add("P100_ORIGINAL_EXPORTS_NOT_FOUND",TARGETS.every(n=>source.includes("exports."+n+"=")));
 add("P100_CREDIT_EXPORT_BOUNDARY_CHANGED",CREDIT.every(n=>source.includes("exports."+n+"=")));
 const codebases=Array.isArray(firebase.functions)?firebase.functions:[firebase.functions];
 add("P100_BETA_CODEBASE_NOT_EXCLUSIVE",
  codebases.filter(x=>x&&x.codebase==="beta"&&x.source==="functions").length===1);
 add("P100_CANDIDATE_ALREADY_REGISTERED",!source.includes("createP98GuardedStatusHandlers(") &&
    !source.includes("guarded-status-integration-candidate.cjs"));
 add("P100_CANDIDATE_MISSING",candidate.includes("createP81LegacyHandlers") &&
    candidate.includes("projectUsageStatus"));
 // Immutable known-good, live codebase mapping and CLI parser evidence have
 // never been supplied: a selector string alone cannot verify them.
 const safe=findings.length===0;
 return {schema:"P100_EXACT_STATUS_SELECTOR_GATE_V1",project:PROJECT,
  selectorIntent:selector===EXACT?"TWO_EXACT_STATUS_EXPORTS":"NOT_ALLOWED",
  offlineSyntaxAllowlist:safe?"PASS":"FAIL",
  findings,targetFunctions:[...TARGETS],
  excludedCreditFunctions:[...CREDIT],
  codebase:"beta",
  firebaseCliVersion:runtimeCliVersion===null?"NOT_PINNED_OR_TESTED":"UNVERIFIED_INPUT_IGNORED",
  actualCliSelectorSemantics:"NOT_VERIFIED",
  deployedFunctionOwnership:deployedMapping===null?"NOT_VERIFIED":"UNVERIFIED_INPUT_IGNORED",
  historicalSourceMapping:"NOT_VERIFIED",
  candidateRegistered:false,
  knownGoodRollback:verifiedRollback===null?"NOT_VERIFIED":"UNVERIFIED_INPUT_IGNORED",
  multiFunctionCliRisk:"REVIEW_REQUIRED",
  accountProvisioningParity:"NOT_EQUIVALENT",
  stagingDeploy:"BLOCKED",cloudCalls:0,cloudWrites:0,trafficChanges:0,
  release:"NO_GO_RELEASE"};
}
module.exports={inspect,EXACT,TARGETS,CREDIT};
if(require.main===module){
 try{
  const report=inspect();console.log(JSON.stringify(report));
  if(report.offlineSyntaxAllowlist!=="PASS")process.exitCode=2;
 }catch{
  console.log('{"schema":"P100_EXACT_STATUS_SELECTOR_GATE_V1","offlineSyntaxAllowlist":"FAIL","stagingDeploy":"BLOCKED","release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
