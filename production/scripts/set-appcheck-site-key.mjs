// PACKTOOK V6.9.1 — set ONLY a public reCAPTCHA Enterprise Web Site Key.
// Deliberately excludes Github credentials, Firebase deployments and server flags.
// This is a PUBLIC browser Site Key, NOT a secret/API/Omise key.
// Usage:  node scripts/set-appcheck-site-key.mjs --apply
// Reads the complete key from PACKTOOK_RECAPTCHA_SITE_KEY (not a CLI argument).
// Use shell read -r to avoid pasting the key into command history.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const FILE=path.join(ROOT,"app","signup-config.js");

export function validPublicSiteKey(value){
 return typeof value==="string" &&
   /^[A-Za-z0-9_-]{30,160}$/.test(value) &&
   !/(?:example|placeholder|your[_-]?key|site[_-]?key|debug|secret|skey|test[_-]?key)/i.test(value) &&
   !value.includes("...");
}

export function withSiteKey(source,key){
 if(!validPublicSiteKey(key))throw Error(
  "INVALID PUBLIC SITE KEY: paste the FULL reCAPTCHA Enterprise Web Site Key; screenshot ellipsis and sample/secret keys are rejected"
 );
 // Match exactly one literal field. Fail closed for unexpected source changes.
 const pattern=/(\bappCheckSiteKey\s*:\s*")([^"]*)(")/g;
 const matches=[...source.matchAll(pattern)];
 if(matches.length!==1)throw Error("SAFETY BLOCK: expected exactly one signupConfig appCheckSiteKey property");
 const current=matches[0][2];
 if(current&&current!==key){
  throw Error("SAFETY BLOCK: a different Site Key is already configured. Review manually before replacing it.");
 }
 return source.replace(pattern,(_full,a,_current,c)=>a+key+c);
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  if(process.argv.length!==3||process.argv[2]!=="--apply")
   throw Error("Usage: PACKTOOK_RECAPTCHA_SITE_KEY=<full public Web Site Key> node scripts/set-appcheck-site-key.mjs --apply");
  const key=process.env.PACKTOOK_RECAPTCHA_SITE_KEY;
  const previous=fs.readFileSync(FILE,"utf8");
  const updated=withSiteKey(previous,key);
  assert(updated.includes('policyVersion:"2026-11-v1"'),"Policy version unexpectedly changed");
  assert(updated.includes('termsUrl:"policy-terms.html"')&&updated.includes('privacyUrl:"policy-privacy.html"'),
   "Policy links unexpectedly changed");
  if(updated!==previous)fs.writeFileSync(FILE,updated,"utf8");
  console.log("PASS: public reCAPTCHA Enterprise Site Key configured in app/signup-config.js");
  console.log("Site Key value withheld from terminal output. No Firebase deploy or Public flag changes.");
  console.log("NEXT: run node scripts/test-appcheck-sitekey-configuration.mjs and test-onboarding-ui.mjs.");
  console.log("IMPORTANT: source key alone does NOT prove valid Firebase Console registration or App Check attestation.");
 }catch(error){
  console.error(error.message);
  process.exitCode=2;
 }
}
