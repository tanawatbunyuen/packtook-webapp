"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {FIELDS,template,classify}=require("./p77-operating-readiness.cjs");
test("all live operational evidence defaults NOT_VERIFIED",()=>{
 const r=classify(template());
 assert.equal(r.verifiedCount,0);assert.equal(r.outstandingCount,FIELDS.length);
 assert.equal(r.controlledPilot,"BLOCKED");assert.equal(r.productionRelease,"NO_GO_RELEASE");
});
test("even all reviewer-reported flags cannot grant a release",()=>{
 const data=template();for(const k of FIELDS)data.evidence[k]="VERIFIED";
 const r=classify(data);
 assert.equal(r.state,"EVIDENCE_COMPLETE_NOT_RELEASE_APPROVED");
 assert.equal(r.deployAllowed,false);assert.equal(r.productionRelease,"NO_GO_RELEASE");
});
test("any missing billing evidence blocks readiness",()=>{
 const data=template();for(const k of FIELDS)data.evidence[k]="VERIFIED";
 data.evidence.cloudBillingBudgetAlerts="NOT_VERIFIED";
 assert.ok(classify(data).outstanding.includes("cloudBillingBudgetAlerts"));
});
test("unknown field or fabricated evidence status rejected",()=>{
 const data=template();data.evidence.secret="value";
 assert.equal(classify(data).state,"EVIDENCE_INVALID");
 delete data.evidence.secret;
 data.evidence.omiseTestProviderReadProbe="PASS";
 assert.equal(classify(data).state,"EVIDENCE_INVALID");
});
test("project must be Staging",()=>{
 const data=template();data.project="packtook-prod-01";
 assert.equal(classify(data).state,"EVIDENCE_INVALID");
});
test("PDPA missing never silently waived",()=>{
 const data=template();data.evidence.pdpaConsentAndPrivacyReview="NOT_APPLICABLE";
 const r=classify(data);assert.ok(r.outstanding.includes("pdpaConsentAndPrivacyReview"));
});
test("backup and recovery cannot be inferred from GitHub CI success",()=>{
 const r=classify(template());assert.ok(r.outstanding.includes("backupRestoreDryRun"));
 assert.ok(r.outstanding.includes("immutableRollbackRevision"));
 assert.equal(r.stagingGuardDrift,"UNRESOLVED");
});
test("no live Omise probe proof can be inferred",()=>{
 const r=classify(template());
 assert.equal(r.omiseLiveSettlement,"NOT_PROVEN");
 assert.ok(r.outstanding.includes("omiseTestProviderReadProbe"));
});
