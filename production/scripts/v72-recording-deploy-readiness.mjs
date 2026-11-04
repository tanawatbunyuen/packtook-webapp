// PACKTOOK V7.2 Recording Functions — READ-ONLY deployment baseline.
// No deploy / no IAM writes / no flags / no account/credit writes.
// This is an inventory/review gate, NOT approval to update live Beta.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {readPublicSafetyEvidence} from "./v72-secret-changeplan.mjs";

const PROJECT="packtook-prod-01",REGION="asia-southeast1";
const BRANCH="feature/v7.2-controlled-public-pilot-readiness";
const ADMISSION=["pilotInvitationStatus","completePilotFreeSignup"];
const CORE=["usageStatus","reserveCredit","finalizeCredit",
 "registerDevice","deviceStatus","recordingStatus"];
const OTHER=["pendingVideoReservations","recoverStaleVideoReservation",
 "removeDevice","authorizeDuplicate","accountRole","subscriptionOverview"];
const GUARDED=[...CORE,...OTHER];
const PUBLIC="publicSignupStatus";
const BETA_SA="267344264661-compute@developer.gserviceaccount.com";
const PILOT_SA="packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com";
const expectedTargets=GUARDED.map(n=>"functions:beta:"+n).join(",");

function command(bin,args,timeout=30000){
 try{return {ok:true,output:execFileSync(bin,args,{encoding:"utf8",
  stdio:["ignore","pipe","pipe"],timeout,maxBuffer:4*1024*1024})}}
 catch(e){
  const raw=String(e.stderr||e.message||"");
  return {ok:false,error:/NOT_FOUND|not found|404/i.test(raw)?"NOT_FOUND":
   /PERMISSION_DENIED|permission denied|403/i.test(raw)?"PERMISSION_DENIED":
   /deadline|timed out|ETIMEDOUT/i.test(raw)?"TIMEOUT":"UNKNOWN"};
 }
}
function inspect(name){
 const out=command("gcloud",["functions","describe",name,"--gen2",
  "--region="+REGION,"--project="+PROJECT,"--format=json"],35000);
 if(!out.ok)return {name,exists:out.error==="NOT_FOUND"?false:null,error:out.error};
 try{
  const d=JSON.parse(out.output),c=d.serviceConfig||{};
  const identity=c.serviceAccountEmail||"";
  const runService=typeof c.service==="string"?c.service:null;
  const revision=typeof c.revision==="string"?c.revision:null;
  return {name,exists:true,state:d.state||null,
   runtime:d.buildConfig?.runtime||null,
   codebaseLabel:d.labels?.["firebase-functions-codebase"]||null,
   identity:identity===BETA_SA?"LEGACY_BETA":
    identity===PILOT_SA?"DEDICATED_PILOT":"OTHER_OR_UNKNOWN",
   revision,runService,
   revisionCaptured:Boolean(revision),
   runtimeConfigRead:true,
   secretBindings:Array.isArray(c.secretEnvironmentVariables)?
    c.secretEnvironmentVariables.map(x=>x.secret).filter(Boolean):[],
   hasSecretVolumes:Array.isArray(c.secretVolumes)&&c.secretVolumes.length>0,
   ingress:c.ingressSettings||null,maxInstanceCount:c.maxInstanceCount??null,
   minInstanceCount:c.minInstanceCount??null};
 }catch{return {name,exists:null,error:"INVALID_JSON"}}
}
export function evaluate({branch,clean,project,source,config,publicProbe,
 admission,pub,recording,ownerRollbackReviewed=false}){
 const blocking=[],review=[];
 if(branch!==BRANCH||clean!==true)blocking.push("UNEXPECTED_BRANCH_OR_UNCOMMITTED_FILES");
 if(project!==PROJECT)blocking.push("GCLOUD_PROJECT_MISMATCH");
 if((config.functions||[]).filter(x=>x.codebase==="beta"&&x.source==="functions").length!==1)
  blocking.push("INVALID_BETA_SOURCE_CODEBASE");
 if(source.includes("const options={region,maxInstances:5,timeoutSeconds:30};")!==true||
    !source.includes("function guardedCall(callOptions,handler){")||
    !source.includes("await requirePilotLease(req,{claimRequired:true});"))
  blocking.push("GUARD_SOURCE_DRIFT");
 for(const name of GUARDED) {
  if(!source.includes("exports."+name+"=guardedCall(options,async req=>{"))
   blocking.push("SOURCE_NOT_GUARDED_"+name);
 }
 if(publicProbe?.closed!==true||publicProbe.explicitEnabledSeen===true||
    publicProbe.marketingHttp!==200||publicProbe.customerHttp!==200||
    publicProbe.statusHttp!==200||publicProbe.publicSignupEnabled!==false||
    publicProbe.publicAccessEnabled!==false)
  blocking.push("PUBLIC_SAFETY_NOT_VERIFIED");
 if(pub?.exists!==true||pub.state!=="ACTIVE"||pub.identity!=="LEGACY_BETA"||
   pub.secretBindings?.length!==0||pub.hasSecretVolumes!==false)
  blocking.push("PUBLIC_STATUS_BASELINE_DRIFT");
 if(admission.length!==2||admission.some(x=>x.exists!==true||x.state!=="ACTIVE"||
    x.identity!=="DEDICATED_PILOT"||
    !x.secretBindings?.includes("PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX")))
  blocking.push("ADMISSION_DEPLOYED_BASELINE_DRIFT");
 if(recording.length!==12||recording.some(x=>x.exists!==true||x.state!=="ACTIVE"))
  blocking.push("RECORDING_FUNCTIONS_NOT_ALL_ACTIVE");
 if(recording.some(x=>x.identity!=="LEGACY_BETA"))
  review.push("RECORDING_RUNTIME_IDENTITIES_DIFFER_REVIEW_REQUIRED");
 if(recording.some(x=>!x.revisionCaptured))
  review.push("EXACT_RUNNING_REVISIONS_NOT_ALL_CAPTURED");
 if(recording.some(x=>x.codebaseLabel!=="beta"))
  review.push("BETA_CODEBASE_LABELS_NOT_ALL_VERIFIED");
 if(!ownerRollbackReviewed)review.push("ROLLBACK_PLAN_AND_BETA_OWNER_APPROVAL_PENDING");
 return {metadataGatePass:blocking.length===0&&review.length===0,
  blocking,review,selectorForFutureApproval:expectedTargets,
  publicStatusNotTargeted:!expectedTargets.includes(PUBLIC),
  admissionNotTargeted:ADMISSION.every(n=>!expectedTargets.includes(n)),
  deploymentApproved:false,prodWrites:false,decision:"NO_GO_CONTROLLED_PILOT"};
}
const isMain=path.resolve(process.argv[1]||"")===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("USAGE: node scripts/v72-recording-deploy-readiness.mjs packtook-prod-01");
  process.exitCode=2;
 }else{
  const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
  const config=JSON.parse(fs.readFileSync(new URL("../firebase.json",import.meta.url),"utf8"));
  const evidence=await readPublicSafetyEvidence();
  const b=command("git",["branch","--show-current"]);
  const w=command("git",["status","--porcelain"]);
  const p=command("gcloud",["config","get-value","project"]);
  const admission=ADMISSION.map(inspect);
  const pub=inspect(PUBLIC);
  const recording=GUARDED.map(inspect);
  const result=evaluate({branch:b.output?.trim(),clean:w.ok&&w.output.trim()==="",
   project:p.output?.trim(),source,config,publicProbe:evidence.diagnostic,admission,pub,recording});
  console.log(JSON.stringify({
   version:"7.2",mode:"RECORDING_DEPLOY_READINESS_READ_ONLY",
   project:PROJECT,region:REGION,codebase:"beta",
   baseline:{publicSignupStatus:pub,admission,recording},
   counts:{core:CORE.length,additional:OTHER.length,total:GUARDED.length,
     recordingActive:recording.filter(x=>x.exists===true&&x.state==="ACTIVE").length,
     revisionsCaptured:recording.filter(x=>x.revisionCaptured).length},
   publicOff:evidence.diagnostic?.closed===true,
   runtimeActualFunctionCodeNotProven:true,
   browserAppCheckNotVerified:true,
   rollbackAutomationNotPrepared:true,
   // Capturing current revision is necessary but not sufficient for rollback.
   ...result
  },null,2));
  if(result.blocking.length||result.review.some(x=>x!=="ROLLBACK_PLAN_AND_BETA_OWNER_APPROVAL_PENDING"))
   process.exitCode=2;
 }
}
