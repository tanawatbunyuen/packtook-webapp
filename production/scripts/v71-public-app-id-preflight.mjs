// PACKTOOK V7.1 — READ-ONLY exact Customer Web App ID evidence.
// A PUBLIC rollout must not trust only "some valid App Check app".
// Reads only local Production web config + functions dotenv; never logs values.
// Usage: node scripts/v71-public-app-id-preflight.mjs packtook-prod-01
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {readVerifiedAppId} from "./configure-v70-qa-invite.mjs";

const PROJECT="packtook-prod-01";
const KEY="PACKTOOK_PUBLIC_CUSTOMER_APP_ID";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

export function appIdEvidence({specific="",generic="",customerConfig=""}){
 const expected=readVerifiedAppId(customerConfig);
 const read=content=>{
  const matches=[];
  for(const line of content.split(/\r?\n/)){
   if(/^\s*(?:#|$)/.test(line))continue;
   if(!line.includes(KEY))continue;
   const m=line.match(/^\s*(?:export\s+)?PACKTOOK_PUBLIC_CUSTOMER_APP_ID\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))(?:\s+#.*)?\s*$/);
   if(!m)throw Error("SAFETY BLOCK: malformed PUBLIC Customer App ID environment line");
   matches.push(m[1]||m[2]||m[3]);
  }
  if(matches.length>1)throw Error("SAFETY BLOCK: duplicate Customer App ID configuration");
  return matches[0]||null;
 };
 const fromSpecific=read(specific),fromGeneric=read(generic);
 if(fromGeneric)throw Error("SAFETY BLOCK: PUBLIC Customer App ID must be project-specific only");
 return {configured:!!fromSpecific,exactMatch:fromSpecific===expected,
  source:"functions/.env."+PROJECT,project:PROJECT};
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  if(process.argv.length!==3||process.argv[2]!==PROJECT)
   throw Error("Usage: node scripts/v71-public-app-id-preflight.mjs packtook-prod-01");
  const envPath=path.join(ROOT,"functions",".env."+PROJECT);
  const cfgPath=path.join(ROOT,"app","firebase-v4-config.js");
  const genericPath=path.join(ROOT,"functions",".env");
  if(!fs.existsSync(envPath)||!fs.existsSync(cfgPath))
   throw Error("SAFETY BLOCK: existing Production Functions dotenv or Customer Web Config missing");
  const report=appIdEvidence({
   specific:fs.readFileSync(envPath,"utf8"),
   generic:fs.existsSync(genericPath)?fs.readFileSync(genericPath,"utf8"):"",
   customerConfig:fs.readFileSync(cfgPath,"utf8")
  });
  console.log(JSON.stringify(report,null,2));
  console.log(report.exactMatch
   ?"PASS: exact Production Customer App ID configured (read only). NOT public launch approval."
   :"NO-GO: exact Production Customer App ID must be configured before public launch. No changes made.");
  if(!report.exactMatch)process.exitCode=2;
 }catch(e){console.error(e.message);process.exitCode=2}
}
