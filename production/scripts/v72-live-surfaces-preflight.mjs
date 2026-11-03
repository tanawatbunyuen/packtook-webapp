// PACKTOOK V7.2 — fixed-URL, read-only Production surfaces preflight.
// Does NOT authenticate, create accounts, verify real App Check, provision secrets,
// mutate Firestore/Billing, deploy, or enable Public/QA/Pilot flags.
// Usage: node scripts/v72-live-surfaces-preflight.mjs packtook-prod-01
import {probe} from "./probe-free-deployment.mjs";
import {pathToFileURL} from "node:url";

const PROJECT="packtook-prod-01";
const OWNER="https://packtook-prod-01-owner.web.app";
const CUSTOMER="https://packtook-prod-01-app.web.app";
const PROJECT_MARKER=/"?projectId"?\s*:\s*"packtook-prod-01"/;
const AUTH_MARKER=/"?authDomain"?\s*:\s*"packtook-prod-01\.firebaseapp\.com"/;

export function assessV72LiveSurfaces({ownerHome,ownerJS,ownerConfig,pilotPage,remote}){
 const ownerOnline=ownerHome?.http===200&&
  ownerHome?.body?.includes('id="ownerApp"')===true;
 const ownerJsOnline=ownerJS?.http===200&&
  ownerJS?.body?.includes('api("ownerAnalyticsSummary")')===true;
 const ownerProductionConfig=ownerConfig?.http===200&&
  PROJECT_MARKER.test(ownerConfig?.body||"")&&
  AUTH_MARKER.test(ownerConfig?.body||"");
 const pilotMarkup=pilotPage?.body||"";
 const pilotPageExposed=pilotPage?.http===200&&
  pilotMarkup.includes('id="checkAppCheck"')&&
  pilotMarkup.includes('id="loginForm"')&&
  pilotMarkup.includes("V7.2 Invite-only Pilot");
 const remoteClosed=remote?.status?.reachable===true&&
  remote?.status?.publicSignupEnabled===false&&
  remote?.status?.publicAccessEnabled===false&&
  remote?.customer?.http===200&&remote?.marketing?.http===200;
 const blockers=[];
 if(!ownerOnline||!ownerJsOnline||!ownerProductionConfig)
  blockers.push("OWNER_PRODUCTION_SURFACE_OR_CONFIG_UNVERIFIED");
 if(!remoteClosed)blockers.push("PUBLIC_FLAGS_OR_WEB_SERVICES_NOT_CONFIRMED_CLOSED");
 if(pilotPageExposed)blockers.push("PILOT_PAGE_ALREADY_VISIBLE_DEPLOY_SCOPE_REVIEW_REQUIRED");
 blockers.push("REAL_BROWSER_APPCHECK_PROVIDER_TOKEN_NOT_PROVEN");
 blockers.push("CLOUD_FUNCTION_APPCHECK_ENFORCEMENT_NOT_PROVEN");
 blockers.push("SECRET_MANAGER_IAM_ALERTS_PDPA_AND_OWNER_APPROVAL_REQUIRED");
 return {
  version:"7.2",project:PROJECT,mode:"READ_ONLY_FIXED_URLS",
  owner:{hostingOnline:ownerOnline,appJsLoaded:ownerJsOnline,
   exactProductionConfig:ownerProductionConfig,
   authenticatedOwnerFirestoreE2E:"OWNER_REPORTED_PASS_NOT_RETESTED_HERE"},
  customer:{publicClosed:remoteClosed,pilotPageExposed,
   pilotPageHttp:pilotPage?.http??null},
  browser:{clientTokenVerified:false,serverTokenVerified:false},
  prelaunchSurfacesPass:ownerOnline&&ownerJsOnline&&
   ownerProductionConfig&&remoteClosed&&!pilotPageExposed,
  readyForPilot:false,readyForPublic:false,
  decision:"NO_GO_CONTROLLED_PILOT",blockers,
  note:"Only fixed-URL unauthenticated HTTP reads and existing read-only publicSignupStatus; no Owner login, credentials, App Check token or Production writes."
 };
}
export async function inspectUrl(url,expectedContentType){
 const allowed=new Set([
  OWNER+"/",OWNER+"/app.js",OWNER+"/firebase-config.js",
  CUSTOMER+"/pilot-free.html"
 ]);
 if(!allowed.has(url))throw Error("SAFETY BLOCK: URL must be one of four fixed allowlist endpoints");
 try{
  const response=await fetch(url,{method:"GET",redirect:"error",cache:"no-store",
   headers:{Accept:expectedContentType==="text/html"?"text/html":"text/javascript,*/*"},
   signal:AbortSignal.timeout(9000)});
  const type=response.headers.get("content-type")||"";
  if(!type.includes(expectedContentType))return {http:response.status,body:"",typeOk:false};
  const body=(await response.text()).slice(0,170000);
  return {http:response.status,body,typeOk:true};
 }catch{return {http:null,body:"",typeOk:false}}
}
const isMain=process.argv[1]&&process.argv[1].endsWith("/v72-live-surfaces-preflight.mjs");
if(isMain){
 if(process.argv.length!==3||process.argv[2]!==PROJECT){
  console.error("SAFETY BLOCK: exact Production project required; no custom URLs or flags");
  process.exitCode=2;
 }else{
  const [remote,ownerHome,ownerJS,ownerConfig,pilotPage]=await Promise.all([
   probe(),inspectUrl(OWNER+"/","text/html"),
   inspectUrl(OWNER+"/app.js","javascript"),
   inspectUrl(OWNER+"/firebase-config.js","javascript"),
   inspectUrl(CUSTOMER+"/pilot-free.html","text/html")
  ]);
  const report=assessV72LiveSurfaces({remote,ownerHome,ownerJS,ownerConfig,pilotPage});
  // Never print Firebase Web API keys, tokens, owner emails, UID or raw HTTP bodies.
  console.log(JSON.stringify(report,null,2));
  console.log("RESULT: V7.2 REAL BROWSER / CLOUD RELEASE NO-GO (read-only preflight)");
  if(!report.prelaunchSurfacesPass)process.exitCode=2;
 }
}
