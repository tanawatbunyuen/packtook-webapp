"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {template:secTemplate,KEYS}=require("./p74-security-evidence.cjs");
const {template:opsTemplate,FIELDS}=require("./p77-operating-readiness.cjs");
const {assess}=require("./p78-consolidated-preflight.cjs");
const manifest={id:"P70",environment:"packtook-staging",deployAllowed:false,
 stagingDeploymentPerformed:false,productionRelease:"NO_GO_RELEASE"};
const check=(s=secTemplate(),o=opsTemplate(),m=manifest)=>assess({
 securityEvidence:s,operationsEvidence:o,manifest:m});
test("P78 baseline accurately reports 17 security and 18 operations gaps",()=>{
 const x=check();
 assert.equal(x.securityVerified,0);
 assert.equal(x.operationsVerified,0);
 assert.equal(x.blockerCategories.security,17);
 assert.equal(x.blockerCategories.operations,18);
 assert.equal(x.decision,"NO_GO_CONTROLLED_PILOT");
});
test("P78 all reported flags never bypass runtime guard drift and release gates",()=>{
 const s=secTemplate(),o=opsTemplate();
 for(const k of KEYS)s.observations[k]="VERIFIED";
 for(const k of FIELDS)o.evidence[k]="VERIFIED";
 const x=check(s,o);
 assert.equal(x.securityVerified,17);assert.equal(x.operationsVerified,18);
 assert.equal(x.blockerCategories.sourceDrift,"UNRESOLVED");
 assert.equal(x.productionRelease,"NO_GO_RELEASE");
 assert.equal(x.stagingDeploy,"BLOCKED");
});
test("P78 invalid manifest adds blocking condition",()=>{
 const x=check(secTemplate(),opsTemplate(),{...manifest,deployAllowed:true});
 assert.ok(x.openBlockerCount>39);
 assert.equal(x.decision,"NO_GO_CONTROLLED_PILOT");
});
test("P78 invalid and missing evidence cannot be interpreted as zero blockers",()=>{
 const x=check({},null,manifest);
 assert.equal(x.productionRelease,"NO_GO_RELEASE");
 assert.ok(x.openBlockerCount>0);
});
test("P78 invalid provider or PDPA statuses cannot turn green",()=>{
 const o=opsTemplate();o.evidence.omiseTestProviderReadProbe="PASS";
 assert.equal(check(secTemplate(),o).decision,"NO_GO_CONTROLLED_PILOT");
});
test("P78 public signup is not claimed verified closed by offline source",()=>{
 assert.equal(check().publicSignup,"CLOSED_ASSUMED_NOT_LIVE_ATTESTED");
});
