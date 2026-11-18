"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {audit,KEYS,TARGETS}=require("./p73-api-contract-audit.cjs");
const root=path.join(__dirname,"..");
const prod=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const candidate=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/index.js"),"utf8");
const semantics=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/p72-account-semantics.cjs"),"utf8");
const credits=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/credit-handlers.cjs"),"utf8");
const check=(p=prod,c=candidate,s=semantics,d=credits)=>audit(p,c,s,d);
test("P73 existing export-name mapping and response static schema",()=>{
 const a=check();
 assert.equal(a.staticExportNamesMatch,true);
 assert.equal(a.usageFieldNamesMatch,true);
 assert.equal(a.recordingFieldNamesPresent,true);
 assert.equal(a.stagingPolicyPreprovisionOnly,true);
 assert.equal(a.explicitAppCheckOption,true);
 assert.equal(a.creditCallbacksPresent,true);
});
test("P73 limited tests cannot certify runtime compatibility",()=>{
 const a=check();
 assert.equal(a.fullSemanticParity,"REVIEW_REQUIRED");
 assert.equal(a.clientRuntimeCompatibility,"NOT_PROVEN");
 assert.equal(a.stagingDeploy,"BLOCKED");
 assert.equal(a.productionRelease,"NO_GO_RELEASE");
 assert.ok(a.unresolved.length>=5);
});
test("P73 mutation missing response key is detected",()=>{
 const a=check(prod,candidate,semantics.replace("walletStartingCredits:","deletedWalletStartingCredits:"),credits);
 assert.equal(a.usageFieldNamesMatch,false);
});
test("P73 mutation missing callable is detected",()=>{
 const a=check(prod,candidate.replace("exports.p70FinalizeCredit=protect(","exports.p70FinalizeCredit=void("),semantics,credits);
 assert.equal(a.staticExportNamesMatch,false);
});
test("P73 missing App Check declaration is detected",()=>{
 assert.equal(check(prod,candidate.replace("enforceAppCheck:true","enforceAppCheck:false")).explicitAppCheckOption,false);
});
test("P73 required status keys include billing and subscription",()=>{
 for(const k of ["planExpiresAt","walletStartingCredits","openBillingRequestId","subscriptionStatus"])
  assert.ok(KEYS.includes(k));
 assert.equal(Object.keys(TARGETS).length,5);
});
