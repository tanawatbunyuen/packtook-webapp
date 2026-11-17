"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {inspect}=require("./v7-ast-statement-security.cjs");

function doc(name,body){
 return '"use strict";\nconst options={region:"asia-southeast1"};\n'+
 'exports.'+name+'=onCall(options,async req=>{\n'+body+'\n});';
}
const response="return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file||null};";
const usage="return {plan:a.plan,remaining:creditAvailable(a)};";
test("recordingStatus statement exact despite formatting comments",()=>{
 const a=doc("recordingStatus","const id=uid(req);\n"+response);
 const b=doc("recordingStatus","const id = uid(req); // note\n"+response);
 const r=inspect(a,b,"recordingStatus");
 assert.equal(r.status,"EXACT_STATEMENT_TOKENS");
 assert.equal(r.changedBlocks,0);
});
test("recordingStatus changing authorization path tags auth and datastore",()=>{
 const a=doc("recordingStatus","const snap=await ownerRef(id);\n"+response);
 const b=doc("recordingStatus","const snap=await db.collection('accounts').doc(id).get();\n"+response);
 const r=inspect(a,b,"recordingStatus");
 assert.equal(r.status,"DRIFT_REVIEW_REQUIRED");
 assert.ok(r.categories.AUTH_TENANCY>=1);
 assert.ok(r.categories.FIRESTORE_READ_PATH>=1);
 assert.equal(r.operations.MODIFIED,1);
});
test("usageStatus credit expression category",()=>{
 const a=doc("usageStatus","const remaining=creditAvailable(a);\n"+usage);
 const b=doc("usageStatus","const remaining=a.creditWalletRemaining;\n"+usage);
 const r=inspect(a,b,"usageStatus");
 assert.equal(r.operations.MODIFIED,1);
 assert.ok(r.categories.CREDIT_SUBSCRIPTION>=1);
});
test("input validation and error class",()=>{
 const a=doc("recordingStatus","if(!validOp(op))throw new HttpsError('invalid-argument','Bad');\n"+response);
 const b=doc("recordingStatus","if(!op)throw new HttpsError('permission-denied','Bad');\n"+response);
 const r=inspect(a,b,"recordingStatus");
 assert.ok(r.categories.INPUT_VALIDATION>=1);
 assert.ok(r.categories.ERROR_HANDLING>=1);
 assert.ok(r.categories.CONTROL_FLOW>=1);
});
test("return contract change is detectable",()=>{
 const a=doc("recordingStatus","const op=data(req).operationId;\n"+response);
 const b=doc("recordingStatus","const op=data(req).operationId;\nreturn {recordingId:op};");
 const r=inspect(a,b,"recordingStatus");
 assert.ok(r.categories.RESPONSE_CONTRACT>=1);
 assert.equal(r.status,"DRIFT_REVIEW_REQUIRED");
});
test("insert statement does not shift remaining statements",()=>{
 const a=doc("usageStatus","const id=uid(req);\n"+usage);
 const b=doc("usageStatus","const id=uid(req);\nconst x=0;\n"+usage);
 const r=inspect(a,b,"usageStatus");
 assert.equal(r.changedBlocks,1);
 assert.equal(r.operations.DEPLOYED_ONLY,1);
 assert.equal(r.operations.MODIFIED,0);
});
test("ambiguous several-to-one alignment never clears",()=>{
 const a=doc("usageStatus","const x=1;\nconst y=2;\n"+usage);
 const b=doc("usageStatus","const z=3;\n"+usage);
 const r=inspect(a,b,"usageStatus");
 assert.equal(r.status,"DRIFT_REVIEW_REQUIRED");
 assert.equal(r.ambiguousBlocks,1);
 assert.equal(r.categoryCoverage,"AMBIGUOUS_STATEMENT_ALIGNMENT");
});
test("no handler present fails closed",()=>{
 assert.throws(()=>inspect("const a=1;",doc("usageStatus","return {};"),"usageStatus"),/EXPORT_UNVERIFIABLE/);
});
test("no support for off-scope function",()=>{
 assert.throws(()=>inspect(doc("reserveCredit","return {};"),doc("reserveCredit","return {};"),"reserveCredit"),/TARGET_UNSUPPORTED/);
});
test("parse error fails closed",()=>{
 assert.throws(()=>inspect(doc("usageStatus","return {};"),"exports.usageStatus=onCall(", "usageStatus"),/PARSE_UNVERIFIABLE/);
});
test("multi handler export duplicate fails closed",()=>{
 const a=doc("recordingStatus",response);
 assert.throws(()=>inspect(a+"\n"+a,a,"recordingStatus"),/EXPORT_UNVERIFIABLE/);
});
