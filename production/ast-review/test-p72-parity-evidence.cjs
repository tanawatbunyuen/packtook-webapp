"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),{evaluate}=require("./p72-parity-evidence.cjs");
const root=path.join(__dirname,"..");
const p=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const c=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/credit-handlers.cjs"),"utf8");
const s=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/index.js"),"utf8");
const m=fs.readFileSync(path.join(root,"staging-candidates/p69/functions/p72-account-semantics.cjs"),"utf8");
test("P72 scoped fixes present but full equivalence never fabricated",()=>{
 const r=evaluate(p,c,s,m);
 assert.equal(r.scopedStaticParity,"MATCH_CANDIDATE");
 assert.equal(r.semanticParity,"REVIEW_REQUIRED");
 assert.equal(r.parityChecks.autoProvisioningPolicy,"INTENTIONALLY_DIFFERENT_PREPROVISION_ONLY");
 assert.equal(r.deployment,"BLOCKED");assert.equal(r.release,"NO_GO_RELEASE");
});
test("removed schema integration reopens scoped parity",()=>{
 const r=evaluate(p,c,s.replace("usageResponse(snap.data())","{}"),m);
 assert.equal(r.scopedStaticParity,"REVIEW_REQUIRED");
});
test("removed subscription classifier reopens scoped parity",()=>{
 const r=evaluate(p,c.replace("planState(a,clock())","true"),s,m);
 assert.equal(r.scopedStaticParity,"REVIEW_REQUIRED");
});
