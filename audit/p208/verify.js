"use strict";
/** P208: offline sanitized runtime App Check evidence, NEVER a live token probe.
 * A 200/403 comparison is necessary but not sufficient to prove enforcement.
 */
const {PROJECT,REVISION,BUILD}=require("../p198/verify");
const {TARGET,ENDPOINT}=require("../p195/reconcile");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const CASES=["MISSING_TOKEN","VALID_TOKEN","INVALID_TOKEN"];
const KEYS=new Set(["case","project","functionResource","endpoint","revision",
 "build","candidateSha256","method","requestShape","httpStatus","resultClass",
 "tokenOrigin","tokenValidatedByTrustedVerifier","authContextChecked",
 "pinnedRevisionConfirmedExternally","observedAt","evidenceDigest",
 "reviewTicket","isFixture","reviewerClaim"]);
const validObject=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
function inspectCase(x){
 const errors=[],unverified=[];
 const fail=(ok,code)=>{if(!ok)errors.push(code)};
 if(!validObject(x)||Object.keys(x).some(k=>!KEYS.has(k)))
  return {case:"UNKNOWN",classification:"REJECTED",errors:["UNSAFE_OR_UNEXPECTED_FIELDS"],unverified:[]};
 const type=CASES.includes(x.case)?x.case:"UNKNOWN";
 fail(type!=="UNKNOWN","UNKNOWN_TEST_CASE");
 fail(x.project===PROJECT,"PROJECT_DRIFT");
 fail(x.functionResource===TARGET,"FUNCTION_DRIFT");
 fail(x.endpoint===ENDPOINT,"ENDPOINT_DRIFT");
 fail(x.revision===REVISION,"REVISION_DRIFT");
 fail(x.build===BUILD,"BUILD_DRIFT");
 fail(x.candidateSha256===EXPECTED_CANDIDATE,"CANDIDATE_DRIFT");
 fail(x.method==="POST","METHOD_DRIFT");
 fail(x.requestShape==="FIREBASE_CALLABLE_JSON","CALLABLE_REQUEST_SHAPE_DRIFT");
 fail(Number.isInteger(x.httpStatus)&&x.httpStatus>=100&&x.httpStatus<=599,"INVALID_HTTP_STATUS");
 fail(typeof x.observedAt==="string"&&Number.isFinite(Date.parse(x.observedAt)),"TIMESTAMP_INVALID");
 fail(typeof x.evidenceDigest==="string"&&/^[a-f0-9]{64}$/.test(x.evidenceDigest),"EVIDENCE_HASH_INVALID");
 fail(typeof x.reviewTicket==="string"&&/^G02-[A-Z0-9-]{8,60}$/.test(x.reviewTicket),"TICKET_INVALID");
 fail(x.isFixture!==true,"SYNTHETIC_FIXTURE_NOT_REAL");
 if(type==="MISSING_TOKEN"){
  fail(x.tokenOrigin==="ABSENT","NEGATIVE_TOKEN_NOT_ABSENT");
  fail([401,403].includes(x.httpStatus),"MISSING_TOKEN_NOT_DENIED");
  fail(x.resultClass==="DENIED","NEGATIVE_OUTCOME_DRIFT");
 }else if(type==="VALID_TOKEN"){
  fail(x.tokenOrigin==="STAGING_LEGITIMATE_CLIENT","TOKEN_ORIGIN_NOT_STAGING");
  fail(x.httpStatus===200,"VALID_TOKEN_NOT_ACCEPTED");
  fail(x.resultClass==="ACCEPTED","POSITIVE_OUTCOME_DRIFT");
 }else if(type==="INVALID_TOKEN"){
  fail(x.tokenOrigin==="INVALID_TEST_TOKEN","INVALID_TEST_TOKEN_ORIGIN_NOT_PINNED");
  fail([401,403].includes(x.httpStatus),"INVALID_TOKEN_NOT_DENIED");
  fail(x.resultClass==="DENIED","INVALID_TOKEN_OUTCOME_DRIFT");
 }
 if(x.tokenValidatedByTrustedVerifier!==true)unverified.push("TOKEN_VALIDATION_NOT_ATTESTED");
 if(x.authContextChecked!==true)unverified.push("AUTH_CONTEXT_NOT_VERIFIED");
 if(x.pinnedRevisionConfirmedExternally!==true)unverified.push("LIVE_REVISION_ROUTING_NOT_ATTESTED");
 unverified.push("EXTERNAL_REVIEWER_IDENTITY_NOT_AUTHENTICATED");
 return {case:type,classification:errors.length?"REJECTED":"CLAIMED_NOT_INDEPENDENTLY_VERIFIED",
  errors,unverified};
}
function reconcile({observations=[]}={}){
 if(!Array.isArray(observations)||observations.length>12)throw Error("P208_INVALID_BATCH");
 const seen=new Set();
 const results=observations.map(x=>{
  const result=inspectCase(x);
  if(result.classification!=="REJECTED"){
   if(seen.has(result.case))return {...result,classification:"REJECTED",errors:["REPLAY_OR_DUPLICATE_CASE"]};
   seen.add(result.case);
  }
  return result;
 });
 const accepted=results.filter(x=>x.classification==="CLAIMED_NOT_INDEPENDENTLY_VERIFIED").map(x=>x.case);
 const missing=CASES.filter(x=>!accepted.includes(x));
 return {
  schema:"packtook-p208-appcheck-runtime-evidence-v1",
  scope:"STAGING_OFFLINE_METADATA_ONLY",
  project:PROJECT,functionResource:TARGET,referenceRevision:REVISION,
  requiredTestCases:CASES,results,missingCases:missing,
  claimedCases:accepted.length,rejected:results.filter(x=>x.classification==="REJECTED").length,
  reportedPositiveNegativePairPresent:accepted.includes("MISSING_TOKEN")&&accepted.includes("VALID_TOKEN"),
  independentlyVerifiedAppCheck:false,
  actualEndpointRequestsPerformed:0,
  cryptographicTokenVerificationPerformed:false,
  revisionRoutingIndependentlyVerified:false,
  p188CandidateDeployedVerified:false,
  externalG02RequirementsVerified:0,
  executionAuthorizedByReport:false,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED",
  note:"HTTP status, self-reported token provenance and revision labels alone never prove actual App Check enforcement or deploy authorization."
 };
}
module.exports={reconcile,inspectCase,CASES};
