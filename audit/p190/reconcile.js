"use strict";
// P190 G02 — offline-only reconciliation. Evidence metadata never authorizes cloud access.
// Self-declared approvals are never promoted to an independently verified release GO.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const SHA=/^[a-f0-9]{64}$/,TICKET=/^G02-[A-Z0-9-]{8,60}$/;
const EXPECTED_CANDIDATE="c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b";
const REQUIREMENTS=Object.freeze({
 STAGING_LEGACY_INVENTORY:{project:"packtook-staging",kind:"OPERATOR_FIRESTORE_AUTH_READ_ONLY"},
 PROD_LEGACY_INVENTORY:{project:"packtook-prod-01",kind:"OPERATOR_FIRESTORE_AUTH_READ_ONLY"},
 STAGING_VALID_APPCHECK:{project:"packtook-staging",kind:"REAL_APPCHECK_POSITIVE_NEGATIVE"},
 OWNER_PROVENANCE_REMEDIATION:{project:"packtook-prod-01",kind:"INDEPENDENT_OWNER_PROVENANCE_REVIEW"},
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:{project:"packtook-staging",kind:"INDEPENDENT_SECURITY_DIFF_REVIEW"}
});
const KEYS=Object.keys(REQUIREMENTS);
function metadataOnly(value){
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const keys=Object.keys(value);
 return keys.every(k=>["requirement","project","kind","candidateSha256","artifactSha256",
  "ticket","capturedAt","operatorRole","summaryStatus","recordCount","complete",
  "authLookupErrors","ownerConflictsResolved","reviewDecision"].includes(k));
}
function inspectItem(requirement,item,asOf){
 const issues=[];
 const spec=REQUIREMENTS[requirement];
 if(!metadataOnly(item))return ["UNTRUSTED_OR_UNEXPECTED_METADATA"];
 if(item.requirement!==requirement)issues.push("WRONG_REQUIREMENT");
 if(item.project!==spec.project)issues.push("WRONG_PROJECT");
 if(item.kind!==spec.kind)issues.push("WRONG_EVIDENCE_CLASS");
 if(item.candidateSha256!==EXPECTED_CANDIDATE)issues.push("CANDIDATE_MISMATCH");
 if(!SHA.test(item.artifactSha256||""))issues.push("ARTIFACT_DIGEST_MISSING");
 if(!TICKET.test(item.ticket||""))issues.push("APPROVAL_TICKET_MISSING");
 const parsed=typeof item.capturedAt==="string"?Date.parse(item.capturedAt):NaN;
 const now=Date.parse(asOf);
 if(!Number.isFinite(parsed)||!Number.isFinite(now)||
   parsed>now||now-parsed>30*86400000)issues.push("EVIDENCE_DATE_INVALID_OR_STALE");
 if(!["CloudOperator","AppCheckOperator","SecurityReviewer"].includes(item.operatorRole))
  issues.push("OPERATOR_ROLE_UNRECOGNIZED");
 if(item.summaryStatus!=="PASS")issues.push("RESULT_NOT_PASS");
 if(["STAGING_LEGACY_INVENTORY","PROD_LEGACY_INVENTORY"].includes(requirement)){
  if(item.complete!==true)issues.push("INVENTORY_INCOMPLETE");
  if(!Number.isSafeInteger(item.recordCount)||item.recordCount<0)issues.push("INVENTORY_COUNT_INVALID");
  if(item.authLookupErrors!==0)issues.push("AUTH_LOOKUPS_UNRESOLVED");
 }
 if(requirement==="OWNER_PROVENANCE_REMEDIATION"&&item.ownerConflictsResolved!==true)
  issues.push("OWNER_CONFLICTS_UNRESOLVED");
 if(requirement==="EXACT_RELEASE_DIFF_SECURITY_SIGNOFF"&&item.reviewDecision!=="APPROVED_FOR_STAGING_REVIEW")
  issues.push("SECURITY_REVIEW_NOT_APPROVED");
 // Even syntactically impeccable metadata remains untrusted self-assertion.
 return issues;
}
function reconcile({claims={},asOf="2026-11-24T23:59:59+07:00"}={}){
 if(!claims||typeof claims!=="object"||Array.isArray(claims))throw Error("P190_INVALID_CLAIMS");
 const unknown=Object.keys(claims).filter(x=>!KEYS.includes(x));
 if(unknown.length)throw Error("P190_UNEXPECTED_EVIDENCE_REQUIREMENT");
 const records=KEYS.map(key=>{
  const item=claims[key];
  if(item===undefined||item===null)return {id:key,state:"MISSING",issues:["EVIDENCE_NOT_SUPPLIED"]};
  const issues=inspectItem(key,item,asOf);
  return {id:key,state:issues.length?"REJECTED_METADATA":"CLAIMED_NOT_INDEPENDENTLY_VERIFIED",issues};
 });
 return {
  schema:"packtook-p190-g02-reconciliation-v1",
  candidateSha256:EXPECTED_CANDIDATE,
  localEvidence:{tracksPassed:4,tracksTotal:4,scope:"DEMO_EMULATOR_OR_OFFLINE_ONLY"},
  externalEvidence:{requirementsTotal:KEYS.length,
   missing:records.filter(x=>x.state==="MISSING").length,
   rejected:records.filter(x=>x.state==="REJECTED_METADATA").length,
   claimedUnverified:records.filter(x=>x.state==="CLAIMED_NOT_INDEPENDENTLY_VERIFIED").length,
   independentlyVerified:0,records},
  securityReviewerIndependentlyVerified:false,
  readyForHumanIndependentReview:records.every(x=>x.state==="CLAIMED_NOT_INDEPENDENTLY_VERIFIED"),
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",deployDecision:"NO_GO_DEPLOY",
  publicSignup:"KEEP_CLOSED",productionRuntimeAttested:false,
  note:"Metadata digest, ticket and role assertions are not independently authenticated. NO_GO even if all claims pass syntax validation."
 };
}
function safeCLI(){
 const file=process.argv[2];
 if(process.argv.length>3)throw Error("P190_USAGE");
 if(!file)return reconcile();
 const filePath=path.resolve(file);
 // CI must not load external evidence from arbitrary source paths or network.
 if(process.env.CI==="true"||process.env.GITHUB_ACTIONS==="true")
  throw Error("P190_CI_EXTERNAL_INPUT_REFUSED");
 const st=fs.lstatSync(filePath);
 if(!st.isFile()||st.isSymbolicLink()||st.size>8192)throw Error("P190_EVIDENCE_FILE_UNTRUSTED");
 return reconcile({claims:JSON.parse(fs.readFileSync(filePath,"utf8"))});
}
if(require.main===module){
 try{
  const r=safeCLI();
  console.log("P190_G02_RECONCILIATION="+JSON.stringify(r));
  console.log("P190_NO_GO_RELEASE=TRUE");
 }catch(e){
  console.error("P190_BLOCK="+(e.message.startsWith("P190_")?e.message:"INVALID_EVIDENCE_INPUT_REDACTED"));
  process.exitCode=1;
 }
}
module.exports={reconcile,inspectItem,REQUIREMENTS,EXPECTED_CANDIDATE};
