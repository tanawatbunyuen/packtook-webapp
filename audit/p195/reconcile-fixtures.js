"use strict";
const assert=require("node:assert/strict");
const {reconcile,TARGET,ENDPOINT,EXPECTED_CANDIDATE}=require("./reconcile");
const now="2026-11-24T16:00:00Z",ts="2026-11-24T15:00:00Z";
const common={observedAt:ts,ticket:"G02-STAGING-READ-20261124",artifactSha256:"a".repeat(64)};
const good=()=>({
 runtime:{...common,project:"packtook-staging",functionResource:TARGET,region:"asia-southeast1",
 endpoint:ENDPOINT,revision:"usagestatus-00017-abc",state:"ACTIVE",runtime:"nodejs22",
 candidateSha256:EXPECTED_CANDIDATE},
 inventory:{...common,project:"packtook-staging",scope:"FIRESTORE_AUTH_READ_ONLY",
 complete:true,scanned:124,authLookupErrors:0,ownerConflicts:0},
 appCheck:{...common,project:"packtook-staging",functionResource:TARGET,
 revision:"usagestatus-00017-abc",missingTokenHttp:401,validTokenHttp:200},
 securityReview:{...common,candidateSha256:EXPECTED_CANDIDATE,
 reviewerRole:"IndependentSecurityReviewer",reviewerDecision:"APPROVED_FOR_STAGING_REVIEW",
 independentVerificationRef:"G02-REVIEW-ABCDEF123456"}
});
let n=0;function test(label,fn){fn();n++;console.log("P195_"+label+"=PASS");}
const status=(o,key)=>reconcile({observations:o,now}).evidence.find(x=>x.type===key);
function bad(label,key,mutate,issue){
 test(label,()=>{const o=good();mutate(o[key]);const r=status(o,key);
 assert.equal(r.status,"REJECTED");assert(r.issues.includes(issue));});
}
test("EMPTY_OPERATOR_EVIDENCE_FAILS_CLOSED",()=>{const r=reconcile({now});
 assert.equal(r.submitted,0);assert.equal(r.metadataAccepted,0);
 assert.equal(r.g02Decision,"NO_GO");});
test("ALL_SYNTACTICALLY_VALID_CLAIMS_STILL_NO_GO",()=>{
 const r=reconcile({observations:good(),now});
 assert.equal(r.metadataAccepted,4);assert.equal(r.independentlyVerified,0);
 assert.equal(r.candidateDeployedOrStagingAttested,false);
 assert.equal(r.g02Decision,"NO_GO");assert.equal(r.releaseDecision,"NO_GO_RELEASE");
});
bad("CROSS_PROJECT_RUNTIME_DENIED","runtime",x=>x.project="packtook-prod-01","WRONG_PROJECT");
bad("UNPINNED_RUNTIME_ENDPOINT_DENIED","runtime",x=>x.endpoint="https://attacker.run.app/usageStatus","ENDPOINT_NOT_PINNED");
bad("FUNCTION_REVISION_MALFORMED","runtime",x=>x.revision="../escape","REVISION_INVALID");
bad("INCORRECT_CANDIDATE_HASH_DENIED","runtime",x=>x.candidateSha256="b".repeat(64),"RELEASE_CANDIDATE_HASH_MISMATCH");
bad("UNRELEASED_RUNTIME_DENIED","runtime",x=>x.state="DEPLOYING","RUNTIME_NOT_ACTIVE");
bad("PII_FIELD_DENIED","inventory",x=>x.email="private@example.invalid","UNEXPECTED_FIELDS_OR_PII");
bad("TRUNCATED_INVENTORY_DENIED","inventory",x=>x.complete=false,"TRUNCATED_SCAN");
bad("AUTH_LOOKUP_ERRORS_DENIED","inventory",x=>x.authLookupErrors=1,"AUTH_LOOKUP_ERRORS");
bad("OWNER_CONFLICTS_DENIED","inventory",x=>x.ownerConflicts=2,"OWNER_CONFLICTS_REQUIRE_REVIEW");
bad("MISSING_APPCHECK_ALLOWED_DENIED","appCheck",x=>x.missingTokenHttp=200,"MISSING_APPCHECK_NOT_DENIED");
bad("VALID_APPCHECK_FAILED_DENIED","appCheck",x=>x.validTokenHttp=403,"POSITIVE_APPCHECK_NOT_ACCEPTED");
bad("APPCHECK_REVISION_DIFFERENTIAL_DENIED","appCheck",x=>x.revision="usagestatus-00009-zzz","REVISION_MISMATCH");
bad("SIGNOFF_WITHOUT_INDEPENDENT_ROLE_DENIED","securityReview",x=>x.reviewerRole="CloudOperator","REVIEWER_ROLE_NOT_INDEPENDENT");
bad("SIGNOFF_WITHOUT_VERIFIABLE_REFERENCE_DENIED","securityReview",x=>x.independentVerificationRef="unverified","REVIEW_PROOF_REFERENCE_MISSING");
bad("STALE_CAPTURE_DENIED","runtime",x=>x.observedAt="2026-10-01T00:00:00Z","TIMESTAMP_INVALID_OR_STALE");
bad("FUTURE_CAPTURE_DENIED","runtime",x=>x.observedAt="2026-11-25T00:00:00Z","TIMESTAMP_INVALID_OR_STALE");
bad("UNSUPPORTED_RUNTIME_DENIED","runtime",x=>x.runtime="python312","UNEXPECTED_NODE_RUNTIME");
test("UNKNOWN_OBSERVATION_BLOCKED",()=>assert.throws(()=>reconcile({observations:{...good(),productionSecrets:{}},now}),/P195_UNKNOWN/));
test("RECONCILER_NEVER_EMITS_CREDENTIALS_OR_UID",()=>{
 const raw=JSON.stringify(reconcile({observations:good(),now}));
 assert(!raw.includes("private@example.invalid"));assert(!raw.includes("usagestatus-00017-abc"));
 assert(!raw.includes("G02-STAGING-READ-20261124"));
});
test("P190_EXTERNAL_PRODUCTION_INVENTORY_STILL_REQUIRED",()=>{
 const r=reconcile({observations:good(),now});
 assert.equal(r.externalP190ProductionInventoryStillMissing,true);
 assert.equal(r.deployment,"NO_GO_DEPLOY");
 assert.equal(r.signup,"KEEP_CLOSED");
});
console.log("P195_OFFLINE_STAGING_EVIDENCE_FIXTURES="+n+"/"+n+"_PASS");
console.log("P195_NO_STAGING_CLOUD_CALLS=TRUE");
console.log("P195_INDEPENDENT_SECURITY_ATTESTATION=NOT_PERFORMED");
