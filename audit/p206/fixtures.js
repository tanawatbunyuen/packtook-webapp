"use strict";
const assert=require("node:assert/strict");
const {preflight,verifyOne,TRACKS,checks,pins}=require("./preflight");
let n=0;const t=(id,fn)=>{fn();n++;console.log("P206_"+id+"=PASS")};
const claim=(track="STAGING_APPCHECK_NEGATIVE")=>({
 track,project:checks[track].project,function:pins.function,region:pins.region,
 revision:pins.revision,build:pins.build,sourceGeneration:pins.sourceGeneration,
 candidate:pins.candidate,ticket:"G02-READONLY-20261125",
 operatorRole:checks[track].role,approvalScope:checks[track].scope,
 readOnly:true,evidenceDigest:"a".repeat(64),observedAt:"2026-11-25T00:00:00Z",
 result:checks[track].result
});
t("EMPTY_FAILS_CLOSED",()=>{const x=preflight();assert.equal(x.independentVerified,0);assert.equal(x.g02Decision,"NO_GO")});
t("NINE_TRACKS_PRESENT",()=>assert.equal(TRACKS.length,9));
t("POSITIVE_AND_NEGATIVE_APPCHECK_SEPARATE",()=>assert(TRACKS.includes("STAGING_APPCHECK_NEGATIVE")&&TRACKS.includes("STAGING_APPCHECK_POSITIVE")));
t("VALID_METADATA_ONLY_CLAIMED",()=>assert.equal(verifyOne(claim()).state,"CLAIMED_UNVERIFIED"));
t("ALL_NINE_CLAIMS_STILL_UNVERIFIED",()=>{const x=preflight({claims:TRACKS.map(claim)});assert.equal(x.claimed,9);assert.equal(x.independentVerified,0)});
t("FORGED_APPROVAL_CANNOT_UNLOCK",()=>{const x=preflight({claims:[claim()]});assert.equal(x.releaseDecision,"NO_GO_RELEASE")});
t("PRODUCTION_READ_NOT_AUTHORIZED",()=>assert.equal(preflight({claims:[claim("PROD_AUTH_FIRESTORE_INVENTORY")]}).productionReadAuthorized,false));
t("WRONG_PRODUCTION_PROJECT_REJECTED",()=>{const x=claim("PROD_AUTH_FIRESTORE_INVENTORY");x.project=pins.project;assert(verifyOne(x).issues.includes("WRONG_PROJECT"))});
t("PRODUCTION_ROLE_NOT_STAGING_ROLE",()=>{const x=claim("PROD_AUTH_FIRESTORE_INVENTORY");x.operatorRole="Staging Cloud Operator";assert(verifyOne(x).issues.includes("ROLE_CLAIM_DRIFT"))});
t("PRODUCTION_SCOPE_SEPARATE",()=>{const x=claim("PROD_AUTH_FIRESTORE_INVENTORY");x.approvalScope="STAGING_READ";assert(verifyOne(x).issues.includes("SCOPE_NOT_PINNED"))});
t("WRONG_REVISION_DENIED",()=>{const x=claim();x.revision="other";assert(verifyOne(x).issues.includes("DRIFT_REVISION"))});
t("WRONG_BUILD_DENIED",()=>{const x=claim();x.build="other";assert(verifyOne(x).issues.includes("DRIFT_BUILD"))});
t("WRONG_SOURCE_GENERATION_DENIED",()=>{const x=claim();x.sourceGeneration="gs://other";assert(verifyOne(x).issues.includes("DRIFT_SOURCEGENERATION"))});
t("WRONG_CANDIDATE_DENIED",()=>{const x=claim();x.candidate="f".repeat(64);assert(verifyOne(x).issues.includes("DRIFT_CANDIDATE"))});
t("WRONG_REGION_DENIED",()=>{const x=claim();x.region="us-central1";assert(verifyOne(x).issues.includes("DRIFT_REGION"))});
t("WRONG_FUNCTION_DENIED",()=>{const x=claim();x.function="recordingStatus";assert(verifyOne(x).issues.includes("DRIFT_FUNCTION"))});
t("POSITIVE_RESULT_NOT_NEGATIVE",()=>{const x=claim();x.result="VALID_TOKEN_ACCEPTED";assert(verifyOne(x).issues.includes("UNEXPECTED_RESULT"))});
t("NO_TOKEN_ON_REPORT",()=>{const x=claim();x.token="TOP_SECRET";assert.equal(verifyOne(x).state,"REJECTED")});
t("NO_USER_EMAIL_ON_REPORT",()=>{const x=claim();x.email="secret@example.invalid";assert(!JSON.stringify(verifyOne(x)).includes("secret@example.invalid"))});
t("READ_ONLY_TRUE_REQUIRED",()=>{const x=claim();x.readOnly=false;assert(verifyOne(x).issues.includes("READ_ONLY_REQUIRED"))});
t("SYNTHETIC_FIXTURE_REJECTED",()=>{const x=claim();x.syntheticFixture=true;assert(verifyOne(x).issues.includes("SYNTHETIC_MUST_NOT_BE_SUBMITTED"))});
t("MALFORMED_TICKET_REJECTED",()=>{const x=claim();x.ticket="bad";assert(verifyOne(x).issues.includes("TICKET_FORMAT_INVALID"))});
t("INVALID_DIGEST_REJECTED",()=>{const x=claim();x.evidenceDigest="bad";assert(verifyOne(x).issues.includes("EVIDENCE_DIGEST_INVALID"))});
t("MISSING_TIMESTAMP_REJECTED",()=>{const x=claim();delete x.observedAt;assert(verifyOne(x).issues.includes("OBSERVED_TIMESTAMP_INVALID"))});
t("DUPLICATE_TRACK_REJECTED",()=>{const x=preflight({claims:[claim(),claim()]});assert.equal(x.claimed,1);assert.equal(x.rejected,1)});
t("NON_ARRAY_DENIED",()=>assert.throws(()=>preflight({claims:{}}),/P206_INVALID_BATCH/));
t("OVERSIZED_DENIED",()=>assert.throws(()=>preflight({claims:Array(31).fill(claim())}),/P206_INVALID_BATCH/));
t("SOURCE_BYTE_EQUALITY_NOT_INFERRED",()=>assert.equal(preflight({claims:[claim("SOURCE_ARCHIVE_PROVENANCE")]}).sourceArchiveByteVerified,false));
t("BUILD_IMAGE_MATCH_NOT_INFERRED",()=>assert.equal(preflight({claims:[claim("BUILD_OUTPUT_DIGEST")]}).buildRevisionDigestVerified,false));
t("VALID_TOKEN_NOT_AUTOMATICALLY_VERIFIED",()=>assert.equal(preflight({claims:[claim("STAGING_APPCHECK_POSITIVE")]}).appCheckRealTokenVerified,false));
t("GATES_STAY_0_OF_8",()=>assert.equal(preflight().releaseGatesPassed,0));
t("PUBLIC_SIGNUP_CLOSED",()=>assert.equal(preflight().publicSignup,"KEEP_CLOSED"));
t("NO_CLOUD_SIDE_EFFECTS",()=>{const x=preflight();assert.equal(x.cloudCalls,0);assert.equal(x.cloudWrites,0)});
console.log("P206_OFFLINE_SECURITY_EXECUTION_PREFLIGHT_FIXTURES="+n+"/"+n+"_PASS");
console.log("P206_REAL_STAGING_EXECUTION=NOT_PERFORMED");
console.log("P206_EXTERNAL_INDEPENDENT_VERIFICATION=0/5");
console.log("P206_G02=NO_GO_RELEASE");
