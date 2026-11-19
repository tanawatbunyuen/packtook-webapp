"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {audit,extract}=require("./p96-status-contract-audit.cjs");
const root=path.resolve(__dirname,"..");
const original=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const candidateSource=fs.readFileSync(path.join(root,"staging-candidates/p81/legacy-status-live-gate-candidate.cjs"),"utf8");
const delegateSource=fs.readFileSync(path.join(root,"staging-candidates/p75/legacy-status-guard-candidate.cjs"),"utf8");
const config=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
function input(){return {original,candidateSource,delegateSource,config};}
test("P96 actual repository has two original status handlers, no live candidate registration",()=>{
 const x=audit();assert.equal(x.offlineSourceVerified,true,JSON.stringify(x.findings));
 assert.deepEqual(x.statusTargets,["recordingStatus","usageStatus"]);
 assert.equal(x.candidateStatus,"UNREGISTERED_REVIEW_ONLY");
 assert.equal(x.stagingDeploy,"BLOCKED");
 assert.equal(x.productionRelease,"NO_GO_RELEASE");
});
test("P96 original usage contract relies on credit, wallet, subscription computations",()=>{
 const s=extract(original,"usageStatus");
 for(const name of ["creditAvailable(a)","pendingReservations(a)","subscriptionState(a)","walletStartingCredits"]){
  assert.ok(s.includes(name),name);
 }
 assert.equal(audit().evidence.usageResponseParity,"NOT_VERIFIED");
});
test("P96 candidate uses injected usageResponse and not the original helper",()=>{
 assert.ok(delegateSource.includes("usageResponse(snap.data())"));
 assert.equal(audit().evidence.deployedToGitParity,"NOT_VERIFIED");
});
test("P96 recordingStatus original ownerRef vs candidate direct account ref",()=>{
 assert.ok(extract(original,"recordingStatus").includes("ownerRef(id)"));
 assert.ok(delegateSource.includes('db.collection("accounts").doc(uid)'));
 assert.equal(audit().evidence.recordingAccountPathParity,"NOT_VERIFIED");
});
test("P96 credit original handler fingerprints exist but cannot certify deployed parity",()=>{
 const x=audit();
 assert.deepEqual(Object.keys(x.creditUnchangedFingerprints).sort(),[
  "reserveCredit","finalizeCredit","recoverStaleVideoReservation"].sort());
 assert.ok(Object.values(x.creditUnchangedFingerprints).every(x=>/^[0-9a-f]{64}$/.test(x)));
 assert.equal(x.evidence.selectorTargeting,"NOT_VERIFIED");
});
for(const [name,change,expected] of [
 ["missing usage wallet calculation",x=>{x.original=x.original.replace(extract(x.original,"usageStatus"),extract(x.original,"usageStatus").replace("walletStartingCredits:","walletStartingCreditChanged:"));},"CURRENT_USAGE_CONTRACT_UNKNOWN"],
 ["missing candidate injection",x=>{x.candidateSource=x.candidateSource.replaceAll("usageResponse","usageOutput");},"CANDIDATE_USAGE_RESPONSE_DEPENDENCY_MISSING"],
 ["missing client-status safeguard",x=>{x.candidateSource=x.candidateSource.replace("enforceAppCheck:true","enforceAppCheck:false");},"CANDIDATE_EXPORTS_NOT_RESTRICTED"],
 ["registered candidate into live exports",x=>{x.original+='\ncreateP81LegacyHandlers(db);';},"P81_NOT_ISOLATED"],
 ["changed recording owner reference",x=>{x.original=x.original.replace("ownerRef(id)).collection(\"recordings\")","own(id)).collection(\"recordings\")");},"RECORDING_ACCOUNT_PATH_DIFFERENCE_NOT_DETECTED"],
 ["codebase beta missing",x=>{x.config={...x.config,functions:[{source:"functions",codebase:"other"}]};},"BETA_CODEBASE_UNMAPPED"],
 ["missing credit export",x=>{x.original=x.original.replace("exports.reserveCredit=","exports.changedReserveCredit=");},"P96_DUPLICATE_OR_MISSING_EXPORT_reserveCredit"]
]){
 test("P96 fail-close if "+name,()=>{
  const x=input();change(x);
  if(name==="missing credit export"){
    assert.throws(()=>audit(x),/P96_DUPLICATE_OR_MISSING_EXPORT_reserveCredit/);
    return;
  }
  const r=audit(x);
  assert.equal(r.offlineSourceVerified,false,name);
  assert.ok(r.findings.includes(expected),JSON.stringify(r.findings));
  assert.equal(r.stagingDeploy,"BLOCKED");
 });
}
test("P96 extraction fails on absent export",()=>{
 assert.throws(()=>extract(original,"doesNotExist"),/DUPLICATE_OR_MISSING_EXPORT/);
});
