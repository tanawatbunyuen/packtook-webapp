// PACKTOOK V7.1 — Prepare exact Production Customer App ID in LOCAL dotenv.
// Never deploys, modifies Firebase, enables Public/QA or prints App ID/UIDs.
// Existing PROD dotenv is backed up outside the repo with permissions 0600.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {readVerifiedAppId} from "./configure-v70-qa-invite.mjs";
import {appIdEvidence} from "./v71-public-app-id-preflight.mjs";
import {checkQaEnvironment} from "./check-v70-qa-preflight.mjs";

const PROJECT="packtook-prod-01";
const KEY="PACKTOOK_PUBLIC_CUSTOMER_APP_ID";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

export function prepareCustomerAppId({specific,generic="",config,environment={}}){
 // Fail closed on Public flags, previously active QA and shell overrides.
 const before=checkQaEnvironment({specific,generic,mode:"--qa-off",environment});
 if(!before.pass||before.qaEnabled||!before.publicFlagsOff)
  throw Error("SAFETY BLOCK: Public or QA gate is not OFF");
 if(environment[KEY])throw Error("SAFETY BLOCK: shell override of Customer App ID is not allowed");
 const appId=readVerifiedAppId(config);
 const evidence=appIdEvidence({specific,generic,customerConfig:config});
 if(evidence.configured&&!evidence.exactMatch)
  throw Error("SAFETY BLOCK: mismatched Customer App ID already configured; review manually");
 if(evidence.exactMatch)return {updated:specific,changed:false};
 // Preserve ALL other existing values byte-for-byte; append only one line.
 if(typeof specific!=="string"||!specific.trim())
  throw Error("SAFETY BLOCK: missing existing Production dotenv");
 const updated=specific.replace(/\s*$/,"")+"\n"+KEY+"="+appId+"\n";
 const after=checkQaEnvironment({specific:updated,generic,mode:"--qa-off",environment});
 const confirmed=appIdEvidence({specific:updated,generic,customerConfig:config});
 if(!after.pass||!confirmed.exactMatch)
  throw Error("SAFETY BLOCK: exact Customer App ID or Public gates did not validate");
 return {updated,changed:true};
}

function prepareLocalFile(){
 if(process.argv.length!==4||process.argv[2]!==PROJECT||process.argv[3]!=="--prepare-local")
  throw Error("Usage: node scripts/configure-v71-public-app-id.mjs packtook-prod-01 --prepare-local");
 const file=path.join(ROOT,"functions",".env."+PROJECT);
 const configFile=path.join(ROOT,"app","firebase-v4-config.js");
 const genericFile=path.join(ROOT,"functions",".env");
 const st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink())throw Error("SAFETY BLOCK: local PROD Functions dotenv must be a regular file");
 const current=fs.readFileSync(file,"utf8");
 const generic=fs.existsSync(genericFile)?fs.readFileSync(genericFile,"utf8"):"";
 const {updated,changed}=prepareCustomerAppId({
  specific:current,generic,config:fs.readFileSync(configFile,"utf8"),
  environment:process.env
 });
 if(!changed){
  console.log("PASS: exact Customer App ID already configured. No changes.");
  return;
 }
 const home=process.env.HOME;
 if(!home||!path.isAbsolute(home))throw Error("SAFETY BLOCK: HOME path unavailable");
 const dir=path.join(home,"packtook-rollout-records");
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 fs.chmodSync(dir,0o700);
 const nonce=crypto.randomBytes(6).toString("hex");
 const backup=path.join(dir,"v71-public-app-id-"+new Date().toISOString().replace(/[:.]/g,"-")+"-"+nonce+".bak");
 fs.writeFileSync(backup,current,{flag:"wx",mode:0o600});
 const tmp=file+".v71-"+nonce+".tmp";
 try{
  fs.writeFileSync(tmp,updated,{flag:"wx",mode:0o600});
  fs.renameSync(tmp,file);
  fs.chmodSync(file,0o600);
 }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
 console.log("PASS: exact Customer Web App ID prepared in LOCAL Functions dotenv only.");
 console.log("Production/Public/QA untouched. Private local backup: "+backup);
 console.log("NEXT: run v71-public-app-id-preflight.mjs and v71-public-readiness.mjs --remote (READ-ONLY).");
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{prepareLocalFile()}
 catch(error){console.error(error.message);process.exitCode=2}
}
