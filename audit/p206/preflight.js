"use strict";
/** P206 OFFLINE preflight for a separately authorized review.
 * Never calls gcloud/HTTP, verifies a token, accepts credentials or grants authority.
 */
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {BUILD,REVISION,PROJECT}=require("../p198/verify");
const {SOURCE}=require("../p199/verify");
const {dashboard}=require("../p205/dashboard");
const TRACKS=["STAGING_APPCHECK_NEGATIVE","STAGING_APPCHECK_POSITIVE",
 "SOURCE_ARCHIVE_PROVENANCE","BUILD_OUTPUT_DIGEST","REVISION_IMAGE_DIGEST",
 "INDEPENDENT_DIFF_REVIEW","STAGING_AUTH_FIRESTORE_INVENTORY",
 "PROD_AUTH_FIRESTORE_INVENTORY","OWNER_PROVENANCE_REVIEW"];
const pins=Object.freeze({project:PROJECT,function:"usageStatus",region:"asia-southeast1",
 revision:REVISION,build:BUILD,sourceGeneration:SOURCE,candidate:EXPECTED_CANDIDATE});
const isObj=o=>o!==null&&typeof o==="object"&&!Array.isArray(o);
const allowed=new Set(["track","project","function","region","revision","build",
 "sourceGeneration","candidate","ticket","operatorRole","approvalScope",
 "readOnly","syntheticFixture","evidenceDigest","observedAt","result"]);
const sha=/^[a-f0-9]{64}$/;
const ticket=/^G02-[A-Z0-9-]{8,60}$/;
const checks=Object.freeze({
 STAGING_APPCHECK_NEGATIVE:{project:PROJECT,role:"Staging App Check Operator",scope:"STAGING_PROBE",result:"DENIED_WITHOUT_TOKEN"},
 STAGING_APPCHECK_POSITIVE:{project:PROJECT,role:"Staging App Check Operator",scope:"STAGING_PROBE",result:"VALID_TOKEN_ACCEPTED"},
 SOURCE_ARCHIVE_PROVENANCE:{project:PROJECT,role:"Staging Cloud Operator",scope:"STAGING_READ",result:"SOURCE_ARCHIVE_IDENTIFIED"},
 BUILD_OUTPUT_DIGEST:{project:PROJECT,role:"Staging Cloud Operator",scope:"STAGING_READ",result:"IMAGE_DIGEST_MATCHES"},
 REVISION_IMAGE_DIGEST:{project:PROJECT,role:"Staging Cloud Operator",scope:"STAGING_READ",result:"REVISION_DIGEST_CONSISTENT"},
 INDEPENDENT_DIFF_REVIEW:{project:PROJECT,role:"Independent Security Reviewer",scope:"REVIEW_ONLY",result:"PINNED_DIFF_REVIEWED"},
 STAGING_AUTH_FIRESTORE_INVENTORY:{project:PROJECT,role:"Staging Cloud Operator",scope:"STAGING_READ",result:"COMPLETE_NO_CONFLICTS"},
 PROD_AUTH_FIRESTORE_INVENTORY:{project:"packtook-prod-01",role:"Separately authorized Production Cloud Operator",scope:"PRODUCTION_READ_SEPARATE",result:"COMPLETE_NO_CONFLICTS"},
 OWNER_PROVENANCE_REVIEW:{project:"packtook-prod-01",role:"Independent Security Reviewer",scope:"REVIEW_ONLY",result:"OWNER_CONFLICTS_REVIEWED"}
});
function verifyOne(o){
 const errors=[];
 if(!isObj(o)||Object.keys(o).some(k=>!allowed.has(k)))
  return {track:"UNKNOWN",state:"REJECTED",issues:["UNSAFE_FIELDS_OR_PII"]};
 const track=o.track,spec=checks[track];
 const check=(ok,c)=>{if(!ok)errors.push(c)};
 check(!!spec,"UNKNOWN_TRACK");
 if(spec){
  check(o.project===spec.project,"WRONG_PROJECT");
  check(o.operatorRole===spec.role,"ROLE_CLAIM_DRIFT");
  check(o.approvalScope===spec.scope,"SCOPE_NOT_PINNED");
  check(o.result===spec.result,"UNEXPECTED_RESULT");
 }
 for(const [k,value] of Object.entries({function:pins.function,region:pins.region,
  revision:pins.revision,build:pins.build,sourceGeneration:pins.sourceGeneration,
  candidate:pins.candidate})){
  check(o[k]===value,"DRIFT_"+k.toUpperCase());
 }
 check(o.readOnly===true,"READ_ONLY_REQUIRED");
 check(o.syntheticFixture!==true,"SYNTHETIC_MUST_NOT_BE_SUBMITTED");
 check(ticket.test(o.ticket||""),"TICKET_FORMAT_INVALID");
 check(sha.test(o.evidenceDigest||""),"EVIDENCE_DIGEST_INVALID");
 const stamp=Date.parse(o.observedAt);
 check(typeof o.observedAt==="string"&&Number.isFinite(stamp)&&stamp>0,
  "OBSERVED_TIMESTAMP_INVALID");
 return {track:spec?track:"UNKNOWN",state:errors.length?"REJECTED":"CLAIMED_UNVERIFIED",
  issues:errors};
}
function preflight({claims=[]}={}){
 if(!Array.isArray(claims)||claims.length>30)throw Error("P206_INVALID_BATCH");
 const seen=new Set(),records=claims.map(o=>{
  const r=verifyOne(o);
  if(r.state==="CLAIMED_UNVERIFIED"){
   if(seen.has(r.track))return {...r,state:"REJECTED",issues:["DUPLICATE_TRACK"]};
   seen.add(r.track);
  }
  return r;
 });
 const status=dashboard();
 return {schema:"packtook-p206-security-execution-preflight-v1",
  mode:"OFFLINE_PLANNING_ONLY",pins,requiredTracks:TRACKS,
  records,claimed:records.filter(x=>x.state==="CLAIMED_UNVERIFIED").length,
  rejected:records.filter(x=>x.state==="REJECTED").length,
  independentVerified:0,
  executionAuthorizedByThisArtifact:false,
  productionReadAuthorized:false,sourceArchiveByteVerified:false,
  buildRevisionDigestVerified:false,appCheckRealTokenVerified:false,
  releaseGatesPassed:status.stats.releaseGatesPassed,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED",
  cloudCalls:0,cloudWrites:0,
  warning:"Claimed metadata never grants execution rights, proves live App Check, or authenticates a security reviewer."};
}
module.exports={preflight,verifyOne,TRACKS,checks,pins};
