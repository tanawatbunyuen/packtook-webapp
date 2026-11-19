"use strict";
/* P105 uses actual firebase-tools@15.29.0 compiled groupEndpointsByCodebase
 * against synthetic Staging Gen2 functions. NO Firebase deploy planner,
 * no Cloud calls. An absence of labels doesn't establish live ownership.
 */
const {VERSION,loadPinned}=require("./p101-pinned-cli-parser.cjs");
const PROJECT="packtook-staging",REGION="asia-southeast1";
const STATUS=["recordingStatus","usageStatus"];
const CREDIT=["reserveCredit","finalizeCredit","recoverStaleVideoReservation"];
const NAMES=[...STATUS,...CREDIT];
function endpoint(id,codebase){
 return {id,project:PROJECT,region:REGION,platform:"gcfv2",
  ...(codebase?{codebase}:{})};
}
function keys(backend,compiler){
 return compiler.allEndpoints(backend).map(e=>e.id).sort();
}
function audit(helper,backend){
 if(!helper||typeof helper.groupEndpointsByCodebase!=="function"||
     typeof helper.getEndpointFilters!=="function"||
     typeof helper.endpointMatchesAnyFilter!=="function"||
     !backend||typeof backend.of!=="function"||typeof backend.allEndpoints!=="function")
   throw Error("P105_PINNED_CLI_HELPERS_MISSING");
 const have=NAMES.map(n=>endpoint(n,undefined));
 const wantFull={beta:backend.of(...NAMES.map(n=>endpoint(n,"beta")))};
 const wantStatus={beta:backend.of(...STATUS.map(n=>endpoint(n,"beta")))};
 const mapFull=helper.groupEndpointsByCodebase(wantFull,have);
 const mapStatus=helper.groupEndpointsByCodebase(wantStatus,have);
 const allGrouped=keys(mapFull.beta,backend);
 const statusGrouped=keys(mapStatus.beta,backend);
 if(JSON.stringify(allGrouped)!==JSON.stringify([...NAMES].sort()))
  throw Error("P105_FULL_WANT_NAME_MAPPING_CHANGED");
 if(JSON.stringify(statusGrouped)!==JSON.stringify([...STATUS].sort()))
  throw Error("P105_STATUS_WANT_NAME_MAPPING_CHANGED");
 const sourceCfg=[{source:"functions",codebase:"beta"},
   {source:"owner-functions",codebase:"owner"},
   {source:"payment-functions",codebase:"promptpay"}];
 const filters=helper.getEndpointFilters({
  only:"functions:beta:recordingStatus,functions:beta:usageStatus"},sourceCfg);
 const filtered=have.filter(e=>helper.endpointMatchesAnyFilter({...e,codebase:"beta"},filters))
  .map(e=>e.id).sort();
 if(JSON.stringify(filtered)!==JSON.stringify([...STATUS].sort()))
  throw Error("P105_UNEXPECTED_SELECTED_ENDPOINTS");
 return {schema:"P105_UNLABELED_CODEBASE_CLI_MAPPING_V1",
  project:PROJECT,cliVersion:VERSION,
  ownerEvidence:"P103_ALL_FIVE_LABELS_ABSENT",
  sourceReferenceEvidence:"P104_FIVE_DISTINCT_BUILD_SOURCE_REFERENCES",
  groupedByNameWithFullWant:"FIVE_OF_FIVE_SYNTHETIC",
  groupedByNameWithStatusWant:"TWO_OF_TWO_SYNTHETIC",
  selectedBySyntheticFilter:"TWO_STATUS_FUNCTIONS",
  creditFunctionsSelected:0,
  nameBasedReassignmentRisk:"REVIEW_REQUIRED",
  actualHaveInventory:"NOT_LOADED_FROM_CLOUD",
  actualWantBackend:"NOT_BUILT",
  actualDeletePlan:"NOT_EXECUTED",
  deployedOwnership:"NOT_VERIFIED",
  sourceToGitParity:"NOT_VERIFIED",
  accountBehavior:"NOT_EQUIVALENT",
  guardDrift:"UNREMEDIATED",
  deploy:0,cloudCalls:0,cloudWrites:0,trafficChanges:0,
  release:"NO_GO_RELEASE"};
}
module.exports={audit,endpoint,keys,STATUS,CREDIT,NAMES};
if(require.main===module){
 try{
  const root=process.env.P105_FIREBASE_TOOLS_ROOT||"";
  const helper=loadPinned(root);
  const backend=require(require("node:path").join(root,"node_modules","firebase-tools","lib","deploy","functions","backend.js"));
  console.log(JSON.stringify(audit(helper,backend)));
 }catch{
  console.log('{"schema":"P105_UNLABELED_CODEBASE_CLI_MAPPING_V1","result":"NOT_VERIFIABLE","deploy":0,"release":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
