"use strict";
/**
 * P215 G02 independent-review preflight — fail closed.
 * Repository integrity and local CI coverage are NOT deployed-Staging proof,
 * Auth/Firestore production inventory, App Check evidence, or independent approval.
 * No G02, release, deploy, signup, or IAM action is exposed.
 */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {inspect:reviewPacket}=require("../p214/packet");
const {REQUIREMENTS,EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {record}=require("../p172-release-gates");
const {BUILD,REVISION}=require("../p198/verify");
const {SOURCE}=require("../p199/verify");
const G02="G02_BACKEND_AUTH";
const ROOT=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const blob=p=>{
 const b=Buffer.from(read(p));
 return crypto.createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
};
const CHECKS=Object.freeze([
 {id:"P188_SOURCE_PIN_AND_EXACT_DIFF",kind:"REPO_STATIC",requires:"P188 six-edit SHA256 + P189 verify",scope:"LOCAL",
  action:"Pin source bundle and independently compare exact deployment source"},
 {id:"P211_OWNER_LEGACY_EMULATOR",kind:"DEMO_EMULATOR",requires:"23 real Auth/Firestore handler cases",scope:"LOCAL",
  action:"Independent reviewer validates real Staging handler authorization"},
 {id:"P212_CALLABLE_HTTP_LOCAL",kind:"DEMO_LOCAL_HTTP",requires:"23 local SDK onCall/Express cases",scope:"LOCAL",
  action:"Re-test authorized staging callable HTTP and verify actual deployed source"},
 {id:"P213_MUTATION_NEGATIVES",kind:"DEMO_EMULATOR",requires:"8 detected Owner/tenant mutations + 20 fixtures",scope:"LOCAL",
  action:"Review mutation gaps and security semantics independently"},
 {id:"STAGING_READ_ONLY_LEGACY_ACCOUNT_INVENTORY",kind:"EXTERNAL_CLOUD_EVIDENCE",requires:"Independent complete staging Auth/Firestore owner inventory",scope:"STAGING",
  action:"Approved staging operator captures complete protected inventory and reviewer validates conflicts"},
 {id:"STAGING_RUNTIME_AUTHZ_WITH_DEPLOY_PIN",kind:"EXTERNAL_CLOUD_EVIDENCE",requires:"Positive and negative Auth/Owner probes on proven deployed P188 source",scope:"STAGING",
  action:"Prove source ZIP -> build image -> revision -> executable handler; run authorized tenant negatives"},
 {id:"STAGING_APPCHECK_TOKEN_PROVENANCE",kind:"EXTERNAL_CLOUD_EVIDENCE",requires:"Real valid and invalid App Check token provenance, positive/negative probe",scope:"STAGING",
  action:"Independent Staging App Check review, with credentials never published"},
 {id:"LEGACY_OWNER_PROVENANCE_AND_CONFLICTS",kind:"EXTERNAL_SECURITY_REVIEW",requires:"Independent identity/owner conflicts remediation review",scope:"SEPARATELY_AUTHORIZED",
  action:"Review Owner conflicts without automatic grants/backfills"},
 {id:"P188_EXACT_DIFF_INDEPENDENT_SIGNOFF",kind:"EXTERNAL_SECURITY_REVIEW",requires:"Independently authenticated security reviewer for exact P188 candidate",scope:"STAGING",
  action:"Reviewer validates original protected evidence, source provenance and exact release diff"},
 {id:"PRODUCTION_READ_AUTHORIZATION",kind:"SEPARATE_AUTHORIZATION",requires:"Explicit authorization before production Auth/Firestore read",scope:"PRODUCTION",
  action:"Do not read production without separate explicit production read authorization"}
]);
const OWNED=Object.freeze({
 G02_BACKEND_AUTH:[
 "STAGING_READ_ONLY_LEGACY_ACCOUNT_INVENTORY",
 "STAGING_RUNTIME_AUTHZ_WITH_DEPLOY_PIN",
 "LEGACY_OWNER_PROVENANCE_AND_CONFLICTS",
 "P188_EXACT_DIFF_INDEPENDENT_SIGNOFF"],
 G03_CALLABLE_INVALID_TOKEN_PROTOCOL:["STAGING_RUNTIME_AUTHZ_WITH_DEPLOY_PIN"],
 G04_PRODUCTION_TOKEN_SIGNATURE:["PRODUCTION_READ_AUTHORIZATION"],
 G05_RECOVERED_OWNER_PROVENANCE:["LEGACY_OWNER_PROVENANCE_AND_CONFLICTS"],
 G06_APP_CHECK_IAM_SECRETS:["STAGING_APPCHECK_TOKEN_PROVENANCE"],
 G07_BILLING_MONITORING_LEGAL:[],
 G08_OWNER_RELEASE_APPROVAL:[]
});
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function preflight({metadata={},sourceOverride,manifestOverride}={}){
 if(!isObj(metadata))throw Error("P215_METADATA_MUST_BE_OBJECT");
 const issues=[];
 // This packet only has a known authenticated source of local repo bytes,
 // *not* provider credentials; metadata cannot attest external evidence.
 const supplied=Object.keys(metadata);
 if(supplied.length)issues.push("USER_OR_CI_METADATA_IS_NOT_EXTERNAL_ATTESTATION");
 const source=sourceOverride===undefined?read("audit/p188/candidate-index.js"):sourceOverride;
 const staticPacket=reviewPacket({source});
 if(staticPacket.classification!=="STATIC_INTEGRITY_ONLY")
  issues.push("P214_STATIC_INTEGRITY_NOT_PASS");
 const manifest=manifestOverride===undefined?record:manifestOverride;
 if(!isObj(manifest)||!Array.isArray(manifest.gates))
  issues.push("INVALID_RELEASE_GATE_RECORD");
 const gates=Array.isArray(manifest?.gates)?manifest.gates:[];
 if(gates.length!==8||new Set(gates.map(x=>x.id)).size!==8)
  issues.push("EIGHT_RELEASE_GATE_IDS_DRIFT");
 if(!gates.some(x=>x.id===G02&&x.status==="NO_GO"))
  issues.push("G02_HISTORICAL_GATE_DRIFT");
 if(gates.some(x=>x.status!=="NO_GO"))
  issues.push("UNAUTHORIZED_RELEASE_GATE_PROMOTION");
 if(manifest?.decision!=="NO_GO_RELEASE"||manifest?.deployment!=="NO_GO_DEPLOY"||
    manifest?.verified_production_runtime!==false)
  issues.push("UNAUTHORIZED_RELEASE_DECISION_DRIFT");
 const p190=Object.keys(REQUIREMENTS);
 if(p190.length!==5)issues.push("FIVE_EXTERNAL_EVIDENCE_TRACKS_DRIFT");
 if(manifest===record&&blob("functions/index.js")!==manifest.source_pins["functions/index.js"])
  issues.push("PRODUCTION_SOURCE_BLOB_DRIFT");
 const localRows=CHECKS.map(c=>{
  const staticOk=c.id==="P188_SOURCE_PIN_AND_EXACT_DIFF"&&
   staticPacket.classification==="STATIC_INTEGRITY_ONLY";
  return {...c,
   state:staticOk?"LOCAL_STATIC_PIN_VERIFIED":
    c.scope==="LOCAL"?"DEMO_TESTS_REPORTED_CI_NOT_ATTESTED_BY_PACKET":
    "EXTERNAL_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED",
   independentExternalVerification:false,executionPermissionGranted:false};
 });
 const gateRows=gates.map(g=>({id:g.id,state:"NO_GO",
  reason:g.reason,
  dependencies:OWNED[g.id]||[],
  independentlyVerified:false}));
 return {
  schema:"packtook-p215-g02-final-security-preflight-v1",
  scope:"REVIEW_ONLY_NO_CLOUD",
  candidateSha256:EXPECTED_CANDIDATE,
  sourceBuild:BUILD,reportedRevision:REVISION,reportedSourceGeneration:SOURCE,
  classification:issues.length?"REJECTED":"SAFE_TO_HANDOFF_NOT_SAFE_TO_RELEASE",
  issues,checklist:localRows,gateRows,
  p190ExternalRequirementIds:p190,
  localCheckCount:4,externalOrAuthorizationCheckCount:6,
  g02ClosureRequirements:OWNED[G02],
  independentEvidenceVerified:0,
  independentSecurityReviewPerformed:false,
  stagingSourceByteIdentityProven:false,
  stagingRuntimeAuthorizationVerified:false,
  productionReadAuthorized:false,
  appCheckValidTokenProven:false,
  g02GateId:G02,g02Decision:"NO_GO",
  releaseGatesPassed:0,releaseGatesTotal:8,
  releaseDecision:"NO_GO_RELEASE",deployDecision:"NO_GO_DEPLOY",
  publicSignup:"KEEP_CLOSED",
  cloudReads:0,cloudWrites:0,
  note:"Local test PASS != G02 signoff. Review authorization and protected original runtime evidence are mandatory and external."
 };
}
function markdown(r){
 const rows=r.checklist.map(x=>"| "+x.id+" | "+x.scope+" | "+
  x.state+" | "+x.action+" |").join("\n");
 return "# PACKTOOK P215 G02 Final Review Preflight\n\n"+
 "Review state: **"+r.classification+"** — G02 **NO_GO**, release **NO_GO_RELEASE**, signup **KEEP_CLOSED**.\n\n"+
 "Candidate SHA256: `"+r.candidateSha256+"`\n\n"+
 "| Check | Scope | Evidence state | Next evidence action |\n"+
 "| --- | --- | --- | --- |\n"+rows+"\n\n"+
 "**Independent security signoff: not performed.** Five P190 external tracks verified: **0/5**. Release gates: **0/8**.\n\n"+
 "P211/P212/P213 CI results are local emulator coverage; verify their independent origin separately. Never publish raw tokens, UID/email, sources, or protected account inventory.\n";
}
module.exports={preflight,markdown,CHECKS,OWNED};
