"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {compare}=require("./v7-ast-compare.cjs");

const names=["reserveCredit","finalizeCredit","recordingStatus",
  "recoverStaleVideoReservation","usageStatus"];
function src(override={},extra="") {
  const parts=['"use strict";','const options={region:"asia-southeast1"};',
    'function uid(req){return req.auth.uid;}',
    'function validOp(x){return !!x;}'];
  for(const n of names){
    const body=override[n]??"const x=uid(req);return {status:x};";
    parts.push("exports."+n+"=onCall(options, async req=>{"+body+"});");
  }
  parts.push(extra);
  return parts.join("\n");
}
test("matching AST tokens: all selected functions exact",()=>{
  const a=src(),r=compare(a,a,"recordingStatus");
  assert.equal(r.handler,"EXACT_AST_TOKENS");
  assert.equal(r.counts.SELECTED_HANDLER.MODIFIED,0);
});
test("formatting and comments do not count as AST token changes",()=>{
  const a=src(),b=a.replace('function uid(req){return req.auth.uid;}',
    'function uid(req) { /* explanation */ return req.auth.uid; }');
  assert.equal(compare(a,b,"recordingStatus").counts.CRITICAL_HELPER.MODIFIED,0);
});
test("string literal whitespace is meaningful",()=>{
  const a=src(),b=src({recordingStatus:'const x="ab";return {status:x};'});
  assert.equal(compare(a,b,"recordingStatus").handler,"DRIFT_AST_TOKENS");
});
test("other export changes not misattributed to selected handlers",()=>{
  const a=src({},'exports.another=onCall(options,async req=>1);');
  const b=src({},'exports.another=onCall(options,async req=>2);');
  const r=compare(a,b,"reserveCredit");
  assert.equal(r.handler,"EXACT_AST_TOKENS");
  assert.equal(r.counts.OTHER_EXPORTED_FUNCTION.MODIFIED,1);
});
test("inserting a new declaration is review-only",()=>{
  const a=src({},'function extra(){return 1;}');
  const r=compare(a,src(),"reserveCredit");
  assert.equal(r.counts.OTHER_TOP_LEVEL_FUNCTION.REVIEW_ONLY,1);
});
test("unknown syntax structures fail closed as unattributed",()=>{
  const a=src({},'doSomething();');
  const b=src({},'doSomethingElse();');
  const r=compare(a,b,"reserveCredit");
  assert.equal(r.counts.UNATTRIBUTED_STATEMENT.MODIFIED,1);
});
test("syntax parse error fails without exposing source",()=>{
  assert.throws(()=>compare(src(),"function (", "usageStatus"),/PARSE_NOT_VERIFIABLE/);
});
test("duplicate declaration must fail closed",()=>{
  assert.throws(()=>compare(src({},'function uid(req){}'),src(),"reserveCredit"),/DUPLICATE_DECLARATION/);
});

test("current handler attribution excludes drift in other selected handler",()=>{
  const a=src();
  const b=src({recordingStatus:"const x=2;return {status:x};",
               usageStatus:"const x=3;return {status:x};"});
  const r=compare(a,b,"recordingStatus");
  assert.equal(r.counts.SELECTED_HANDLER.MODIFIED,2);
  assert.equal(r.selectedCurrent.MODIFIED,1);
  assert.equal(r.selectedOther.MODIFIED,1);
});
test("exact selected callable with a different selected callable drifting",()=>{
  const a=src();
  const b=src({usageStatus:"const x=4;return {status:x};"});
  const r=compare(a,b,"reserveCredit");
  assert.equal(r.selectedCurrent.MODIFIED,0);
  assert.equal(r.selectedOther.MODIFIED,1);
});
