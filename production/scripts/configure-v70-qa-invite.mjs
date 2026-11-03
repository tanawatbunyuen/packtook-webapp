// PACKTOOK V7.0 — controlled QA invite local dotenv preparation.
// This is NOT a deploy and NEVER creates Auth users or enables Public signup.
// Keeps a 0600 backup OUTSIDE Firebase source. Never logs UID or App ID.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {createInterface} from "node:readline/promises";
import {fileURLToPath} from "node:url";
import {checkQaEnvironment} from "./check-v70-qa-preflight.mjs";

const PROJECT="packtook-prod-01";
const KEYS=["PACKTOOK_V7_QA_ENABLED","PACKTOOK_V7_QA_UID",
 "PACKTOOK_V7_QA_APP_ID","PACKTOOK_V7_QA_EXPIRES_AT"];
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

export function readVerifiedAppId(source){
 const match=source.match(/export const firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
 if(!match)throw Error("SAFETY BLOCK: local Customer Firebase web config not found");
 const config=JSON.parse(match[1]);
 if(config.projectId!==PROJECT||
    config.authDomain!==PROJECT+".firebaseapp.com"||
    !/^1:[0-9]+:web:[A-Za-z0-9]+$/.test(config.appId||""))
  throw Error("SAFETY BLOCK: exact Production Customer Firebase App ID mismatch");
 return config.appId;
}
export function replaceV7QaKeys(original,values){
 if(typeof original!=="string"||!original.trim())throw Error("SAFETY BLOCK: missing existing project dotenv");
 const seen=new Set(),out=[];
 for(const line of original.split(/\r?\n/)){
  if(!/^\s*#/.test(line)&&/PACKTOOK_V7_QA_/.test(line)){
   const m=line.match(/^\s*(PACKTOOK_V7_QA_[A-Z0-9_]+)\s*=/);
   if(!m||!KEYS.includes(m[1])||seen.has(m[1]))
    throw Error("SAFETY BLOCK: unrecognized or duplicate V7 QA dotenv declaration");
   seen.add(m[1]);continue;
  }
  out.push(line);
 }
 while(out.length&&!out[out.length-1].trim())out.pop();
 for(const key of KEYS)if(Object.hasOwn(values,key)){
  const value=values[key];
  if(typeof value!=="string"||/[\r\n#]/.test(value))
   throw Error("SAFETY BLOCK: invalid QA dotenv value");
  out.push(key+"="+value);
 }
 return out.join("\n")+"\n";
}

async function main(){
 const mode=process.argv[3];
 if(process.argv.length!==4||process.argv[2]!==PROJECT||
    !["--prepare","--disable"].includes(mode))
  throw Error("Usage: node scripts/configure-v70-qa-invite.mjs packtook-prod-01 --prepare|--disable");
 const envFile=path.join(ROOT,"functions",".env."+PROJECT);
 const cfgFile=path.join(ROOT,"app","firebase-v4-config.js");
 const genericFile=path.join(ROOT,"functions",".env");
 const state=fs.lstatSync(envFile);
 if(!state.isFile()||state.isSymbolicLink())
  throw Error("SAFETY BLOCK: Production functions env must be a normal file");
 const old=fs.readFileSync(envFile,"utf8");
 const generic=fs.existsSync(genericFile)?fs.readFileSync(genericFile,"utf8"):"";
 let updated,checkMode;
 if(mode==="--prepare"){
  const appId=readVerifiedAppId(fs.readFileSync(cfgFile,"utf8"));
  // Refuse replacing an existing active invite; first revoke via --disable.
  checkQaEnvironment({specific:old,generic,mode:"--qa-off",environment:process.env});
  if(!process.stdin.isTTY)throw Error("SAFETY BLOCK: enter the one test UID from an interactive Cloud Shell terminal");
  const rl=createInterface({input:process.stdin,output:process.stdout});
  let uid;
  try{uid=(await rl.question("Enter ONE dedicated TEST Firebase Auth UID (not email): ")).trim()}
  finally{rl.close()}
  if(!/^[A-Za-z0-9_-]{20,128}$/.test(uid))
   throw Error("SAFETY BLOCK: invalid test UID (20-128 ASCII alphanumeric, '-' or '_')");
  const expiry=new Date(Date.now()+4*60*60*1000).toISOString();
  updated=replaceV7QaKeys(old,{
   PACKTOOK_V7_QA_ENABLED:"true",
   PACKTOOK_V7_QA_UID:uid,
   PACKTOOK_V7_QA_APP_ID:appId,
   PACKTOOK_V7_QA_EXPIRES_AT:expiry
  });
  checkMode="--approved-qa";
 }else{
  updated=replaceV7QaKeys(old,{PACKTOOK_V7_QA_ENABLED:"false"});
  checkMode="--qa-off";
 }
 const result=checkQaEnvironment({
  specific:updated,generic,mode:checkMode,environment:process.env,
  expectedAppId:mode==="--prepare"?appId:null
 });
 // Atomic local write with private backup outside functions source and git tree.
 const base=path.join(process.env.HOME||"", "packtook-rollout-records");
 if(!path.isAbsolute(base))throw Error("SAFETY BLOCK: private backup directory unavailable");
 fs.mkdirSync(base,{recursive:true,mode:0o700});
 const name="v70-env-"+new Date().toISOString().replace(/[:.]/g,"-")+"-"+crypto.randomBytes(4).toString("hex");
 const backup=path.join(base,name+".bak");
 fs.writeFileSync(backup,old,{mode:0o600,flag:"wx"});
 const tmp=envFile+".v70-"+crypto.randomBytes(4).toString("hex")+".tmp";
 try{
  fs.writeFileSync(tmp,updated,{mode:0o600,flag:"wx"});
  fs.renameSync(tmp,envFile);
  fs.chmodSync(envFile,0o600);
 }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
 // Avoid logging UID, App ID, existing environment variables or full dotenv.
 console.log("PASS: local V7.0 QA configuration prepared; this did NOT deploy");
 console.log(JSON.stringify({
  project:PROJECT,mode:checkMode,publicFlagsOff:result.publicFlagsOff,
  qaEnabled:result.qaEnabled,qaUidConfigured:result.qaUidConfigured,
  expiresAt:result.expiresAt,backupFile:backup
 },null,2));
 console.log(mode==="--prepare"
  ?"NEXT: run approved QA preflight; then scoped owner-approved QA invite deploy. Public Signup remains OFF."
  :"NEXT: QA is OFF in LOCAL dotenv ONLY. Deploy --qa-off to revoke the LIVE invite.");
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)main().catch(e=>{console.error(e.message);process.exitCode=2});
