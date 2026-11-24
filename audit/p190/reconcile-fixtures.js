"use strict";
const assert=require("node:assert/strict");
const {reconcile,REQUIREMENTS,EXPECTED_CANDIDATE}=require("./reconcile");
let n=0;
function test(name,fn){fn();n++;console.log("P190_"+name+"=PASS");}
const today="2026-11-24T13:00:00.000Z",asOf="2026-11-24T16:00:00.000Z";
const mk=key=>({
 requirement:key,project:REQUIREMENTS[key].project,kind:REQUIREMENTS[key].kind,
 candidateSha256:EXPECTED_CANDIDATE,artifactSha256:"a".repeat(64),
 ticket:"G02-APPROVED-TICKET-2026",capturedAt:today,
 operatorRole:"SecurityReviewer",summaryStatus:"PASS",
 ...(["STAGING_LEGACY_INVENTORY","PROD_LEGACY_INVENTORY"].includes(key)?{
  complete:true,recordCount:9,authLookupErrors:0}:{}),
 ...(key==="OWNER_PROVENANCE_REMEDIATION"?{ownerConflictsResolved:true}:{}),
 ...(key==="EXACT_RELEASE_DIFF_SECURITY_SIGNOFF"?{reviewDecision:"APPROVED_FOR_STAGING_REVIEW"}:{})
});
const claims=()=>Object.fromEntries(Object.keys(REQUIREMENTS).map(key=>[key,mk(key)]));
test("EMPTY_CLAIMS_NO_GO",()=>{
 const r=reconcile({asOf});assert.equal(r.externalEvidence.missing,5);assert.equal(r.g02Decision,"NO_GO");
});
test("COMPLETE_SELF_CLAIMS_NEVER_GO",()=>{
 const r=reconcile({claims:claims(),asOf});
 assert.equal(r.externalEvidence.claimedUnverified,5);
 assert.equal(r.externalEvidence.independentlyVerified,0);
 assert.equal(r.readyForHumanIndependentReview,true);
 assert.equal(r.g02Decision,"NO_GO");
});
test("CROSS_PROJECT_BLOCKED",()=>{
 const c=claims();c.PROD_LEGACY_INVENTORY.project="packtook-staging";
 const r=reconcile({claims:c,asOf});assert.equal(r.externalEvidence.rejected,1);
 assert(r.externalEvidence.records.find(x=>x.id==="PROD_LEGACY_INVENTORY").issues.includes("WRONG_PROJECT"));
});
test("SOURCE_HASH_MISMATCH_BLOCKED",()=>{
 const c=claims();c.STAGING_VALID_APPCHECK.candidateSha256="b".repeat(64);
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("TRUNCATED_SCAN_REJECTED",()=>{
 const c=claims();c.PROD_LEGACY_INVENTORY.complete=false;
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("AUTH_LOOKUP_ERRORS_REJECTED",()=>{
 const c=claims();c.STAGING_LEGACY_INVENTORY.authLookupErrors=2;
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("UNRESOLVED_OWNER_CONFLICT_REJECTED",()=>{
 const c=claims();c.OWNER_PROVENANCE_REMEDIATION.ownerConflictsResolved=false;
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("INVALID_SIGNATURE_CANNOT_BE_SELF_CERTIFIED",()=>{
 const c=claims();c.EXACT_RELEASE_DIFF_SECURITY_SIGNOFF.reviewDecision="PENDING";
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("FUTURE_TIMESTAMP_DENIED",()=>{
 const c=claims();c.STAGING_VALID_APPCHECK.capturedAt="2026-11-25T00:00:00Z";
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("STALE_TIMESTAMP_DENIED",()=>{
 const c=claims();c.STAGING_VALID_APPCHECK.capturedAt="2025-11-24T00:00:00Z";
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("MISSING_EVIDENCE_DIGEST_DENIED",()=>{
 const c=claims();delete c.PROD_LEGACY_INVENTORY.artifactSha256;
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("UNEXPECTED_PII_FIELD_DENIED",()=>{
 const c=claims();c.PROD_LEGACY_INVENTORY.email="secret@example.invalid";
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("UNEXPECTED_EVIDENCE_CLASS_DENIED",()=>{
 const c=claims();c.STAGING_VALID_APPCHECK.kind="OFFLINE_MOCK";
 assert.equal(reconcile({claims:c,asOf}).externalEvidence.rejected,1);
});
test("UNKNOWN_TRACK_DENIED",()=>{
 const c=claims();c.EXTRA={};
 assert.throws(()=>reconcile({claims:c,asOf}),/P190_UNEXPECTED/);
});
test("NO_PRODUCTION_SIGNOFF_IN_OUTPUT",()=>{
 const r=reconcile({claims:claims(),asOf});
 assert.equal(r.productionRuntimeAttested,false);
 assert.equal(r.securityReviewerIndependentlyVerified,false);
 assert.equal(r.releaseDecision,"NO_GO_RELEASE");
 assert.equal(r.deployDecision,"NO_GO_DEPLOY");
 assert.equal(r.publicSignup,"KEEP_CLOSED");
 const raw=JSON.stringify(r);
 assert(!raw.includes("secret@example.invalid"));
});
console.log("P190_RECONCILIATION_NEGATIVE_FIXTURES="+n+"/"+n+"_PASS");
console.log("P190_PRODUCTION_CLOUD_READS=0 PRODUCTION_WRITES=0 DEPLOYS=0");
