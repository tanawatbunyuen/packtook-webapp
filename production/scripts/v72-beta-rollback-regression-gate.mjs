// PACKTOOK V7.2 — Read-only Production Beta rollback/traffic + regression gate.
// Never executes deploy, traffic update, auth, secret access or account writes.
// Usage: node scripts/v72-beta-rollback-regression-gate.mjs packtook-prod-01
import fs from "node:fs";
import {execFileSync} from "node:child_process";
const PROJECT="packtook-prod-01", REGION="asia-southeast1";
const BRANCH="feature/v7.2-controlled-public-pilot-readiness";
const RECORDING=[
 "usageStatus","reserveCredit","finalizeCredit","registerDevice","deviceStatus",
 "recordingStatus","pendingVideoReservations","recoverStaleVideoReservation",
 "removeDevice","authorizeDuplicate","accountRole","subscriptionOverview"
];
const KEEP=["publicSignupStatus","pilotInvitationStatus","completePilotFreeSignup"];
const BETA_SA="267344264661-compute@developer.gserviceaccount.com";
const PILOT_SA="packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com";
export function assess({functions,publicOff,branch,clean,project,ownerApproved=false,
 betaSmokeEvidence=false,rollbackDrillEvidence=false}){
 const blocking=[],review=[];
 if(branch!==BRANCH||!clean||project!==PROJECT)blocking.push("BRANCH_WORKTREE_PROJECT_MISMATCH");
 if(publicOff!==true)blocking.push("PUBLIC_OFF_NOT_PROVEN");
 if(functions.length!==15||new Set(functions.map(f=>f.name)).size!==15)
  blocking.push("FUNCTION_INVENTORY_INCOMPLETE");
 for(const f of functions){
  const recording=RECORDING.includes(f.name);
  const pilot=f.name!=="publicSignupStatus"&&!recording;
  if(f.state!=="ACTIVE"||!f.runService||!f.revision||
     !f.revisionReadable||!f.matchingService||!f.imageCaptured)
   blocking.push("REVISION_NOT_VERIFIED_"+f.name);
  if(f.identity!==(pilot?PILOT_SA:BETA_SA))
   blocking.push("RUNTIME_IDENTITY_CHANGED_"+f.name);
  if(!f.trafficReadable||f.servingRevision!==f.revision||
     f.servingPercent!==100||f.totalTrafficPercent!==100||
     f.trafficTargetsCount!==1||f.latestRevisionRouting)
   review.push("TRAFFIC_BASELINE_NOT_SINGLE_FIXED_REVISION_"+f.name);
  if(!f.codebaseLabelVerified)review.push("CODEBASE_LABEL_UNVERIFIED_"+f.name);
  if(!f.runtimeConfigComparable)review.push("RUNTIME_CONFIGURATION_NOT_COMPARABLE_"+f.name);
 }
 if(!betaSmokeEvidence)review.push("BETA_FUNCTIONAL_SMOKE_TEST_NOT_DOCUMENTED");
 if(!rollbackDrillEvidence)review.push("ROLLBACK_TRAFFIC_PROCEDURE_NOT_TESTED_ON_NONPRODUCTION");
 if(!ownerApproved)review.push("OWNER_RECORDING_DEPLOY_APPROVAL_PENDING");
 return {technicalBaselinePass:blocking.length===0&&review.filter(x=>![
   "BETA_FUNCTIONAL_SMOKE_TEST_NOT_DOCUMENTED",
   "ROLLBACK_TRAFFIC_PROCEDURE_NOT_TESTED_ON_NONPRODUCTION",
   "OWNER_RECORDING_DEPLOY_APPROVAL_PENDING"].includes(x)).length===0,
  blocking,review,prodWrites:false,deployApproved:false,
  decision:"NO_GO_CONTROLLED_PILOT"};
}
function call(cmd,args,timeout=30000){
 try{return {ok:true,data:JSON.parse(execFileSync(cmd,args,{
   encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout,maxBuffer:6*1024*1024}))}}
 catch{return {ok:false,data:null}}
}
function scalar(cmd,args){
 try{return execFileSync(cmd,args,{
  encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:12000}).trim()}
 catch{return null}
}
function getFunction(name){
 const r=call("gcloud",["functions","describe",name,"--gen2","--project="+PROJECT,
  "--region="+REGION,"--format=json"]);
 if(!r.ok)return {name,state:null};
 const d=r.data,c=d.serviceConfig||{};
 const runService=(c.service||"").split("/").pop();
 const revision=(c.revision||"").split("/").pop();
 const run=runService?call("gcloud",["run","services","describe",runService,
  "--region="+REGION,"--project="+PROJECT,"--format=json"]):{ok:false};
 const rev=revision?call("gcloud",["run","revisions","describe",revision,
  "--region="+REGION,"--project="+PROJECT,"--format=json"]):{ok:false};
 const rd=rev.data||{},sd=run.data||{};
 const labels=rd.metadata?.labels||rd.labels||{};
 const ownerMatch=labels["serving.knative.dev/service"]===runService;
 const containers=rd.spec?.containers||rd.template?.spec?.containers||rd.containers||[];
 const imageCaptured=containers.some(x=>typeof x.image==="string"&&x.image.length>0);
 const traffic=sd.status?.traffic||sd.traffic||[];
 const route=traffic.map(x=>({revision:x.revisionName||x.revision||"",
  percent:Number(x.percent??0),latestRevision:Boolean(x.latestRevision)}));
 const nonzero=route.filter(x=>x.percent>0);
 const total=route.reduce((sum,x)=>sum+x.percent,0);
 const serving=nonzero.length===1?nonzero[0]:null;
 // Read no raw envs and no secret payloads. Record only config metadata for diffing.
 const runTemplate=sd.spec?.template?.spec||sd.template||{};
 const envList=runTemplate.containers?.[0]?.env||[];
 const functionEnvKeys=Object.keys(c.environmentVariables||{}).sort();
 const secretNames=(c.secretEnvironmentVariables||[]).map(x=>x.secret).filter(Boolean).sort();
 const flags=["PACKTOOK_V72_PILOT_ENABLED","PACKTOOK_PUBLIC_SIGNUP_ENABLED",
 "PACKTOOK_PUBLIC_ACCESS_ENABLED","PACKTOOK_V7_QA_ENABLED"];
 const unsafeFlag=flags.some(k=>(c.environmentVariables||{})[k]==="true");
 return {
  name,state:d.state||null,runService,revision,
  runtime:d.buildConfig?.runtime||null,
  codebaseLabelVerified:d.labels?.["firebase-functions-codebase"]==="beta",
  identity:c.serviceAccountEmail||null,
  revisionReadable:rev.ok,
  matchingService:ownerMatch&&
    (rd.metadata?.name===revision||rd.name===revision),
  imageCaptured,
  trafficReadable:run.ok&&Array.isArray(traffic)&&traffic.length>0,
  trafficTargetsCount:nonzero.length,totalTrafficPercent:total,
  servingRevision:serving?.revision||null,servingPercent:serving?.percent??null,
  latestRevisionRouting:route.some(x=>x.latestRevision),
  runtimeConfigComparable:Boolean(c.serviceAccountEmail&&d.buildConfig?.runtime&&run.ok),
  functionEnvKeyCount:functionEnvKeys.length,
  cloudRunEnvKeyCount:envList.length,
  secretCount:secretNames.length,
  unsafeFlagObserved:unsafeFlag
 };
}
const isMain=process.argv[1]?.endsWith("/v72-beta-rollback-regression-gate.mjs");
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("BLOCK: exact project required");process.exitCode=2;
 }else{
  const branch=scalar("git",["branch","--show-current"]);
  const dirty=scalar("git",["status","--porcelain"]);
  const project=scalar("gcloud",["config","get-value","project"]);
  // Existing read-only Public HTTP probe used by previous V7.2 gate.
  const {readPublicSafetyEvidence}=await import("./v72-secret-changeplan.mjs");
  const probe=await readPublicSafetyEvidence();
  const publicOff=probe.diagnostic?.closed===true&&
   probe.diagnostic?.publicSignupEnabled===false&&
   probe.diagnostic?.publicAccessEnabled===false&&
   probe.diagnostic?.statusHttp===200&&
   probe.diagnostic?.customerHttp===200&&
   probe.diagnostic?.marketingHttp===200;
  const entries=[...RECORDING,...KEEP].map(getFunction);
  const report=assess({functions:entries,publicOff,branch,
   clean:dirty==="",project});
  if(entries.some(x=>x.unsafeFlagObserved))
   report.blocking.push("ENABLED_PUBLIC_PILOT_QA_ENV_FLAG_OBSERVED");
  if(report.blocking.length)report.technicalBaselinePass=false;
  console.log(JSON.stringify({
   mode:"READ_ONLY_BETA_RECORDING_ROLLBACK_REGRESSION",
   project:PROJECT,region:REGION,
   counts:{recording:12,keep:3,active:entries.filter(x=>x.state==="ACTIVE").length,
    fixedTraffic:entries.filter(x=>x.trafficReadable&&x.servingRevision===x.revision&&x.servingPercent===100).length},
   protectedFunctions:KEEP,
   functions:entries,
   baselineNote:"Revision/traffic information changes over time; recheck immediately before deployment",
   rollbackNote:"Any future gcloud run services update-traffic is a PRODUCTION WRITE; not called here",
   betaSmokeRequiresOwnerTestAccount:true,
   ...report
  },null,2));
  if(!report.technicalBaselinePass)process.exitCode=2;
 }
}
