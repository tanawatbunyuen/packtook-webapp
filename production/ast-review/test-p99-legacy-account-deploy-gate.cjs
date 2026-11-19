"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),
  fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {analyze}=require("./p99-legacy-account-deploy-gate.cjs");
const ROOT=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(ROOT,"functions/index.js"),"utf8");
const firebase=JSON.parse(fs.readFileSync(path.join(ROOT,"firebase.json"),"utf8"));
const candidate=fs.readFileSync(path.join(ROOT,"staging-candidates/p98/guarded-status-integration-candidate.cjs"),"utf8");
const legacy=fs.readFileSync(path.join(ROOT,"staging-candidates/p81/legacy-status-live-gate-candidate.cjs"),"utf8");
const delegate=fs.readFileSync(path.join(ROOT,"staging-candidates/p75/legacy-status-guard-candidate.cjs"),"utf8");
const input=()=>({source,firebase,candidate,legacy,delegate});
test("P99 exact current source has blocked deploy and known semantic difference",()=>{
 const a=analyze();
 assert.deepEqual(a.findings,[]);
 assert.equal(a.fullAccountCompatibility,"NOT_EQUIVALENT");
 assert.equal(a.safeDeployIsolation,"NOT_VERIFIED");
 assert.equal(a.release,"NO_GO_RELEASE");
 assert.deepEqual(a.excludedCreditFunctions,["reserveCredit","finalizeCredit","recoverStaleVideoReservation"]);
});
test("P99 even nominal Firebase status-only selector is not proven safe",()=>{
 const a=analyze();
 assert.equal(a.codebase,"beta");
 assert.equal(a.firebaseCliSelector,"NOT_TESTED");
 assert.equal(a.deployedOwnerMapping,"NOT_VERIFIED");
});
for(const [name,mutate,expected] of [
 ["removing original legacy beta check",x=>x.source=x.source.replace("live.customClaims?.packtookProductionBeta!==true","false"),"P99_WRONG_LEGACY_PROVISIONING_PATTERN"],
 ["misconfiguring codebase",x=>x.firebase={...x.firebase,functions:[{source:"functions",codebase:"wrong"}]},"P99_BETA_CODEBASE_UNVERIFIED"],
 ["removing credit function",x=>x.source=x.source.replace("exports.finalizeCredit=","exports.otherFinalizeCredit="),"P99_ORIGINAL_FUNCTION_MISSING_finalizeCredit"],
 ["registering new candidate",x=>x.source+="\ncreateP98GuardedStatusHandlers({});","P99_CANDIDATE_NOT_ISOLATED"],
 ["tampering candidate source",x=>x.candidate=x.candidate.replaceAll("projectUsageStatus","wrongStatusOutput"),"P99_CANDIDATE_READONLY_MISSING"],
 ["removing original ensureAccount call",x=>x.source=x.source.replace("const id=uid(req),ref=await ensureAccount(id),snap=await ref.get()","const id=uid(req),ref=own(id),snap=await ref.get()"),"P99_USAGE_CALLS_ENSURE_ACCOUNT"]
]){
 test("P99 fail close: "+name,()=>{
  const x=input();mutate(x);
  const r=analyze(x);
  assert.equal(r.sourceAuditPass,false);
  assert.ok(r.findings.includes(expected),JSON.stringify(r.findings));
  assert.equal(r.deploy,false);
 });
}
const first=source.indexOf("async function ensureAccount(id){");
const last=source.indexOf("\n}\n",first);
assert.ok(first>=0&&last>first);
const originalEnsure=source.slice(first,last+2);
function mockHarness({exists=false,beta=false,disabled=false,creationError=null,idMismatch=false}={}){
 const calls=[],ref={
   id:idMismatch?"mappedDifferent":"p99_demo_uid",
   get:async()=>{calls.push("get");return {exists}},
   create:async data=>{calls.push("create");if(creationError)throw creationError;return data}
 };
 class HttpsError extends Error{constructor(code,msg){super(msg);this.code=code}}
 const sandbox={ownerRef:async()=>ref,admin:{auth:()=>({getUser:async()=>{calls.push("liveAuth");return {disabled,customClaims:{packtookProductionBeta:beta}}}})},
  HttpsError,FieldValue:{serverTimestamp:()=>"TEST_TIMESTAMP"},
  periodId:()=> "2026-11",Date};
 vm.runInNewContext(originalEnsure+"\nthis.referenceEnsureAccount=ensureAccount;",sandbox);
 return {fn:sandbox.referenceEnsureAccount,ref,calls};
}
test("P99 original existing account does not create/lookup live Auth",async()=>{
 const x=mockHarness({exists:true});
 assert.equal(await x.fn("p99_demo_uid"),x.ref);
 assert.deepEqual(x.calls,["get"]);
});
test("P99 original legacy production-beta account can auto-create Free credits",async()=>{
 const x=mockHarness({exists:false,beta:true});
 assert.equal(await x.fn("p99_demo_uid"),x.ref);
 assert.deepEqual(x.calls,["get","liveAuth","create"]);
});
test("P99 original new regular account denies without creating credits",async()=>{
 const x=mockHarness({exists:false,beta:false});
 await assert.rejects(x.fn("p99_demo_uid"),e=>e.code==="failed-precondition");
 assert.deepEqual(x.calls,["get","liveAuth"]);
});
test("P99 original disabled beta user denies without creating credits",async()=>{
 const x=mockHarness({exists:false,beta:true,disabled:true});
 await assert.rejects(x.fn("p99_demo_uid"),e=>e.code==="failed-precondition");
 assert.deepEqual(x.calls,["get","liveAuth"]);
});
test("P99 original concurrent exists error is treated idempotently",async()=>{
 const x=mockHarness({exists:false,beta:true,creationError:{code:6}});
 assert.equal(await x.fn("p99_demo_uid"),x.ref);
 assert.deepEqual(x.calls,["get","liveAuth","create"]);
});
test("P99 original unexpected Firestore failure bubbles; no fake success",async()=>{
 const x=mockHarness({exists:false,beta:true,creationError:{code:7}});
 await assert.rejects(x.fn("p99_demo_uid"),e=>e.code===7);
});
test("P99 original mapped alternate id does not auto-provision",async()=>{
 const x=mockHarness({idMismatch:true});
 assert.equal(await x.fn("p99_demo_uid"),x.ref);
 assert.deepEqual(x.calls,[]);
});
