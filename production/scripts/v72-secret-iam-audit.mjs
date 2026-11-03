// PACKTOOK V7.2 — Production Secret Manager / IAM READ-ONLY metadata audit.
// Exact project and named Secret only. No secrets versions access, IAM writes,
// deploy, Auth/Firestore/Billing writes, env dumps, account IDs or emails printed.
// Usage: node scripts/v72-secret-iam-audit.mjs packtook-prod-01
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";

export const PROJECT="packtook-prod-01";
export const REGION="asia-southeast1";
export const SECRET="PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX";
const FUNCTIONS=["publicSignupStatus","completeFreeSignup",
 "pilotInvitationStatus","completePilotFreeSignup"];
const sourceFile=new URL("../functions/index.js",import.meta.url);

export function verifySourceBinding(source){
 const uses={
  secretDefinition:source.includes('defineSecret("'+SECRET+'")'),
  statusBinding:source.includes(
   "exports.publicSignupStatus=onCall({...options,secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]}"),
  publicSignupBinding:source.includes(
   "exports.completeFreeSignup=onCall({...options,enforceAppCheck:true,secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]}"),
  pilotStatusBinding:source.includes(
   "exports.pilotInvitationStatus=onCall({...options,enforceAppCheck:true,\n secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]}"),
  pilotSignupBinding:source.includes(
   "exports.completePilotFreeSignup=onCall({...options,enforceAppCheck:true,\n secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]}"),
  runtimeAccessor:source.includes("PUBLIC_FREE_EMAIL_HMAC_SECRET.value()"),
  noEnvironmentBypass:!source.includes("process.env."+SECRET)
 };
 return {pass:Object.values(uses).every(Boolean),checks:uses};
}
function classifyError(error){
 if(error?.code==="ENOENT")return "CLI_NOT_FOUND";
 const message=String(error?.stderr||error?.message||"").slice(0,1500);
 if(/PERMISSION_DENIED|permission denied|403|not have permission|does not have permission|insufficient permission/i.test(message))
  return "PERMISSION_DENIED";
 if(/NOT_FOUND|not found|404|does not exist|was not found|resource.*missing/i.test(message))
  return "NOT_FOUND";
 if(/deadline exceeded|timed out|ETIMEDOUT/i.test(message))return "TIMEOUT";
 return "UNVERIFIED";
}
// Only approved read-only commands, exact project/region/resource constants.
// NEVER log or persist stdout/stderr, which could include IAM member identities.
export function readMetadata(command,args,runner=execFileSync){
 const allowed=[
  ["secrets","describe",SECRET,"--project="+PROJECT,"--format=json"],
  ["secrets","versions","list",SECRET,"--project="+PROJECT,"--format=json"],
  ["secrets","get-iam-policy",SECRET,"--project="+PROJECT,"--format=json"],
  ["projects","get-iam-policy",PROJECT,"--format=json"],
  ...FUNCTIONS.map(name=>["functions","describe",name,"--gen2",
   "--region="+REGION,"--project="+PROJECT,"--format=json"])
 ];
 if(command!=="gcloud"||!allowed.some(a=>JSON.stringify(a)===JSON.stringify(args)))
  throw Error("SAFETY BLOCK: unapproved metadata command");
 try{
  const raw=runner(command,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],
   timeout:25000,maxBuffer:5*1024*1024});
  const parsed=JSON.parse(raw);
  return {ok:true,data:parsed,error:null};
 }catch(error){return {ok:false,data:null,error:classifyError(error)}}
}
function entries(value){return Array.isArray(value)?value:[]}
function safeBindings(policy){
 return entries(policy?.bindings).filter(b=>b&&typeof b.role==="string");
}
const elevatedRoles=new Set(["roles/owner","roles/editor",
 "roles/secretmanager.admin","roles/secretmanager.secretAccessor"]);
