"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {template,classify}=require("./p88-current-source-evidence-gate.cjs");
test("P88 starts with zero real archive readings",()=>{
 const r=classify(template());assert.equal(r.checkedCount,0);
 assert.equal(r.state,"INSPECTION_INCOMPLETE");assert.equal(r.deployment,"BLOCKED");
});
test("P88 two readable current archives do not prove rollback",()=>{
 const v=template();for(const n of Object.keys(v.functions))v.functions[n]="CURRENT_PINNED_ARCHIVE_READABLE_ONLY";
 const r=classify(v);assert.equal(r.state,"CURRENT_ARCHIVES_READABLE_UNATTESTED");
 assert.equal(r.previousVersionRestorable,"NOT_VERIFIED");
 assert.equal(r.statusGuards,"P80_CONFIRMED_DRIFT_UNREMEDIATED");
 assert.equal(r.release,"NO_GO_RELEASE");
});
test("P88 one current archive never passes both target evidence",()=>{
 const v=template();v.functions.recordingStatus="CURRENT_PINNED_ARCHIVE_READABLE_ONLY";
 assert.equal(classify(v).checkedCount,1);
});
test("P88 wrong project fails",()=>{
 const v=template();v.project="packtook-prod-01";assert.equal(classify(v).state,"INVALID");
});
test("P88 credit function scope expansion fails",()=>{
 const v=template();v.functions.reserveCredit="CURRENT_PINNED_ARCHIVE_READABLE_ONLY";
 assert.equal(classify(v).state,"INVALID");
});
test("P88 cannot promote P80 guard drift to fixed",()=>{
 const v=template();v.backendAppCheck="VERIFIED";assert.equal(classify(v).state,"INVALID");
});
test("P88 cannot assert untested prior rollback",()=>{
 const v=template();v.knownGoodPriorRevision="VERIFIED";assert.equal(classify(v).state,"INVALID");
});
test("P88 cannot claim deploy performed",()=>{
 const v=template();v.deployPerformed=true;assert.equal(classify(v).state,"INVALID");
});
test("P88 source-to-commit hash remains unproven",()=>{
 const v=template();v.sourceToCommitParity="MATCH";assert.equal(classify(v).state,"INVALID");
});
test("P88 unknown state is rejected",()=>{
 const v=template();v.functions.recordingStatus="PASS";assert.equal(classify(v).state,"INVALID");
});
