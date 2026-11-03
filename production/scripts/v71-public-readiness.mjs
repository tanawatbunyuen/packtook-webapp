// PACKTOOK V7.1 — READ-ONLY public Free readiness assessment.
// This is a PRE-LAUNCH NO-GO report, NOT a deploy, an approval, or a flag switch.
// Usage: node scripts/v71-public-readiness.mjs packtook-prod-01 [--remote]
// Never prints Auth UIDs, local secrets, tokens or dotenv contents.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {collectLocalSource,inspectSource} from "./public-launch-preflight.mjs";
import {checkQaEnvironment} from "./check-v70-qa-preflight.mjs";
import {probe,decide} from "./probe-free-deployment.mjs";

const PROJECT="packtook-prod-01";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const REQUIRED=["F01","F02","F03","F04","F05","F06","F07"];
export function evaluateV71({localQa,source,remote=null}){
 const byId=Object.fromEntries(source.checks.map(c=>[c.id,c]));
 const sourceGatesPass=REQUIRED.every(id=>byId[id]?.state==="pass");
 const localSafe=localQa?.pass===true&&localQa?.qaEnabled===false&&
  localQa?.publicFlagsOff===true;
 const remoteDecision=remote?decide(remote,{expectV66:true}):null;
 const remoteSafe=remoteDecision?.pass===true&&
  remote.status?.publicSignupEnabled===false&&
  remote.status?.publicAccessEnabled===false;
 const reasons=[];
 if(!localSafe)reasons.push("LOCAL_QA_OR_PUBLIC_FLAGS_NOT_OFF");
 if(!sourceGatesPass)reasons.push("SOURCE_SECURITY_GATE_INCOMPLETE");
 if(remote&&!remoteSafe)reasons.push("REMOTE_PUBLIC_GATE_OR_SITE_UNEXPECTED");
 if(!remote)reasons.push("REMOTE_STATUS_NOT_CHECKED");
 for(const mandatory of [
  "LEGAL_PDPA_TERMS_PRIVACY_APPROVAL_REQUIRED",
  "REAL_PUBLIC_SIGNUP_BROWSER_EMAIL_APPCHECK_TEST_REQUIRED",
  "MULTI_ACCOUNT_ABUSE_CONTROLS_AND_FIREBASE_COST_LIMITS_REQUIRED",
  "PUBLIC_FREE_DEVICE_AND_IDEMPOTENCY_RELEASE_EVIDENCE_REQUIRED",
  "OWNER_GO_NO_GO_SIGNOFF_REQUIRED"
 ])reasons.push(mandatory);
 return {
  version:"7.1",
  project:PROJECT,
  scope:"FREE-FIRST / READ-ONLY / NO PUBLIC ROLLOUT / OMise LIVE OFF",
  readyForPublic:false,
  decision:"NO_GO_PUBLIC",
  local:{qaOff:localQa?.qaEnabled===false,
   publicFlagsOff:localQa?.publicFlagsOff===true},
  source:{criticalPass:sourceGatesPass,pass:source.counts.pass,
   blocked:source.counts.blocked,manual:source.counts.manual},
  remote:remote?{
   statusChecked:true,httpPass:remoteDecision.pass,
   publicSignupEnabled:remote.status?.publicSignupEnabled,
   publicAccessEnabled:remote.status?.publicAccessEnabled
  }:{statusChecked:false},
  reasons,
  note:"Existing V7.0 one-UID real QA passed, but it is NOT open-public signup evidence. This run never deploys or enables signup."
 };
}
export function loadLocalQa(){
 const file=path.join(ROOT,"functions",".env."+PROJECT);
 if(!fs.existsSync(file))throw Error("SAFETY BLOCK: exact Production Functions dotenv missing");
 const generic=path.join(ROOT,"functions",".env");
 return checkQaEnvironment({
  specific:fs.readFileSync(file,"utf8"),
  generic:fs.existsSync(generic)?fs.readFileSync(generic,"utf8"):"",
  mode:"--qa-off",environment:process.env
 });
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  const args=process.argv.slice(2);
  if(args[0]!==PROJECT||args.slice(1).some(x=>x!=="--remote")||args.length>2)
   throw Error("Usage: node scripts/v71-public-readiness.mjs packtook-prod-01 [--remote]");
  const localQa=loadLocalQa();
  const source=inspectSource(collectLocalSource());
  const remote=args.includes("--remote")?await probe():null;
  const result=evaluateV71({localQa,source,remote});
  console.log(JSON.stringify(result,null,2));
  console.log("RESULT: V7.1 READ-ONLY PUBLIC LAUNCH NO-GO (as expected; no changes made)");
  if(result.reasons.some(x=>x.startsWith("LOCAL_")||x.startsWith("SOURCE_")||
     x.startsWith("REMOTE_PUBLIC_GATE")))process.exitCode=2;
 }catch(e){console.error(e.message);process.exitCode=2}
}
