// PACKTOOK V7.2: sandbox project-only Cloud Run rehearsal PREVIEW.
// Always read-only. Prints a plan; never deploys, routes or creates resources.
// Requires separately provisioned project with this dedicated prefix and
// gcloud active project to match it. Production ID is rejected.
import {execFileSync} from "node:child_process";
const PREFIX="packtook-v72-sandbox-";
const PROD="packtook-prod-01";
const REGION="asia-southeast1";
const SERVICE="packtook-v72-rollback-sandbox";
const project=process.argv[2]||"";
function fail(m){console.error("SAFETY BLOCK: "+m);process.exit(2)}
function run(cmd,args){
 try{return {ok:true,out:execFileSync(cmd,args,{encoding:"utf8",
  stdio:["ignore","pipe","pipe"],timeout:25000}).trim()}}
 catch(e){return {ok:false,code:e.status??null}}
}
if(process.argv.length!==3)fail("usage: node scripts/v72-sandbox-rollback-plan.mjs packtook-v72-sandbox-<id>");
if(project===PROD||!new RegExp("^"+PREFIX+"[a-z0-9-]{4,25}$").test(project))
 fail("only explicitly named sandbox projects with prefix "+PREFIX+" are permitted");
const active=run("gcloud",["config","get-value","project"]);
if(!active.ok||active.out!==project)fail("active gcloud project MUST exactly match sandbox project");
const details=run("gcloud",["projects","describe",project,"--format=json"]);
if(!details.ok)fail("sandbox project does not exist or is not readable");
let cloud;
try{cloud=JSON.parse(details.out)}catch{fail("unreadable project metadata")}
if(cloud.projectId!==project||cloud.lifecycleState!=="ACTIVE")
 fail("sandbox project metadata mismatch/inactive");
const existing=run("gcloud",["run","services","describe",SERVICE,
 "--project="+project,"--region="+REGION,"--format=json"]);
if(existing.ok)fail("rehearsal service already exists: do not overwrite it");
const image="us-docker.pkg.dev/cloudrun/container/hello";
const base="gcloud run deploy "+SERVICE+" --project="+project+" --region="+REGION+
 " --image="+image+" --no-allow-unauthenticated";
console.log(JSON.stringify({
 mode:"READ_ONLY_SANDBOX_ROLLBACK_PLAN",project,region:REGION,
 dedicatedService:SERVICE,
 projectVerified:true,serviceNotPresent:true,
 sandboxProjectExplicit:true,productionProjectRejected:true,
 productionWrites:false,sandboxWrites:false,
 plannedMutationsRequireSeparateApproval:true,
 steps:[
  {step:"deploy A",command:base+" --set-env-vars=REHEARSAL_VERSION=A"},
  {step:"capture A revision",command:"gcloud run revisions list --service="+SERVICE+
   " --project="+project+" --region="+REGION+" --format=json"},
  {step:"deploy B no traffic",command:base+" --no-traffic --set-env-vars=REHEARSAL_VERSION=B"},
  {step:"capture B revision",command:"gcloud run revisions list --service="+SERVICE+
   " --project="+project+" --region="+REGION+" --format=json"},
  {step:"route to B only AFTER verifying both revision names",
   command:"gcloud run services update-traffic "+SERVICE+" --project="+project+
   " --region="+REGION+" --to-revisions=REVISION_B=100"},
  {step:"rollback to A after verifying B is serving 100",
   command:"gcloud run services update-traffic "+SERVICE+" --project="+project+
   " --region="+REGION+" --to-revisions=REVISION_A=100"},
  {step:"verify final traffic",command:"gcloud run services describe "+SERVICE+
   " --project="+project+" --region="+REGION+" --format=json"}
 ],
 warning:"PLANNING ONLY. Do NOT execute commands before sandbox billing/IAM, cost and scope approval. Replace placeholders with exact observed revision names. This does not authorize a Production deployment.",
 decision:"NO_GO_CONTROLLED_PILOT"
 },null,2));
