// PACKTOOK V6.7 — read-only Production deployment + callable STATUS probe.
// Does NOT login/create user/activate Free/change server flags/write Firestore.
// Usage: node scripts/probe-free-deployment.mjs packtook-prod-01 [--expect-v66] [--json]
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import path from "node:path";

export function customerEvidence(body){
 return {
  v66Script:/app[.]js[?]v=6[.]6[.]0/.test(body),
  hasSignupForm:body.includes('id="publicSignupForm"'),
  hasVerifyStep:body.includes('id="publicSignupFinish"'),
  hasBetaBanner:body.includes("PRODUCTION BETA"),
  isPublicIndexOpen:!/noindex[, ]*nofollow/i.test(body)
 };
}
export function marketingEvidence(body){
 return {
  currentPhotos:body.includes("howto-ready.webp?v=6.5.6"),
  prelaunchNotice:body.includes("REGISTRATION &amp; PAYMENT NOT OPEN"),
  noindex:/noindex[, ]*nofollow/.test(body)
 };
}
export function statusEvidence(status,http){
 const value=status?.result;
 if(http!==200||!value||typeof value.enabled!=="boolean")
  return {reachable:false,publicSignupEnabled:null,publicAccessEnabled:null,
   reason:http===404?"NOT_DEPLOYED":"FUNCTION_UNVERIFIED"};
 return {reachable:true,publicSignupEnabled:value.enabled,
  publicAccessEnabled:value.accessEnabled===true,
  policyVersion:typeof value.policyVersion==="string"?value.policyVersion:null,
  freeVideosPerMonth:value.freeVideosPerMonth,
  freeDevices:value.freeDevices};
}
export function decide(report,{expectV66=false}={}){
 const reasons=[];
 if(report.customer.http!==200||report.marketing.http!==200)reasons.push("HOSTING_UNREACHABLE");
 if(report.status.publicSignupEnabled===true||report.status.publicAccessEnabled===true)
  reasons.push("UNEXPECTED_PUBLIC_FLAG_ENABLED");
 if(!report.status.reachable)reasons.push("PUBLIC_STATUS_CALLABLE_NOT_DEPLOYED_OR_UNVERIFIED");
 if(report.status.reachable&&(report.status.freeVideosPerMonth!==20||report.status.freeDevices!==1||report.status.policyVersion!=="2026-11-v1"))
  reasons.push("STATUS_FREE_QUOTA_OR_POLICY_MISMATCH");
 if(expectV66&&!report.customer.v66Script)reasons.push("CUSTOMER_V66_NOT_DEPLOYED");
 if(expectV66&&(!report.customer.hasSignupForm||!report.customer.hasVerifyStep))
  reasons.push("CUSTOMER_SIGNUP_HTML_NOT_DEPLOYED");
 if(!report.marketing.prelaunchNotice)reasons.push("MARKETING_PRELAUNCH_NOTICE_MISSING");
 return {pass:reasons.length===0,reasons};
}
async function readHTML(url){
 try{
  const r=await fetch(url,{redirect:"error",cache:"no-store",
   headers:{Accept:"text/html"},signal:AbortSignal.timeout(9000)});
  const type=r.headers.get("content-type")||"";
  if(!type.includes("text/html"))return{http:r.status,body:"",error:"NON_HTML"};
  return{http:r.status,body:(await r.text()).slice(0,300000)};
 }catch(e){return{http:null,body:"",error:e?.code||e?.name||"UNREACHABLE"}}
}
async function callStatus(){
 // This is an intentionally read-only callable: it returns flags and grants no
 // credits. Only POST {data:{}}. Never send credentials, cookies or tokens.
 const url="https://asia-southeast1-packtook-prod-01.cloudfunctions.net/publicSignupStatus";
 try{
  const r=await fetch(url,{method:"POST",redirect:"error",cache:"no-store",
   headers:{"Content-Type":"application/json"},body:'{"data":{}}',
   signal:AbortSignal.timeout(9000)});
  const raw=(await r.text()).slice(0,15000);
  let value=null;try{value=JSON.parse(raw)}catch{}
  return{http:r.status,value};
 }catch(e){return{http:null,value:null,error:e?.code||e?.name||"UNREACHABLE"}}
}
export async function probe(){
 const [m,c,s]=await Promise.all([
  readHTML("https://packtook-prod-01.web.app/"),
  readHTML("https://packtook-prod-01-app.web.app/"),
  callStatus()
 ]);
 return{
  project:"packtook-prod-01",readOnly:true,
  marketing:{http:m.http,...marketingEvidence(m.body),...(m.error?{error:m.error}:{})},
  customer:{http:c.http,...customerEvidence(c.body),...(c.error?{error:c.error}:{})},
  status:{...statusEvidence(s.value,s.http),http:s.http,...(s.error?{error:s.error}:{})},
  scope:"HTTP-only and unauthenticated callable STATUS; does NOT prove Auth, App Check, real email, video saving, policy approval or Public readiness"
 };
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 if(process.argv[2]!=="packtook-prod-01"){
  console.error("SAFETY BLOCK: exact Production project name required; this script never supports custom URLs");
  process.exitCode=1;
 }else{
  const flags=new Set(process.argv.slice(3));
  const report=await probe(), decision=decide(report,{expectV66:flags.has("--expect-v66")});
  if(flags.has("--json"))console.log(JSON.stringify({...report,decision},null,2));
  else{
   console.log("PACKTOOK V6.7 READ-ONLY DEPLOYMENT CHECK");
   console.log(JSON.stringify({...report,decision},null,2));
   console.log(decision.pass
    ?"PASS: Hosting and status are visible with Public gates closed. This is NOT Public launch approval."
    :"BLOCK: deployment/config must be checked; no changes made.");
  }
  if(!decision.pass)process.exitCode=2;
 }
}
