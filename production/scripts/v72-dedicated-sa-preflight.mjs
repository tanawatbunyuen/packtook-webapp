// PACKTOOK V7.2 — exact intended dedicated Public/Pilot service account,
// READ-ONLY metadata check. Never creates an SA or grants IAM.
// Usage: node scripts/v72-dedicated-sa-preflight.mjs packtook-prod-01
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {verifySourceBinding,auditWithRunner} from "./v72-secret-iam-audit.mjs";
import {readPublicSafetyEvidence} from "./v72-secret-changeplan.mjs";

export const PROJECT="packtook-prod-01";
export const REGION="asia-southeast1";
export const ACCOUNT_ID="packtook-public-pilot-v72";
export const ACCOUNT=ACCOUNT_ID+"@"+PROJECT+".iam.gserviceaccount.com";
const SECRET="PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX";
const exactCommand=["iam","service-accounts","describe",ACCOUNT,
 "--project="+PROJECT,"--format=json"];

function categorize(error){
 if(error?.code==="ENOENT")return "CLI_NOT_FOUND";
 const message=String(error?.stderr||error?.message||"").slice(0,1500);
 if(/permission.denied|PERMISSION_DENIED|403|not have permission|does not have permission|insufficient permission/i.test(message))
  return "PERMISSION_DENIED";
 if(/NOT_FOUND|not found|404|does not exist|was not found/i.test(message))
  return "NOT_FOUND";
 if(/timed out|deadline exceeded|ETIMEDOUT/i.test(message))return "TIMEOUT";
 return "UNVERIFIED";
}
export function readServiceAccountMetadata(command,args,runner=execFileSync){
 if(command!=="gcloud"||JSON.stringify(args)!==JSON.stringify(exactCommand))
  throw Error("SAFETY BLOCK: only exact dedicated account metadata lookup allowed");
 try{
  const raw=runner(command,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],
   timeout:25000,maxBuffer:1024*1024});
  return {ok:true,data:JSON.parse(raw),error:null};
 }catch(error){return {ok:false,data:null,error:categorize(error)}}
}

export function assessDedicatedSaPreflight({source,audit,publicEvidence,serviceAccount}){
 const binding=verifySourceBinding(source);
 const cloud=serviceAccount||{ok:false,error:"UNVERIFIED"};
 // Account existence is distinct from metadata permission errors. Never
 // recommend create if a 403, timeout or malformed account response occurs.
 const metadata=cloud.ok===true?cloud.data||{}:null;
 const expectedResource="projects/"+PROJECT+"/serviceAccounts/"+ACCOUNT;
 const idValid=cloud.ok===true&&metadata?.email===ACCOUNT&&
  (metadata?.name===expectedResource||metadata?.name===undefined);
 const exists=idValid||cloud.ok===false&&cloud.error!=="NOT_FOUND"?null:false;
 const accountExists=idValid?true:cloud.ok===false&&cloud.error==="NOT_FOUND"?false:null;
 const accountActive=accountExists===true?metadata?.disabled===false:null;
 const p=publicEvidence?.diagnostic||{};
 const publicClosed=p.closed===true&&p.explicitEnabledSeen===false;
 const secretReady=audit?.secret?.resourcePresent===true&&
  audit?.secret?.versionsInspected===true&&audit?.secret?.enabledVersionCount>0;
 const fn=audit?.cloudFunctions||[];
 const noUnexpectedPilot=["pilotInvitationStatus","completePilotFreeSignup"]
  .every(n=>fn.find(x=>x.name===n)?.deployed!==true);
 const statusPresent=fn.find(x=>x.name==="publicSignupStatus")?.deployed===true;
 const errors=[];
 if(!binding.pass)errors.push("FOUR_CALLABLE_DEDICATED_SOURCE_BINDING_INVALID");
 if(!publicClosed)errors.push("PUBLIC_FLAGS_OR_HOSTING_NOT_VERIFIED_OFF");
 if(!secretReady)errors.push("SECRET_NOT_VERIFIED_ENABLED");
 if(!statusPresent)errors.push("CURRENT_PUBLIC_STATUS_NOT_VERIFIED");
 if(!noUnexpectedPilot)errors.push("PILOT_ALREADY_DEPLOYED");
 if(accountExists===null)errors.push("PROPOSED_SERVICE_ACCOUNT_EXISTENCE_UNKNOWN");
 if(accountExists===true&&accountActive!==true)
  errors.push("PROPOSED_SERVICE_ACCOUNT_DISABLED_OR_UNVERIFIED");
 const phase=errors.length?"DEDICATED_SA_REVIEW_BLOCKED":
  accountExists===false?"DEDICATED_SA_CREATION_APPROVAL_REQUIRED":
  "DEDICATED_SA_EXISTS_PERMISSIONS_AND_DEPLOY_REVIEW_REQUIRED";
 return {version:"7.2",project:PROJECT,region:REGION,
  mode:"DEDICATED_SERVICE_ACCOUNT_METADATA_READ_ONLY",
  phase,
  source:{fourFunctionBindingVerified:binding.pass,
   betaSharedOptionsUnchanged:binding.checks.betaSharedOptionsUnchanged===true},
  publicProbe:{closed:publicClosed,reasons:Array.isArray(p.reasons)?p.reasons:[]},
  secret:{resourcePresent:audit?.secret?.resourcePresent===true,
   hasEnabledVersion:audit?.secret?.enabledVersionCount>0},
  account:{metadataReadable:cloud.ok===true,resourcePresent:accountExists,
   inspectionError:cloud.ok===true?null:cloud.error??"UNVERIFIED",
   active:accountActive,rawEmailPrinted:false},
  candidateForSeparateSAOnlyApproval:phase==="DEDICATED_SA_CREATION_APPROVAL_REQUIRED",
  accountCreationAuthorized:false,accountCreationPerformed:false,
  secretIamGrantAuthorized:false,firestoreIamGrantAuthorized:false,
  firebaseAuthIamGrantAuthorized:false,functionsDeployAuthorized:false,
  publicPilotFlagsAuthorized:false,readyForPilot:false,readyForPublic:false,
  decision:"NO_GO_CONTROLLED_PILOT",errors,
  note:"Proposed one service account is NOT created by source pinning. No role grants, keys, impersonation, functions deploy, Secret payload access or Public/Pilot flag changes."
 };
}

const isMain=process.argv[1]&&
 path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("SAFETY BLOCK: exact Production project required");
  process.exitCode=2;
 }else{
  const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
  const [publicEvidence,audit,serviceAccount]=await Promise.all([
   readPublicSafetyEvidence(),
   Promise.resolve().then(()=>auditWithRunner(source)),
   Promise.resolve().then(()=>readServiceAccountMetadata("gcloud",exactCommand))
  ]);
  const report=assessDedicatedSaPreflight({source,audit,publicEvidence,serviceAccount});
  console.log(JSON.stringify(report,null,2));
  console.log("RESULT: V7.2 DEDICATED SA READ-ONLY — NO IAM/SA/DEPLOY WRITES / NO-GO");
  if(report.errors.length)process.exitCode=2;
 }
}
