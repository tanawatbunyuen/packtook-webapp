"use strict";
/* P101 executes functionsDeployHelper from a separately installed, exactly
 * pinned firebase-tools version. No firebase deploy/plan/cloud command.
 * The filters apply exact name OR grouped-function prefix; this gate
 * rejects any extra prefixed endpoint in a synthetic live inventory.
 */
const fs=require("node:fs"),path=require("node:path");
const {EXACT,TARGETS,CREDIT,inspect}=require("./p100-exact-status-selector-gate.cjs");
const VERSION="15.29.0";
function loadPinned(root){
 if(typeof root!=="string"||!path.isAbsolute(root))throw Error("P101_PINNED_MODULE_PATH_REQUIRED");
 const packageFile=path.join(root,"node_modules","firebase-tools","package.json");
 const pkg=JSON.parse(fs.readFileSync(packageFile,"utf8"));
 if(pkg.name!=="firebase-tools"||pkg.version!==VERSION)
  throw Error("P101_FIREBASE_CLI_VERSION_MISMATCH");
 const helper=require(path.join(root,"node_modules","firebase-tools","lib","deploy","functions","functionsDeployHelper.js"));
 for(const name of ["getEndpointFilters","endpointMatchesAnyFilter","targetCodebases"])
  if(typeof helper[name]!=="function")throw Error("P101_PINNED_HELPER_MISSING_"+name);
 return helper;
}
function audit(helper,{selector=EXACT,configSource,inventory}={}){
 const source=configSource||JSON.parse(fs.readFileSync(path.resolve(__dirname,"../firebase.json"),"utf8"));
 const configurations=source.functions;
 const configured=Array.isArray(configurations)?configurations:[configurations];
 if(!configured.some(v=>v.codebase==="beta"&&v.source==="functions"))
  throw Error("P101_BETA_CONFIG_MISSING");
 const parser=helper.getEndpointFilters({only:selector},configured);
 if(!Array.isArray(parser)||parser.length!==2)throw Error("P101_FILTER_COUNT_MISMATCH");
 const parsed=parser.map(v=>({codebase:v.codebase,idChunks:v.idChunks}));
 if(parser.some(v=>v.codebase!=="beta"||
     !Array.isArray(v.idChunks)||v.idChunks.length!==1||
     !TARGETS.includes(v.idChunks[0]))||
     new Set(parser.map(v=>v.idChunks.join("-"))).size!==2)
    throw Error("P101_CLI_FILTER_PARSER_MISMATCH");
 const codebases=helper.targetCodebases(configured,parser);
 if(codebases.length!==1||codebases[0]!=="beta")throw Error("P101_CLI_TARGET_CODEBASE_MISMATCH");
 const entries=inventory||TARGETS.concat(CREDIT).map(id=>({id,codebase:"beta",platform:"gcfv2",region:"asia-southeast1"}));
 if(!Array.isArray(entries)||entries.length<5||entries.length>100)throw Error("P101_INVALID_INVENTORY");
 const targeted=entries.filter(e=>helper.endpointMatchesAnyFilter(e,parser));
 const actual=targeted.map(e=>e.id).sort();
 if(JSON.stringify(actual)!==JSON.stringify([...TARGETS].sort()))
  throw Error("P101_PREFIX_OR_EXTRA_TARGET_DETECTED");
 if(targeted.some(e=>e.codebase!=="beta")||CREDIT.some(n=>targeted.some(e=>e.id===n)))
  throw Error("P101_CREDIT_TARGET_DETECTED");
 const offline=inspect({selector});
 if(offline.offlineSyntaxAllowlist!=="PASS")throw Error("P101_P100_ALLOWLIST_NOT_PASS");
 return {schema:"P101_PINNED_FIREBASE_CLI_FILTER_V1",
  firebaseCliVersion:VERSION,project:"packtook-staging",
  parserVersionPinned:true,source:"PUBLISHED_FIREBASE_TOOLS_PACKAGE",
  parsed,codebases,targetedIds:actual,
  threeCreditFunctionsExcluded:true,prefixFilterRisk:"EXISTS_REQUIRES_FULL_LIVE_INVENTORY",
  offlineSyntheticSelectorCheck:"PASS",
  actualDeployedInventory:"NOT_VERIFIED",
  fullDeployPlanner:"NOT_EXECUTED",
  deletionPlan:"NOT_VERIFIED",
  sourceToDeployedMapping:"NOT_VERIFIED",
  accountCompatibility:"NOT_EQUIVALENT",
  liveBackendAppCheck:"NOT_PROVEN",
  knownGoodRollback:"NOT_VERIFIED",
  cloudCalls:0,cloudWrites:0,deploy:0,trafficChanges:0,release:"NO_GO_RELEASE"};
}
module.exports={VERSION,loadPinned,audit};
if(require.main===module){
 try{
  const m=loadPinned(process.env.P101_FIREBASE_TOOLS_ROOT||"");
  console.log(JSON.stringify(audit(m)));
 }catch(e){
  console.log(JSON.stringify({schema:"P101_PINNED_FIREBASE_CLI_FILTER_V1",state:"NOT_VERIFIED",
   reason:e instanceof Error&&/^P101_[A-Z_]+$/.test(e.message)?e.message:"P101_PINNED_PARSER_UNAVAILABLE",
   deploy:0,release:"NO_GO_RELEASE"}));
  process.exitCode=2;
 }
}
