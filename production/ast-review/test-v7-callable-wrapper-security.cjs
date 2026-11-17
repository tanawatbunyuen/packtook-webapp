"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {inspect}=require("./v7-callable-wrapper-security.cjs");
function doc(name="recordingStatus",opts="const options={region:'asia-southeast1'};",
 header="async req=>",body="const id=uid(req);return {status:id};",
 first="options",callee="onCall"){
 return opts+"\nexports."+name+"="+callee+"("+first+","+header+"{"+body+"});";
}
test("exact wrapper with no enforcement declaration remains not proven",()=>{
 const x=doc(),r=inspect(x,x,"recordingStatus");
 assert.equal(r.callbackHeader,"EXACT_CALLBACK_HEADER_TOKENS");
 assert.equal(r.sourceAppCheck,"NO_ENFORCEMENT_LITERAL_IN_OPTIONS");
 assert.equal(r.deployedAppCheck,"NO_ENFORCEMENT_LITERAL_IN_OPTIONS");
 assert.equal(r.backendEnforcement,"NOT_PROVEN");
 assert.equal(r.functionGate,"REVIEW_REQUIRED");
});
test("wrapper callback async changes detected despite same body",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={region:'asia-southeast1'};","req=>"),"recordingStatus");
 assert.equal(r.callbackHeader,"DRIFT_CALLBACK_HEADER_TOKENS");
});
test("wrapper params changed detected",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={region:'asia-southeast1'};","async ({data})=>"),"recordingStatus");
 assert.equal(r.callbackHeader,"DRIFT_CALLBACK_HEADER_TOKENS");
});
test("static literal true is not runtime enforcement proof",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={region:'asia-southeast1',enforceAppCheck:true};"),"recordingStatus");
 assert.equal(r.deployedAppCheck,"TRUE_LITERAL_IN_OPTIONS");
 assert.equal(r.backendEnforcement,"NOT_PROVEN");
});
test("explicit false literal detected",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={enforceAppCheck:false};"),"recordingStatus");
 assert.equal(r.deployedAppCheck,"FALSE_LITERAL_IN_OPTIONS");
});
test("spread options unresolved",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={...defaults,enforceAppCheck:true};"),"recordingStatus");
 assert.equal(r.deployedAppCheck,"UNRESOLVED_OPTIONS");
});
test("dynamic enforce app check unresolved",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={enforceAppCheck:process.env.ENABLED};"),"recordingStatus");
 assert.equal(r.deployedAppCheck,"UNRESOLVED_OPTIONS");
});
test("duplicate enforce app check properties conflict",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={enforceAppCheck:true,enforceAppCheck:false};"),"recordingStatus");
 assert.equal(r.deployedAppCheck,"CONFLICTING_OPTIONS");
});
test("changing binding contents does not imply options arg drift",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={region:'asia-southeast1',enforceAppCheck:true};"),"recordingStatus");
 assert.equal(r.optionsArgument,"EXACT_OPTIONS_ARGUMENT_TOKENS");
 assert.equal(r.deployedAppCheck,"TRUE_LITERAL_IN_OPTIONS");
});
test("changes to onCall callee are detected",()=>{
 const r=inspect(doc(),doc("recordingStatus","const options={region:'asia-southeast1'};","async req=>","const id=uid(req);return {status:id};","options","wrapperCall"),"recordingStatus");
 assert.equal(r.callableCallee,"DRIFT_CALLEE_TOKENS");
 assert.equal(r.directOnCallBoth,false);
});
test("unsupported source parse blocks",()=>{
 assert.throws(()=>inspect(doc(),"exports.recordingStatus = onCall(", "recordingStatus"));
});
test("unsupported export name blocks",()=>{
 assert.throws(()=>inspect(doc("reserveCredit"),doc("reserveCredit"),"reserveCredit"));
});
test("never conflate no options with enforcement true",()=>{
 const a=doc("usageStatus","const options=getOptions();"),r=inspect(a,a,"usageStatus");
 assert.equal(r.sourceAppCheck,"UNRESOLVED_OPTIONS");
 assert.equal(r.backendEnforcement,"NOT_PROVEN");
});
