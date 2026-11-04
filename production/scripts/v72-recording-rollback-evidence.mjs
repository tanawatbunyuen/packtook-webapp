// PACKTOOK V7.2 — Cloud READ-ONLY rollback evidence for 12 live Beta functions.
// Does NOT deploy, roll back, change IAM/flags, or save tokens/secret contents.
// Usage: node scripts/v72-recording-rollback-evidence.mjs packtook-prod-01
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const PROJECT="packtook-prod-01", REGION="asia-southeast1";
const BRANCH="feature/v7.2-controlled-public-pilot-readiness";
const CORE=["usageStatus","reserveCredit","finalizeCredit","registerDevice","deviceStatus","recordingStatus"];
const EXTRA=["pendingVideoReservations","recoverStaleVideoReservation","removeDevice","authorizeDuplicate","accountRole","subscriptionOverview"];
const NAMES=[...CORE,...EXTRA];
function run(cmd,args){
 try{return JSON.parse(execFileSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:30000,maxBuffer:4*1024*1024}))}
 catch{return null}
}
function text(cmd,args){
 try{return execFileSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:15000}).trim()}
 catch{return null}
}
const requiredArgs=process.argv.length===3&&process.argv[2]===PROJECT;
if(!requiredArgs){console.error("BLOCK: exact Production project required");process.exit(2)}
if(text("git",["branch","--show-current"])!==BRANCH||
 text("git",["status","--porcelain"])!==""||
 text("gcloud",["config","get-value","project"])!==PROJECT){
 console.error("BLOCK: wrong branch, dirty tree, or active project mismatch");process.exit(2)
}
const data=[];
for(const name of NAMES){
 const f=run("gcloud",["functions","describe",name,"--gen2","--project="+PROJECT,"--region="+REGION,"--format=json"]);
 if(!f){data.push({name,error:"FUNCTION_NOT_READABLE"});continue}
 const svc=f.serviceConfig||{};
 const serviceRef=svc.service||"";
 const service=serviceRef.split("/").pop();
 const revisionRef=svc.revision||"";
 const revision=revisionRef.split("/").pop();
 // A revision name and image digest must be captured together to constitute
 // useful rollback evidence. We do not claim any gcloud rollback command is safe.
 let details=null;
 if(service&&revision){
  // gcloud run revisions describe accepts a revision name and region, NOT --service.
  // --service is valid only for revisions list. A wrong flag previously caused
  // every lookup to fail silently and incorrectly report 0/12 revisions readable.
  const rev=run("gcloud",["run","revisions","describe",revision,
    "--project="+PROJECT,"--region="+REGION,"--format=json"]);
  const containers=rev?.spec?.containers||rev?.template?.spec?.containers||rev?.containers||[];
  const images=containers.map(x=>x.image).filter(Boolean);
  const digest=rev?.status?.imageDigest||rev?.imageDigest||null;
  const actualRev=rev?.metadata?.name||rev?.name||null;
  const belongsToService=rev?.metadata?.labels?.["serving.knative.dev/service"]===service||
   rev?.labels?.["serving.knative.dev/service"]===service||
   rev?.service===service||
   rev?.service===("projects/"+PROJECT+"/locations/"+REGION+"/services/"+service);
  details={imageReferences:images,revisionReadable:Boolean(rev),
   matchingRevision:actualRev===revision,
   matchingService:belongsToService,
   imageDigestPresent:Boolean(digest),
   imageCaptured:images.length>0&&actualRev===revision&&belongsToService};
 }
 data.push({name,state:f.state||null,service,revision,
  runtimeServiceAccount:svc.serviceAccountEmail||null,
  codebaseLabel:f.labels?.["firebase-functions-codebase"]||null,
  runtime:f.buildConfig?.runtime||null,
  revisionEvidence:details||{revisionReadable:false,imageCaptured:false,imageReferences:[]},
  lastGoodRuntimeSmokeTestVerified:false,rollbackCommandTested:false});
}
const allActive=data.length===12&&data.every(x=>x.state==="ACTIVE");
const allRevisions=data.every(x=>x.revision&&x.revisionEvidence.revisionReadable&&x.revisionEvidence.imageCaptured);
const result={
 mode:"CLOUD_READ_ONLY_RECORDING_ROLLBACK_EVIDENCE",project:PROJECT,region:REGION,
 counts:{target:12,active:data.filter(x=>x.state==="ACTIVE").length,
  revisionEvidenceComplete:data.filter(x=>x.revisionEvidence?.imageCaptured).length},
 functions:data,
 activeBaselineVerified:allActive,
 imageEvidenceVerified:allRevisions,
 rollbackPlanTested:false,betaSmokeRegressionVerified:false,
 ownerDeployApproval:false,cloudWrites:false,
 review:(!allActive?["BETA_BASELINE_NOT_ALL_ACTIVE"]:[])
  .concat(!allRevisions?["ROLLBACK_IMAGE_OR_REVISION_EVIDENCE_INCOMPLETE"]:[])
  .concat(["ROLLBACK_PROCEDURE_AND_OWNER_APPROVAL_PENDING"]),
 decision:"NO_GO_CONTROLLED_PILOT"
};
console.log(JSON.stringify(result,null,2));
if(!allActive||!allRevisions)process.exitCode=2;
