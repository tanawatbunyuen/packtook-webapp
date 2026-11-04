// PACKTOOK V7.2 Admission-only deploy preflight (READ-ONLY, fail closed).
// Usage: node scripts/v72-admission-deploy-preflight.mjs packtook-prod-01
// NO deploy, IAM change, API enable, secret payload access or Public/Pilot flag writes.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {readPublicSafetyEvidence} from "./v72-secret-changeplan.mjs";
const PROJECT="packtook-prod-01",REGION="asia-southeast1";
const BRANCH="feature/v7.2-controlled-public-pilot-readiness";
const SA="packtook-public-pilot-v72@"+PROJECT+".iam.gserviceaccount.com";
const STATUS="publicSignupStatus";
const TARGETS=["pilotInvitationStatus","completePilotFreeSignup"];
const ROOT=new URL("../",import.meta.url);
const COMMAND="firebase deploy --project "+PROJECT+" --only functions:beta:pilotInvitationStatus,functions:beta:completePilotFreeSignup";
function run(cmd,args,timeout=30000){
 try{return {ok:true,text:execFileSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout,maxBuffer:4*1024*1024})}}
 catch(e){
  const msg=String(e.stderr||e.message||"");
  const error=/NOT_FOUND|not found|404/i.test(msg)?"NOT_FOUND":
   /PERMISSION_DENIED|permission denied|403/i.test(msg)?"PERMISSION_DENIED":
   /timed out|ETIMEDOUT/i.test(msg)?"TIMEOUT":"UNKNOWN";
  return {ok:false,error};
 }
}
function cloudFunction(name){
 const a=run("gcloud",["functions","describe",name,"--gen2","--region="+REGION,
  "--project="+PROJECT,"--format=json"]);
 if(!a.ok)return {name,deployed:a.error==="NOT_FOUND"?false:null,inspectionError:a.error};
 try{
  const d=JSON.parse(a.text),cfg=d.serviceConfig||{};
  const principal=cfg.serviceAccountEmail||"";
  return {name,deployed:true,inspectionError:null,state:d.state||"UNKNOWN",
   serviceAccountClass:principal===SA?"DEDICATED_V72":principal.endsWith("-compute@developer.gserviceaccount.com")?"LEGACY_COMPUTE":"OTHER",
   secretBound:Boolean((cfg.secretEnvironmentVariables||[]).length||(cfg.secretVolumes||[]).length),
   revisionReference:typeof cfg.revision==="string"&&cfg.revision.length>0?cfg.revision:null,
   serviceReference:typeof cfg.service==="string"&&cfg.service.length>0?cfg.service:null,
   runtime:d.buildConfig?.runtime||null};
 }catch{return {name,deployed:null,inspectionError:"INVALID_JSON"}}
}
export function assess({source,config,branch,clean,project,publicProbe,status,pilots,serviceAccountActive,roleVerified,secretGrantVerified,cliAvailable}){
 const errors=[];
 const f=(config.functions||[]).filter(x=>x.codebase==="beta"&&x.source==="functions");
 if(f.length!==1)errors.push("BETA_CODEBASE_SOURCE_NOT_EXACT");
 if(branch!==BRANCH||!clean)errors.push("BRANCH_OR_WORKTREE_UNVERIFIED");
 if(project!==PROJECT)errors.push("ACTIVE_PROJECT_MISMATCH");
 for(const name of TARGETS){
  if(!source.includes("exports."+name+"=onCall(")||!source.includes("serviceAccount:PUBLIC_PILOT_RUNTIME_SA"))
   errors.push("SOURCE_PILOT_TARGET_NOT_VERIFIED_"+name);
 }
 if(!source.includes('const V72_PILOT_ENABLED=process.env.PACKTOOK_V72_PILOT_ENABLED==="true";'))
  errors.push("PILOT_ENV_SWITCH_UNVERIFIED");
 if(!cliAvailable)errors.push("FIREBASE_CLI_NOT_AVAILABLE");
 const p=publicProbe||{};
 if(p.closed!==true||p.explicitEnabledSeen===true||p.marketingHttp!==200||
   p.customerHttp!==200||p.statusHttp!==200||
   p.publicSignupEnabled!==false||p.publicAccessEnabled!==false)
  errors.push("FRESH_PUBLIC_OFF_NOT_VERIFIED");
 if(status?.deployed!==true||status.state!=="ACTIVE")errors.push("EXISTING_PUBLIC_STATUS_NOT_ACTIVE");
 if(status?.serviceAccountClass!=="LEGACY_COMPUTE"||status.secretBound!==false)
  errors.push("PUBLIC_STATUS_BASELINE_CHANGED_REVIEW");
 // Existing public status has no change in this admission-only target set.
 if(pilots.length!==2||pilots.some(x=>x.deployed!==false||x.inspectionError!=="NOT_FOUND"))
  errors.push("PILOT_TARGETS_NOT_PROVEN_ABSENT");
 if(serviceAccountActive!==true)errors.push("DEDICATED_SA_NOT_CONFIRMED_ACTIVE");
 if(roleVerified!==true||secretGrantVerified!==true)
  errors.push("SCOPED_RUNTIME_IAM_NOT_CONFIRMED");
 return {pass:errors.length===0,errors,
  proposedTargetSelector:"functions:beta:pilotInvitationStatus,functions:beta:completePilotFreeSignup",
  productionDeployPerformed:false,deployAuthorized:false,pilotAuthorized:false,
  existingStatusRevisionWillBeChanged:false,
  decision:"NO_GO_CONTROLLED_PILOT"};
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("SAFETY BLOCK: exact project argument required");process.exitCode=2;
 }else{
  const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
  const config=JSON.parse(fs.readFileSync(new URL("../firebase.json",import.meta.url),"utf8"));
  // Public HTTPS probe FIRST: synchronous child-process execution must not block it.
  const evidence=await readPublicSafetyEvidence();
  const branch=run("git",["branch","--show-current"]);
  const dirty=run("git",["status","--porcelain"]);
  const project=run("gcloud",["config","get-value","project"]);
  const cli=run("firebase",["--version"],15000);
  const sa=run("gcloud",["iam","service-accounts","describe",SA,"--project="+PROJECT,"--format=json"]);
  const role=run("gcloud",["iam","roles","describe","packtookV72Runtime","--project="+PROJECT,"--format=json"]);
  const projPolicy=run("gcloud",["projects","get-iam-policy",PROJECT,"--format=json"]);
  const secretPolicy=run("gcloud",["secrets","get-iam-policy","PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX","--project="+PROJECT,"--format=json"]);
  let saActive=false,roleVerified=false,secretGrantVerified=false;
  try{
   const d=JSON.parse(sa.text);saActive=sa.ok&&d.email===SA&&d.disabled!==true;
  }catch{}
  try{
   const d=JSON.parse(role.text),p=new Set(d.includedPermissions||[]);
   roleVerified=role.ok&&["datastore.databases.get","datastore.entities.get",
    "datastore.entities.create","datastore.entities.update",
    "firebaseauth.users.get","firebaseauth.users.update"].every(x=>p.has(x))&&p.size===6;
   const iam=JSON.parse(projPolicy.text);
   roleVerified=roleVerified&&projPolicy.ok&&(iam.bindings||[]).some(b=>
    b.role==="projects/"+PROJECT+"/roles/packtookV72Runtime"&&
    (b.members||[]).includes("serviceAccount:"+SA)&&!b.condition);
  }catch{roleVerified=false}
  try{
   const iam=JSON.parse(secretPolicy.text);
   secretGrantVerified=secretPolicy.ok&&(iam.bindings||[]).some(b=>
    b.role==="roles/secretmanager.secretAccessor"&&
    (b.members||[]).includes("serviceAccount:"+SA)&&!b.condition);
  }catch{}
  const status=cloudFunction(STATUS),pilots=TARGETS.map(cloudFunction);
  const outcome=assess({source,config,branch:branch.text?.trim(),clean:dirty.ok&&dirty.text.trim()==="",
   project:project.text?.trim(),publicProbe:evidence.diagnostic,status,pilots,
   serviceAccountActive:saActive,roleVerified,secretGrantVerified,cliAvailable:cli.ok});
  console.log(JSON.stringify({
   version:"7.2",mode:"READ_ONLY_ADMISSION_DEPLOYMENT_PREFLIGHT",
   project:PROJECT,codebase:"beta",
   sourceTargets:TARGETS,publicOff:evidence.diagnostic?.closed===true,
   publicHttp:{marketing:evidence.diagnostic?.marketingHttp??null,
     customer:evidence.diagnostic?.customerHttp??null,status:evidence.diagnostic?.statusHttp??null},
   identityAndIam:{saActive,customRoleBound:roleVerified,secretAccessorBound:secretGrantVerified},
   baseline:{publicSignupStatus:status,pilotFunctions:pilots},
   rollback:{publicSignupStatusNotTargeted:true,
    admissionFunctionsPreviouslyAbsent:pilots.every(x=>x.deployed===false),
    removalWouldRequireSeparateOwnerApprovedChange:true,
    existingBetaFunctionsNotTargeted:true},
   ...outcome
  },null,2));
  if(!outcome.pass)process.exitCode=2;
 }
}
