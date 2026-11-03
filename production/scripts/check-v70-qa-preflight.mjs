// PACKTOOK V7.0 — read-only production QA env validation.
// Must NEVER turn on public signup or deploy services. Does not log UID/App ID.
// Usage: node scripts/check-v70-qa-preflight.mjs packtook-prod-01 --qa-off|--approved-qa
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {evaluateFiles} from "./check-public-status-rollout.mjs";
const PROJECT="packtook-prod-01";
const KEYS=["PACKTOOK_V7_QA_ENABLED","PACKTOOK_V7_QA_UID",
 "PACKTOOK_V7_QA_APP_ID","PACKTOOK_V7_QA_EXPIRES_AT"];
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
function getRelevant(config){
 const data={};
 for(const [i,line] of config.split(/\r?\n/).entries()){
  if(/^\s*(?:#|$)/.test(line))continue;
  const m=line.match(/^\s*(PACKTOOK_[A-Z0-9_]+)\s*=\s*(.*?)\s*(?:#.*)?$/);
  if(!m){
   if(/PACKTOOK_V7_QA_/.test(line))throw Error("SAFETY BLOCK: unrecognized V7 QA environment line "+(i+1));
   continue;
  }
  if(!KEYS.includes(m[1]))continue;
  if(Object.hasOwn(data,m[1]))throw Error("SAFETY BLOCK: duplicate "+m[1]);
  data[m[1]]=m[2].replace(/^["']|["']$/g,"").trim();
 }
 return data;
}
export function checkQaEnvironment({generic="",specific,environment={},mode,now=Date.now(),expectedAppId=null}){
 if(mode!=="--qa-off"&&mode!=="--approved-qa")
  throw Error("SAFETY BLOCK: select --qa-off or --approved-qa");
 if(typeof specific!=="string")throw Error("SAFETY BLOCK: exact project Functions dotenv file required");
 const publicReport=evaluateFiles({".env":generic,[".env."+PROJECT]:specific},environment);
 const gen=getRelevant(generic),qa=getRelevant(specific);
 if(Object.keys(gen).length)throw Error("SAFETY BLOCK: V7 QA flags must NOT be set in generic Functions .env");
 for(const key of KEYS){
  if(environment[key]&&environment[key]!==qa[key])
   throw Error("SAFETY BLOCK: shell "+key+" overrides project QA env");
 }
 const enabled=qa.PACKTOOK_V7_QA_ENABLED==="true";
 if(qa.PACKTOOK_V7_QA_ENABLED&& !["true","false"].includes(qa.PACKTOOK_V7_QA_ENABLED))
  throw Error("SAFETY BLOCK: V7 QA enabled flag must be true or false");
 if(mode==="--qa-off"){
  if(enabled)throw Error("SAFETY BLOCK: QA must be OFF for disabled prelaunch deploy");
  return {pass:true,project:PROJECT,mode,publicFlagsOff:publicReport.allPublicFlagsOff,
   qaEnabled:false,qaUidConfigured:false,expiresAt:null};
 }
 if(!enabled)throw Error("SAFETY BLOCK: QA must explicitly be enabled for approved invite test");
 if(!/^[A-Za-z0-9_-]{20,128}$/.test(qa.PACKTOOK_V7_QA_UID||""))
  throw Error("SAFETY BLOCK: invite requires a SINGLE exact Firebase Auth UID (20–128 characters)");
 if(!/^1:[0-9]+:web:[A-Za-z0-9]+$/.test(qa.PACKTOOK_V7_QA_APP_ID||""))
  throw Error("SAFETY BLOCK: QA app ID must be exact Production Firebase Web App ID");
 if(expectedAppId!==null&&qa.PACKTOOK_V7_QA_APP_ID!==expectedAppId)
  throw Error("SAFETY BLOCK: QA App ID must match exact local Production Customer Web App");
 const expires=Date.parse(qa.PACKTOOK_V7_QA_EXPIRES_AT||"");
 if(!Number.isFinite(expires)||expires<=now||expires>now+48*60*60*1000)
  throw Error("SAFETY BLOCK: QA expiresAt must be in the next 48 hours");
 if(!/Z$/.test(qa.PACKTOOK_V7_QA_EXPIRES_AT))
  throw Error("SAFETY BLOCK: QA expiry must be a UTC ISO timestamp ending Z");
 return {pass:true,project:PROJECT,mode,publicFlagsOff:publicReport.allPublicFlagsOff,
   qaEnabled:true,qaUidConfigured:true,qaAppIdConfigured:true,
   expiresAt:new Date(expires).toISOString()};
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  if(process.argv.length!==4||process.argv[2]!==PROJECT)
   throw Error("Usage: node scripts/check-v70-qa-preflight.mjs packtook-prod-01 --qa-off|--approved-qa");
  const specificPath=path.join(ROOT,"functions",".env."+PROJECT);
  if(!fs.existsSync(specificPath))throw Error("SAFETY BLOCK: project-specific Functions env file missing");
  const genericPath=path.join(ROOT,"functions",".env");
  let expectedAppId=null;
  if(process.argv[3]==="--approved-qa"){
   const customerConfig=fs.readFileSync(path.join(ROOT,"app","firebase-v4-config.js"),"utf8");
   const customerConfigMatch=customerConfig.match(/export const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
   if(!customerConfigMatch)throw Error("SAFETY BLOCK: verified Production Firebase config missing");
   const verified=JSON.parse(customerConfigMatch[1]);
   if(verified.projectId!==PROJECT||!verified.appId)
    throw Error("SAFETY BLOCK: Firebase SDK Production project mismatch");
   expectedAppId=verified.appId;
  }
  const report=checkQaEnvironment({
   generic:fs.existsSync(genericPath)?fs.readFileSync(genericPath,"utf8"):"",
   specific:fs.readFileSync(specificPath,"utf8"),
   mode:process.argv[3],environment:process.env,expectedAppId
  });
  const src=fs.readFileSync(path.join(ROOT,"functions","index.js"),"utf8");
  if(!src.includes('exports.qaFreeStatus=onCall({...options,enforceAppCheck:true}')||
    !src.includes('exports.completeQaFreeSignup=onCall({...options,enforceAppCheck:true}'))
   throw Error("SAFETY BLOCK: protected QA Function sources missing");
  console.log("PASS: V7.0 Production QA preflight");
  console.log(JSON.stringify(report,null,2));
  console.log("This script is READ-ONLY and never enables public accounts.");
 }catch(e){console.error(e.message);process.exitCode=2}
}