function matchBinding(policy,member,role){
 const b=safeBindings(policy).filter(b=>b.role===role&&entries(b.members).includes(member));
 return {present:b.length>0,unconditional:b.some(x=>!x.condition),
  conditional:b.some(x=>!!x.condition)};
}
function hasBroadGrant(policy){
 return safeBindings(policy).some(b=>elevatedRoles.has(b.role)&&
  entries(b.members).some(member=>member==="allUsers"||member==="allAuthenticatedUsers"));
}
function describeFunction(name,query){
 if(!query?.ok)return {name,deployed:null,metadataReadable:false,
  inspectionError:query?.error??"NOT_INSPECTED",secretBound:null,
  runtimeServiceAccountKnown:false};
 const data=query.data||{};
 const config=data.serviceConfig||{};
 const secrets=[...entries(config.secretEnvironmentVariables),
  ...entries(config.secretVolumes)];
 const bound=secrets.some(x=>x.secret===SECRET||
  String(x.secret||"").endsWith("/secrets/"+SECRET));
 const principal=typeof config.serviceAccountEmail==="string"?
  config.serviceAccountEmail.trim():"";
 return {name,deployed:true,metadataReadable:true,
  inspectionError:null,secretBound:bound,
  runtimeServiceAccountKnown:principal.length>0,
  // Private, NEVER printed by summarizeAudit().
  _runtimeMember:principal?"serviceAccount:"+principal:null};
}
export function summarizeAudit({source,secret,versions,secretIam,projectIam,functionsByName}){
 const sourceCheck=verifySourceBinding(source);
 const secretPresent=secret?.ok===true;
 const versionsReadable=versions?.ok===true;
 const enabledVersionCount=versionsReadable?
  entries(versions.data).filter(v=>v.state==="ENABLED").length:null;
 const functions=FUNCTIONS.map(name=>describeFunction(name,functionsByName?.[name]));
 const deployed=functions.filter(f=>f.deployed===true);
 const runtimeMembers=[...new Set(deployed.map(f=>f._runtimeMember).filter(Boolean))];
 const secretPolicyReadable=secretIam?.ok===true;
 const projectPolicyReadable=projectIam?.ok===true;
 const IAM=runtimeMembers.map(member=>{
  const secret=secretPolicyReadable?matchBinding(secretIam.data,member,
   "roles/secretmanager.secretAccessor"):null;
  const project=projectPolicyReadable?matchBinding(projectIam.data,member,
   "roles/secretmanager.secretAccessor"):null;
  return {
   scope:"DEPLOYED_FUNCTION_RUNTIME",
   directSecretAccessor:secret?.unconditional??null,
   conditionalSecretAccessor:secret?.conditional??null,
   projectSecretAccessor:project?.unconditional??null,
   // Only documentary evidence. Effective access may depend on org policies,
   // conditional grants, group membership, impersonation, or other roles.
   effectiveAccessProven:false
  };
 });
 const checks={
  sourceSecretBinding:sourceCheck.pass,
  secretResourcePresent:secretPresent,
  secretVersionsInspected:versionsReadable,
  hasEnabledVersion:enabledVersionCount===null?null:enabledVersionCount>0,
  secretIAMPolicyReadable:secretPolicyReadable,
  projectIAMPolicyReadable:projectPolicyReadable,
  deployedPublicStatus:functions.find(f=>f.name==="publicSignupStatus")?.deployed??null,
  deployedPublicSignup:functions.find(f=>f.name==="completeFreeSignup")?.deployed??null,
  publicStatusSecretBound:functions.find(f=>f.name==="publicSignupStatus")?.secretBound??null,
  publicSignupSecretBound:functions.find(f=>f.name==="completeFreeSignup")?.secretBound??null,
  pilotStatusDeployed:functions.find(f=>f.name==="pilotInvitationStatus")?.deployed??null,
  pilotSignupDeployed:functions.find(f=>f.name==="completePilotFreeSignup")?.deployed??null,
  runtimeAccountsIdentified:deployed.length>0&&
   deployed.every(f=>f.runtimeServiceAccountKnown),
  identityCount:runtimeMembers.length,
  secretPolicyBroadGrant:secretPolicyReadable?hasBroadGrant(secretIam.data):null,
  projectPolicyBroadGrant:projectPolicyReadable?hasBroadGrant(projectIam.data):null
 };
 const blockers=[];
 if(!checks.sourceSecretBinding)blockers.push("SOURCE_SECRET_BINDING_CONTRACT_FAILED");
 if(!secretPresent)blockers.push("SECRET_RESOURCE_NOT_VERIFIED");
 if(!versionsReadable||checks.hasEnabledVersion!==true)
  blockers.push("ENABLED_SECRET_VERSION_NOT_VERIFIED");
 if(!secretPolicyReadable||!projectPolicyReadable)
  blockers.push("IAM_POLICY_METADATA_NOT_FULLY_READABLE");
 if(!checks.runtimeAccountsIdentified)
  blockers.push("FUNCTION_RUNTIME_SERVICE_ACCOUNT_NOT_VERIFIED");
 if(checks.publicStatusSecretBound!==true||checks.publicSignupSecretBound!==true)
  blockers.push("DEPLOYED_PUBLIC_FUNCTION_SECRET_BINDINGS_NOT_VERIFIED");
 if(IAM.some(x=>x.directSecretAccessor!==true&&x.projectSecretAccessor!==true))
  blockers.push("DIRECT_RUNTIME_SECRET_ACCESSOR_GRANT_NOT_PROVEN");
 if(checks.secretPolicyBroadGrant===true||checks.projectPolicyBroadGrant===true)
  blockers.push("OVERBROAD_SECRET_POLICY_REVIEW_REQUIRED");
 if(checks.pilotStatusDeployed===true||checks.pilotSignupDeployed===true)
  blockers.push("PILOT_FUNCTION_ALREADY_DEPLOYED_OWNER_REVIEW_REQUIRED");
 blockers.push("EFFECTIVE_SECRET_RUNTIME_ACCESS_NOT_PROVEN");
 blockers.push("SECURITY_IAM_HIERARCHY_CONDITIONS_AND_ROTATION_OWNER_REVIEW_REQUIRED");
 blockers.push("MONITORING_BILLING_PDPA_REAL_BROWSER_AND_PILOT_GO_PENDING");
 const safeFns=functions.map(({_runtimeMember,...f})=>f);
 const metadataInspectionComplete=secretPresent&&versionsReadable&&
  secretPolicyReadable&&projectPolicyReadable&&
  functions.every(x=>x.metadataReadable||x.inspectionError==="NOT_FOUND");
 const metadataFindingsPass=metadataInspectionComplete&&sourceCheck.pass&&
  enabledVersionCount>0&&checks.deployedPublicStatus===true&&
  checks.deployedPublicSignup===true&&checks.publicStatusSecretBound===true&&
  checks.publicSignupSecretBound===true&&checks.runtimeAccountsIdentified&&
  IAM.length>0&&IAM.every(x=>
   x.directSecretAccessor===true||x.projectSecretAccessor===true)&&
  checks.secretPolicyBroadGrant===false&&checks.projectPolicyBroadGrant===false&&
  checks.pilotStatusDeployed!==true&&checks.pilotSignupDeployed!==true;
 return {
  project:PROJECT,region:REGION,version:"7.2",mode:"CLOUD_METADATA_READ_ONLY",
  secretName:SECRET,
  source:sourceCheck,
  secret:{resourcePresent:secretPresent,
   inspectionError:secretPresent?null:secret?.error??"NOT_INSPECTED",
   versionsInspected:versionsReadable,versionsError:versionsReadable?null:
    versions?.error??"NOT_INSPECTED",enabledVersionCount,
   // Don't expose replication policy or payload.
   payloadRead:false},
  cloudFunctions:safeFns,
  iam:{secretPolicyReadable,secretPolicyError:secretPolicyReadable?null:
    secretIam?.error??"NOT_INSPECTED",
   projectPolicyReadable,projectPolicyError:projectPolicyReadable?null:
    projectIam?.error??"NOT_INSPECTED",
   deployedRuntimeIdentityCount:runtimeMembers.length,
   runtimeBindings:IAM,rawPrincipalsReturned:false,
   effectiveRuntimeAccessVerified:false},
  checks,metadataInspectionComplete,metadataFindingsPass,
  readyForPilot:false,readyForPublic:false,
  decision:"NO_GO_CONTROLLED_PILOT",blockers,
  note:"Metadata and policy bindings do not prove effective runtime Secret access. No payload was read; missing Pilot functions can be expected while Pilot is not deployed."
 };
}
export function auditWithRunner(source,runner=execFileSync){
 const g=(...a)=>readMetadata("gcloud",a,runner);
 const secret=g("secrets","describe",SECRET,"--project="+PROJECT,"--format=json");
 const versions=g("secrets","versions","list",SECRET,"--project="+PROJECT,"--format=json");
 const secretIam=g("secrets","get-iam-policy",SECRET,
  "--project="+PROJECT,"--format=json");
 const projectIam=g("projects","get-iam-policy",PROJECT,"--format=json");
 const functionsByName={};
 for(const name of FUNCTIONS)
  functionsByName[name]=g("functions","describe",name,"--gen2",
   "--region="+REGION,"--project="+PROJECT,"--format=json");
 return summarizeAudit({source,secret,versions,secretIam,projectIam,functionsByName});
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("SAFETY BLOCK: exact packtook-prod-01 required");
  process.exitCode=2;
 }else{
  const source=fs.readFileSync(sourceFile,"utf8");
  const report=auditWithRunner(source);
  console.log(JSON.stringify(report,null,2));
  console.log("RESULT: PACKTOOK V7.2 SECRET/IAM METADATA AUDIT NO-GO (read-only)");
  if(!report.metadataFindingsPass)process.exitCode=2;
 }
}
