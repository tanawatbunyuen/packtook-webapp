// PACKTOOK V6.8.1 — READ-ONLY preflight for deploying publicSignupStatus ONLY.
// No network, Firebase CLI calls, writes or secret values printed.
// Run: node scripts/check-public-status-rollout.mjs packtook-prod-01
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const PUBLIC_KEYS=[
 "PACKTOOK_PUBLIC_SIGNUP_ENABLED",
 "PACKTOOK_PUBLIC_ACCESS_ENABLED",
 "PACKTOOK_PUBLIC_POLICIES_APPROVED"
];
const PROJECT="packtook-prod-01";
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
function parseRelevantEnv(text,file){
 const out={};
 for(const [i,line] of text.split(/\r?\n/).entries()){
  if(!line.trim()||line.trim().startsWith("#"))continue;
  const found=line.match(/^\s*(?:export\s+)?(PACKTOOK_[A-Z0-9_]+)\s*=\s*(.*)$/);
  if(!found){
   // Fail closed on lines mentioning the public configuration that cannot
   // be parsed reliably; never interpret them as safe defaults.
   if(/PACKTOOK_PUBLIC_|PACKTOOK_PRODUCTION_PROJECT_ID/.test(line))
    throw Error(file+":"+(i+1)+" has an unrecognized rollout environment declaration");
   continue;
  }
  const key=found[1];
  if(key!=="PACKTOOK_PRODUCTION_PROJECT_ID"&&!PUBLIC_KEYS.includes(key))continue;
  if(Object.hasOwn(out,key))throw Error("Duplicate "+key+" in "+file);
  let value=found[2].trim();
  // Treat inline comments only for unquoted values; strict is safer.
  if(value[0]==="'"||value[0]==='"'){
   const quote=value[0],last=value.lastIndexOf(quote);
   if(last<1||value.slice(last+1).trim().replace(/^#.*/,"").trim())
    throw Error("Unrecognized quoting for "+key+" in "+file);
   value=value.slice(1,last);
  }else value=value.split(/\s+#/)[0].trim();
  out[key]=value;
 }
 return out;
}
export function evaluateFiles(files,environment={}){
 const sources=[];
 const merged={};
 const checks=[];
 for(const file of [".env",".env."+PROJECT]){
  const content=files[file];
  if(content===undefined)continue;
  sources.push(file);
  const parsed=parseRelevantEnv(content,file);
  for(const [key,value] of Object.entries(parsed)){
   if(key==="PACKTOOK_PRODUCTION_PROJECT_ID"&&value!==PROJECT)
    throw Error("SAFETY BLOCK: project mismatch in "+file+" (expected "+PROJECT+")");
   if(PUBLIC_KEYS.includes(key)&&value!=="false")
    throw Error("SAFETY BLOCK: "+key+" must explicitly equal false in "+file);
   merged[key]=value;
  }
 }
 if(!sources.length)throw Error("SAFETY BLOCK: Functions .env config is missing. Do not deploy with an unreviewed runtime project ID.");
 for(const key of [...PUBLIC_KEYS,"PACKTOOK_PRODUCTION_PROJECT_ID"]){
  if(Object.hasOwn(environment,key)&&environment[key]!==""){
   const expected=key==="PACKTOOK_PRODUCTION_PROJECT_ID"?PROJECT:"false";
   if(environment[key]!==expected)
    throw Error("SAFETY BLOCK: shell "+key+" is not "+expected);
  }
 }
 if(merged.PACKTOOK_PRODUCTION_PROJECT_ID!==PROJECT)
  throw Error("SAFETY BLOCK: runtime project ID is missing. Configure PACKTOOK_PRODUCTION_PROJECT_ID in functions/.env."+PROJECT);
 for(const key of PUBLIC_KEYS){
  if(merged[key]!=="false")
   throw Error("SAFETY BLOCK: missing explicit "+key+"=false in Functions environment");
  checks.push(key+"=false");
 }
 return {passed:true,environmentFiles:sources,project:PROJECT,
  functionName:"publicSignupStatus",codebase:"beta",allPublicFlagsOff:true,
  checks};
}
function localEnvironment(){
 const files={};
 for(const file of [".env",".env."+PROJECT]){
  const absolute=path.join(ROOT,"functions",file);
  if(fs.existsSync(absolute))files[file]=fs.readFileSync(absolute,"utf8");
 }
 return files;
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  if(process.argv[2]!==PROJECT||process.argv.length!==3)
   throw Error("SAFETY BLOCK: exact project argument packtook-prod-01 is required");
  const cfg=JSON.parse(read("firebase.json"));
  assert(Array.isArray(cfg.functions)&&cfg.functions.some(x=>x.codebase==="beta"&&x.source==="functions"),
   "Firebase Functions beta codebase must remain isolated");
  const backend=read("functions/index.js");
  assert(backend.includes("exports.publicSignupStatus=onCall(options,async()=>"),
   "Expected read-only publicSignupStatus function is missing");
  assert(backend.includes("PUBLIC_SIGNUP_ENABLED&&PUBLIC_ACCESS_ENABLED&&PUBLIC_POLICIES_APPROVED"),
   "Backend must require all three separate rollout flags");
  assert(backend.includes("freeVideosPerMonth:20,freeDevices:1"),
   "Unexpected public Free limits");
  const status=evaluateFiles(localEnvironment(),process.env);
  console.log("PASS: V6.8.1 read-only Public STATUS rollout preflight");
  console.log(JSON.stringify(status,null,2));
  console.log("This preflight never deploys. Owner confirmation required separately.");
 }catch(error){
  console.error(error.message);
  process.exitCode=2;
 }
}
