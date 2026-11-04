// PACKTOOK V7.2 — READ-ONLY pre-creation sandbox readiness.
// No project creation, billing association, IAM, API activation or deploy.
// Does not query the production project. Project ID is an explicit sandbox candidate.
import {execFileSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const PROD="packtook-prod-01";
const PREFIX="packtook-v72-sandbox-";
export function evaluate({projectId,projectLookup,billingAccounts,budgetAudits,cli,branch,clean}){
 const blockers=[],pending=[];
 if(!new RegExp("^"+PREFIX+"[a-z0-9-]{2,22}$").test(projectId)||
    projectId.length>30||projectId===PROD)
   blockers.push("INVALID_SANDBOX_PROJECT_ID");
 if(branch!=="feature/v7.2-controlled-public-pilot-readiness"||!clean)
   blockers.push("SOURCE_BRANCH_OR_WORKTREE_UNVERIFIED");
 if(!cli)blockers.push("GCLOUD_UNAVAILABLE");
 if(projectLookup==="EXISTS")blockers.push("PROJECT_ID_ALREADY_EXISTS");
 if(projectLookup!=="EXISTS")pending.push("PROJECT_ID_AVAILABILITY_NOT_PROVEN");
 const open=(billingAccounts||[]).filter(x=>x.open===true);
 if(!open.length)blockers.push("NO_READABLE_OPEN_BILLING_ACCOUNT");
 if(!budgetAudits?.length||budgetAudits.some(x=>x.status!=="READABLE"))
  pending.push("BILLING_BUDGET_PERMISSIONS_OR_INVENTORY_UNVERIFIED");
 pending.push("PROJECT_CREATOR_PERMISSION_ON_PARENT_NOT_VERIFIED");
 pending.push("BILLING_PROJECT_LINK_PERMISSION_NOT_VERIFIED");
 pending.push("SANDBOX_ONLY_BUDGET_ALERT_CONFIGURATION_NOT_CREATED");
 pending.push("SANDBOX_COST_CEILING_AND_OWNER_APPROVAL_PENDING");
 pending.push("SANDBOX_IAM_CLOUD_RUN_API_AND_QUOTA_NOT_VERIFIED");
 return {inventoryPass:blockers.length===0,blockers,pending,
  createProjectAuthorized:false,billingLinkAuthorized:false,
  sandboxWrites:false,productionWrites:false,
  decision:"NO_GO_SANDBOX_MUTATIONS_AND_NO_GO_CONTROLLED_PILOT"};
}
function cmd(bin,args,ms=20000){
 try{return {ok:true,text:execFileSync(bin,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:ms,maxBuffer:1024*1024}).trim()}}
 catch(e){return {ok:false,kind:/PERMISSION_DENIED|403|permission/i.test(String(e.stderr||""))?"PERMISSION_DENIED":
   /not found|NOT_FOUND|404/i.test(String(e.stderr||""))?"NOT_FOUND":"UNKNOWN"}}
}
function json(bin,args,ms){const r=cmd(bin,args,ms);if(!r.ok)return {ok:false,kind:r.kind};
 try{return {ok:true,value:JSON.parse(r.text)}}catch{return {ok:false,kind:"INVALID_JSON"}}}
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 const id=process.argv[2]||"";
 if(process.argv.length!==3||!new RegExp("^"+PREFIX+"[a-z0-9-]{2,22}$").test(id)||
    id.length>30||id===PROD){
  console.error("SAFETY BLOCK: supply only a candidate packtook-v72-sandbox-... ID");
  process.exitCode=2;
 }else{
  const branch=cmd("git",["branch","--show-current"]);
  const dirty=cmd("git",["status","--porcelain"]);
  const cli=cmd("gcloud",["--version"],10000);
  // Look up ONLY the proposed sandbox project, never the Production project.
  const lookup=json("gcloud",["projects","describe",id,"--format=json"]);
  const projectLookup=lookup.ok?"EXISTS":lookup.kind==="NOT_FOUND"?"NOT_FOUND_UNPROVEN":"UNKNOWN_UNVERIFIED";
  // Account listings are account-level reads. Output masks billing IDs.
  const accounts=json("gcloud",["billing","accounts","list","--format=json"],30000);
  const readable=accounts.ok&&Array.isArray(accounts.value)?accounts.value:[];
  const available=readable.map((x,i)=>({
    index:i+1,open:x.open===true,
    maskedId:typeof x.name==="string"?"..."+x.name.slice(-4):"NOT_PROVIDED",
    name:x.displayName||null
  }));
  // Probe only OPEN billing accounts, no credentials, budget amounts or IAM policy content.
  const audits=readable.filter(x=>x.open===true&&x.name).slice(0,5).map(x=>{
   const account=x.name.replace(/^billingAccounts\//,"");
   const budgets=json("gcloud",["billing","budgets","list",
    "--billing-account="+account,"--format=json"],30000);
   return {maskedId:"..."+account.slice(-4),
     status:budgets.ok?"READABLE":budgets.kind||"UNKNOWN",
     numberOfVisibleBudgets:budgets.ok&&Array.isArray(budgets.value)?budgets.value.length:null,
     // A billing-account-wide budget is NOT evidence of sandbox scoped alerts.
     sandboxBudgetExists:false};
  });
  const result=evaluate({projectId:id,projectLookup,
   billingAccounts:readable.map(x=>({open:x.open===true})),
   budgetAudits:audits,cli:cli.ok,branch:branch.text,clean:dirty.ok&&dirty.text===""});
  console.log(JSON.stringify({
   mode:"V72_SANDBOX_PRECREATE_READ_ONLY",proposedSandboxId:id,
   productionProjectTouched:false,productionProject:PROD,
   projectLookup,billingAccountListReadable:accounts.ok,
   billingAccounts:available,budgetAudits:audits,
   parentOrganizationOrFolderNotSelected:true,
   // A missing project cannot have its own IAM/API/budget audit yet.
   ...result
  },null,2));
  if(!result.inventoryPass)process.exitCode=2;
 }
}
