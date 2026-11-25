"use strict";
/**
 * P214 G02 reviewer packet — repository-bound, fail-closed, offline-only.
 * This proves only code/test fixture integrity and whether CI executes checks;
 * original provider logs, review signoff, real staging source and cloud runtime
 * cannot be independently verified here. Never promotes release GO.
 */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const {record}=require("../p172-release-gates");
const {EXPECTED_CANDIDATE,REQUIREMENTS}=require("../p190/reconcile");
const {local:reconcileGates}=require("../p209/reconcile");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const digest=s=>crypto.createHash("sha256").update(s).digest("hex");
const TESTS=Object.freeze([
 {phase:"P211",script:"audit/p211/emulator-integration.js",workflow:".github/workflows/p211-g02-auth-firestore-emulator.yml",command:"node audit/p211/emulator-integration.js",output:"P211_REAL_AUTH_FIRESTORE_EMULATOR_HANDLER_TESTS=23/23_PASS",expected:23,scope:"ACTUAL_AUTH_AND_FIRESTORE_EMULATORS_DIRECT_HANDLER"},
 {phase:"P212",script:"audit/p212/http-integration.js",workflow:".github/workflows/p212-g02-callable-http.yml",command:"node audit/p212/http-integration.js",output:"P212_REAL_CALLABLE_HTTP_FIREBASE_EMULATOR_TESTS=23/23_PASS",expected:23,scope:"ACTUAL_ONCALL_SDK_LOCAL_EXPRESS_AUTH_FIRESTORE"},
 {phase:"P213",script:"audit/p213/authz-mutation-emulator.js",workflow:".github/workflows/p213-g02-authz-mutation.yml",command:"node audit/p213/authz-mutation-emulator.js",output:"P213_REAL_FIREBASE_AUTH_FIRESTORE_EMULATOR_FIXTURES=20/20_PASS",expected:20,scope:"LOCAL_AUTH_FIRESTORE_MUTATION_DEMO"}
]);
const isObj=x=>x&&typeof x==="object"&&!Array.isArray(x);
function inspect({source=read("audit/p188/candidate-index.js"),files={},claims={}}={}){
 const issues=[];
 if(!isObj(files)||!isObj(claims))throw Error("P214_INPUT_MUST_BE_OBJECT");
 if(Object.keys(claims).length)issues.push("EXTERNAL_CLAIMS_NOT_AUTHENTICATED");
 const file=p=>Object.hasOwn(files,p)?files[p]:read(p);
 if(typeof source!=="string"||digest(source)!==EXPECTED_CANDIDATE)
  issues.push("P188_EXACT_CANDIDATE_SHA256_MISMATCH");
 const manifest=JSON.parse(file("audit/p189/evidence.json"));
 if(manifest.sourcePins?.isolatedCandidateSha256!==EXPECTED_CANDIDATE)
  issues.push("P189_PIN_NOT_EQUAL_TO_P188");
 const phases=[];
 for(const t of TESTS){
  const script=file(t.script),workflow=file(t.workflow);
  const problems=[];
  if(typeof script!=="string"||typeof workflow!=="string"){
   problems.push("INVALID_FILE_CONTENT");
  }else{
   if(!script.includes(t.output))problems.push("EXPECTED_TEST_COMPLETION_MARKER_MISSING");
   if(!workflow.includes(t.command))problems.push("WORKFLOW_DOES_NOT_INVOKE_TEST");
   if(!workflow.includes("audit/p188/build-rc.js"))problems.push("PINNED_CANDIDATE_BUILD_MISSING");
   if(!workflow.includes("audit/p189/verify.js"))problems.push("SOURCE_DIFF_PIN_CHECK_MISSING");
   if(!workflow.includes("demo-packtook-p184"))problems.push("DEMO_PROJECT_GUARD_MISSING");
   if(!workflow.includes("node audit/p172-release-gates.js"))problems.push("NO_GO_GATE_REGRESSION_MISSING");
   if(t.phase==="P211"&&!script.includes("auth.verifyIdToken("))problems.push("AUTH_EMULATOR_TOKEN_VERIFIER_MISSING");
   if(t.phase==="P211"&&!script.includes("db.runTransaction")&&!script.includes("handlers.authorizeDuplicate("))problems.push("REAL_HANDLER_MISSING");
   if(t.phase==="P212"&&!script.includes("sdk; // ACTUAL Firebase callable onCall wrapper"))problems.push("REAL_ONCALL_WRAPPER_NOT_USED");
   if(t.phase==="P213"&&!script.includes("assert.equal(killed,8)"))problems.push("MUTATIONS_NOT_ASSERTED");
  }
  if(problems.length)issues.push(...problems.map(p=>t.phase+"_"+p));
  phases.push({phase:t.phase,expectedFixtures:t.expected,scope:t.scope,
   scriptSha256:typeof script==="string"?digest(script):null,
   workflowSha256:typeof workflow==="string"?digest(workflow):null,
   sourcePath:t.script,workflowPath:t.workflow,
   integrity:problems.length?"REJECTED":"REPOSITORY_SOURCE_CHECKED",
   outcome:"NOT_EXECUTED_BY_THIS_REPORT",
   providerRunIndependentAttestation:false,issues:problems});
 }
 const g02=record.gates.find(x=>x.id==="G02_BACKEND_AUTH");
 if(!g02||g02.status!=="NO_GO")issues.push("HISTORICAL_G02_GATE_DRIFT");
 if(record.gates.length!==8||record.gates.some(x=>x.status!=="NO_GO"))
  issues.push("HISTORICAL_RELEASE_GATES_DRIFT");
 const review=reconcileGates();
 if(review.g02Decision!=="NO_GO"||review.releaseDecision!=="NO_GO_RELEASE")
  issues.push("P209_GATE_RECONCILIATION_DRIFT");
 const blockers=[
  "P188_EXACT_SOURCE_NOT_ATTESTED_AS_DEPLOYED",
  "INDEPENDENT_G02_OWNER_AUTHORIZATION_REVIEW_MISSING",
  "APPROVED_STAGING_RUNTIME_OWNER_NEGATIVES_MISSING",
  "LEGACY_OWNER_PROVENANCE_NOT_INDEPENDENTLY_VERIFIED",
  "STAGING_APPCHECK_POSITIVE_NEGATIVE_NOT_VERIFIED",
  "PRODUCTION_RELEASE_GATES_STILL_BLOCKED"
 ];
 return {schema:"packtook-p214-g02-review-packet-v1",
  classification:issues.length?"REJECTED":"STATIC_INTEGRITY_ONLY",
  projectScope:"DEMO_ONLY_NO_CLOUD",
  pinnedCandidateSha256:EXPECTED_CANDIDATE,
  phases,expectedDemoFixtures:66,expectedMutations:8,
  totalExpectedTestsDoesNotProveCurrentRun:true,
  staticSourceChecked:issues.length===0,
  independentExternalEvidenceVerified:0,
  independentG02Signoff:false,p188DeployedInStagingVerified:false,
  actualStagingRuntimeTestedByThisPacket:false,
  g02GateId:"G02_BACKEND_AUTH",g02Decision:"NO_GO",
  releaseGateCount:8,releaseGatesPassed:0,
  releaseDecision:"NO_GO_RELEASE",deployDecision:"NO_GO_DEPLOY",
  publicSignup:"KEEP_CLOSED",productionReadAuthorized:false,
  cloudCalls:0,cloudWrites:0,issues,blockers};
}
function markdown(result){
 const rows=result.phases.map(x=>"| "+x.phase+" | "+x.expectedFixtures+
 " | "+x.integrity+" | "+x.outcome+" |").join("\n");
 return "# PACKTOOK P214 G02 Reviewer Handoff\n\n"+
 "**G02: NO_GO | Release: NO_GO_RELEASE | Signup: KEEP_CLOSED**\n\n"+
 "Source integrity classification: "+result.classification+
 ". No live staging or independent security attestation.\n\n"+
 "| Phase | Expected local test cases | Integrity | This packet run |\n"+
 "| --- | ---: | --- | --- |\n"+rows+"\n\n"+
 "Remaining blockers: "+result.blockers.join("; ")+
 "\n\nIndependent G02 signoff: **NOT VERIFIED**. Release gates: **0/8**.\n";
}
module.exports={inspect,markdown,TESTS};
