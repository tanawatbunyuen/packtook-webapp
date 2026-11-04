// PACKTOOK V7.2 — Production admission runtime negative probe.
// Sends two unauthenticated callable POST requests with empty payload only.
// These are network requests, NOT purely metadata reads; they must be rejected
// at the Firebase callable/App Check transport before any handler can mutate data.
// NEVER provide Authorization, Firebase-Instance-ID, App Check, or invite tokens.
import {execFileSync} from "node:child_process";

const PROJECT="packtook-prod-01",REGION="asia-southeast1";
const NAMES=["pilotInvitationStatus","completePilotFreeSignup"];
function describe(name) {
 const out=execFileSync("gcloud",["functions","describe",name,"--gen2",
  "--project="+PROJECT,"--region="+REGION,"--format=json"],{
   encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:25000,maxBuffer:2e6});
 return JSON.parse(out);
}
function describeDecision(d,name) {
 const cfg=d.serviceConfig||{},env=cfg.environmentVariables||{};
 const sa="packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com";
 const secretNames=(cfg.secretEnvironmentVariables||[]).map(x=>x.secret);
 const url=cfg.uri||"";
 const status=d.state==="ACTIVE";
 const saCorrect=cfg.serviceAccountEmail===sa;
 const secret=secretNames.includes("PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX");
 const pilotEnvOff=env.PACKTOOK_V72_PILOT_ENABLED!=="true";
 const publicEnvOff=env.PACKTOOK_PUBLIC_SIGNUP_ENABLED!=="true"&&
  env.PACKTOOK_PUBLIC_ACCESS_ENABLED!=="true";
 const uriIsHTTPS=/^https:\/\/[A-Za-z0-9.-]+(?:\/)?$/.test(url);
 return {name,status,saCorrect,secret,pilotEnvOff,publicEnvOff,uriIsHTTPS,
   publicUrl:url,pass:status&&saCorrect&&secret&&pilotEnvOff&&publicEnvOff&&uriIsHTTPS};
}
if(process.argv.length!==3||process.argv[2]!=="--unauth-negative-only"){
 console.error("USAGE: node scripts/v72-admission-runtime-negative.mjs --unauth-negative-only");
 process.exit(2);
}
let checks=[],errors=[];
for(const name of NAMES){
 try{
  const check=describeDecision(describe(name),name);
  checks.push(check);
  if(!check.pass)errors.push(name+"_CONFIG_MISMATCH");
 }catch(e){errors.push(name+"_DESCRIPTION_FAILED");}
}
const report={mode:"UNAUTHENTICATED_NEGATIVE_ONLY",project:PROJECT,
 functions:checks.map(({publicUrl,...rest})=>rest),errors,
 negativeTests:[],noUserTokensUsed:true,accountWritesRequested:false,
 pilotActivationRequested:false,decision:"NO_GO_CONTROLLED_PILOT"};
if(errors.length){
 console.log(JSON.stringify(report,null,2));process.exit(2);
}
for(const check of checks){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const result=await fetch(check.publicUrl,{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({data:{}}),redirect:"manual",signal:controller.signal
  });
  let body="";
  try{body=(await result.text()).slice(0,2000)}catch{}
  let parsed=null;
  try{parsed=JSON.parse(body)}catch{}
  const denied=[400,401,403].includes(result.status)&&
   parsed?.result===undefined&&parsed?.data===undefined;
  report.negativeTests.push({name:check.name,httpStatus:result.status,denied,
   receivedSuccessPayload:parsed?.result!==undefined||parsed?.data!==undefined});
  if(!denied)errors.push(check.name+"_UNAUTH_NOT_PROVEN_DENIED");
 }catch(e){
  report.negativeTests.push({name:check.name,denied:false,error:e.name==="AbortError"?"TIMEOUT":"REQUEST_FAILED"});
  errors.push(check.name+"_REQUEST_FAILED");
 }finally{clearTimeout(timeout);}
}
report.errors=errors;
report.unauthenticatedNegativePass=errors.length===0;
report.realAppCheckVerified=false;
report.authenticatedPilotLeaseVerified=false;
report.effectiveSecretReadVerified=false;
report.decision="NO_GO_CONTROLLED_PILOT";
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=2;
