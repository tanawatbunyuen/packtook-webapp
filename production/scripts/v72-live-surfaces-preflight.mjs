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

// Public status is intentionally broken into independent, falsifiable checks.
// An unavailable endpoint is UNKNOWN, NEVER the same as an enabled flag.
export function diagnosePublicServices(remote){
 const marketingHttp=remote?.marketing?.http??null;
 const customerHttp=remote?.customer?.http??null;
 const statusHttp=remote?.status?.http??null;
 const reachable=remote?.status?.reachable===true;
 const signup=remote?.status?.publicSignupEnabled;
 const access=remote?.status?.publicAccessEnabled;
 const reasons=[];
 if(marketingHttp!==200)reasons.push("MARKETING_HOSTING_HTTP_NOT_200");
 if(customerHttp!==200)reasons.push("CUSTOMER_HOSTING_HTTP_NOT_200");
 if(statusHttp!==200||!reachable)reasons.push("PUBLIC_STATUS_CALLABLE_UNVERIFIED");
 if(signup===true)reasons.push("PUBLIC_SIGNUP_ENABLED_UNEXPECTEDLY");
 else if(signup!==false)reasons.push("PUBLIC_SIGNUP_FLAG_UNKNOWN");
 if(access===true)reasons.push("PUBLIC_ACCESS_ENABLED_UNEXPECTEDLY");
 else if(access!==false)reasons.push("PUBLIC_ACCESS_FLAG_UNKNOWN");
 return {
  marketingHttp,customerHttp,statusHttp,statusReachable:reachable,
  publicSignupEnabled:signup===true?true:signup===false?false:null,
  publicAccessEnabled:access===true?true:access===false?false:null,
  // Error labels are optional, bounded, generic connectivity categories.
  marketingError:remote?.marketing?.error??null,
  customerError:remote?.customer?.error??null,
  statusError:remote?.status?.error??remote?.status?.reason??null,
  closed:reasons.length===0,reasons
 };
}

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
 const publicProbe=diagnosePublicServices(remote);
 const remoteClosed=publicProbe.closed;
 const blockers=[];
 if(!ownerOnline||!ownerJsOnline||!ownerProductionConfig)
  blockers.push("OWNER_PRODUCTION_SURFACE_OR_CONFIG_UNVERIFIED");
 if(!remoteClosed){
  blockers.push("PUBLIC_FLAGS_OR_WEB_SERVICES_NOT_CONFIRMED_CLOSED");
  blockers.push(...publicProbe.reasons);
 }
 if(pilotPageExposed)blockers.push("PILOT_PAGE_ALREADY_VISIBLE_DEPLOY_SCOPE_REVIEW_REQUIRED");
 blockers.push("REAL_BROWSER_APPCHECK_PROVIDER_TOKEN_NOT_PROVEN");
 blockers.push("CLOUD_FUNCTION_APPCHECK_ENFORCEMENT_NOT_PROVEN");
 blockers.push("SECRET_MANAGER_IAM_ALERTS_PDPA_AND_OWNER_APPROVAL_REQUIRED");
 return {
  version:"7.2",project:PROJECT,mode:"READ_ONLY_FIXED_URLS",
  owner:{hostingOnline:ownerOnline,appJsLoaded:ownerJsOnline,
   exactProductionConfig:ownerProductionConfig,
   authenticatedOwnerFirestoreE2E:"OWNER_REPORTED_PASS_NOT_RETESTED_HERE"},
  publicProbe,
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
  const [ownerHome,ownerJS,ownerConfig,pilotPage]=await Promise.all([
   inspectUrl(OWNER+"/","text/html"),
   inspectUrl(OWNER+"/app.js","javascript"),
   inspectUrl(OWNER+"/firebase-config.js","javascript"),
   inspectUrl(CUSTOMER+"/pilot-free.html","text/html")
  ]);
  const first=await probe();
  let remote=first,probeAttempts=1;
  const firstStatus=diagnosePublicServices(first);
  const explicitUnsafe=firstStatus.publicSignupEnabled===true||
   firstStatus.publicAccessEnabled===true;
  if(!firstStatus.closed&&!explicitUnsafe){
   // A cold start/network timeout may affect one probe. Retry once without
   // enabling flags, treating any observed ON as unsafe.
   const second=await probe();probeAttempts=2;
   const secondStatus=diagnosePublicServices(second);
   if(secondStatus.publicSignupEnabled===true||secondStatus.publicAccessEnabled===true)
    remote=second;
   else if(secondStatus.closed)remote=second;
   else remote=second;
  }
  const report=assessV72LiveSurfaces({remote,ownerHome,ownerJS,ownerConfig,pilotPage});
  report.publicProbe.attempts=probeAttempts;
  report.publicProbe.initialStatusHttp=first?.status?.http??null;
  report.publicProbe.initialStatusReachable=first?.status?.reachable===true;
  // Never print Firebase Web API keys, tokens, owner emails, UID or raw HTTP bodies.
  console.log(JSON.stringify(report,null,2));
  console.log("RESULT: V7.2 REAL BROWSER / CLOUD RELEASE NO-GO (read-only preflight)");
  if(!report.prelaunchSurfacesPass)process.exitCode=2;
 }
}
