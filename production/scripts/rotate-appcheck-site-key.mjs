// PACKTOOK V6.9.2 — SAFE replacement of a PUBLIC reCAPTCHA Enterprise Site Key.
// Runs only in operator's local working tree. NEVER deploys or changes server flags.
// Reads PACKTOOK_RECAPTCHA_SITE_KEY_NEW and PACKTOOK_RECAPTCHA_KEY_METADATA_FILE.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validPublicSiteKey,withSiteKey} from "./set-appcheck-site-key.mjs";

const PROJECT="packtook-prod-01",DOMAIN="packtook-prod-01-app.web.app";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const CONFIG=path.join(ROOT,"app","signup-config.js");

export function checkNewKey({currentConfig,newKey,metadata}){
 if(!validPublicSiteKey(newKey))throw Error("SAFETY BLOCK: full valid public Site Key required");
 const currentKey=currentConfig.match(/\bappCheckSiteKey\s*:\s*"([^"]*)"/)?.[1]||"";
 if(!validPublicSiteKey(currentKey))throw Error("SAFETY BLOCK: existing Site Key format unexpected");
 if(newKey===currentKey)throw Error("SAFETY BLOCK: new key is identical to old key");
 if(!metadata||typeof metadata!=="object")throw Error("SAFETY BLOCK: Google Cloud key metadata missing");
 if(metadata.name!=="projects/"+PROJECT+"/keys/"+newKey)
  throw Error("SAFETY BLOCK: new Key does not belong to "+PROJECT);
 const web=metadata.webSettings;
 if(!web||web.integrationType!=="SCORE"||web.allowAllDomains===true||
    !Array.isArray(web.allowedDomains)||!web.allowedDomains.includes(DOMAIN))
  throw Error("SAFETY BLOCK: key must be WEB Score-based with restricted Customer domain");
 if(metadata.testingOptions?.testingScore!==undefined||
    metadata.testingOptions?.testingChallenge!==undefined)
  throw Error("SAFETY BLOCK: production key cannot be a Testing Key");
 const withoutOld=currentConfig.replace(
  /(\bappCheckSiteKey\s*:\s*")[^"]*(")/,(_m,a,b)=>a+b);
 const result=withSiteKey(withoutOld,newKey);
 assert(result.includes('policyVersion:"2026-11-v1"'));
 assert(result.includes('termsUrl:"policy-terms.html"')&&result.includes('privacyUrl:"policy-privacy.html"'));
 return {content:result};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  if(process.argv.length!==3||process.argv[2]!=="--apply")
   throw Error("Usage: node scripts/rotate-appcheck-site-key.mjs --apply");
  const file=process.env.PACKTOOK_RECAPTCHA_KEY_METADATA_FILE;
  if(!file)throw Error("SAFETY BLOCK: gcloud-verified key metadata file required");
  const source=fs.readFileSync(CONFIG,"utf8");
  const metadata=JSON.parse(fs.readFileSync(file,"utf8"));
  const checked=checkNewKey({
    currentConfig:source,newKey:process.env.PACKTOOK_RECAPTCHA_SITE_KEY_NEW,metadata});
  fs.writeFileSync(CONFIG,checked.content,"utf8");
  console.log("PASS: public Site Key rotated locally for "+PROJECT);
  console.log("PASS: Google Cloud Production project, Score key and authorized Customer domain");
  console.log("Only local app/signup-config.js updated. Firebase App Check registration and Hosting deployment are MANUAL next steps.");
 }catch(e){console.error(e.message);process.exitCode=2}
}
