"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {legacyReadOnlyCandidate}=require("./legacy-status-guard-candidate.cjs");
const UID="stagingUser123",OP="p75_recording000001";
function fixture(){
 const calls=[],data={plan:"Free",remaining:5};
 let allowed=false;
 const protect=handler=>async req=>{
  calls.push("authorize");
  if(!allowed)throw Object.assign(new Error("denied"),{code:"permission-denied"});
  return handler(req.auth.uid,req.data||{});
 };
 const db={
  collection:name=>{calls.push("collection:"+name);return{
   doc:id=>{calls.push("doc:"+id);return{
    get:async()=>({exists:true,data:()=>data}),
    collection:coll=>{calls.push("collection:"+coll);return{
     doc:record=>{calls.push("doc:"+record);return{
      get:async()=>({exists:true,data:()=>({status:"completed",barcode:"demo",period:"2026-11",file:null})})
     }}
    }}
   }}
  }}
 };
 class HttpsError extends Error{constructor(code,msg){super(msg);this.code=code;}}
 const functions=legacyReadOnlyCandidate({protect,db,usageResponse:a=>a,HttpsError});
 return {functions,calls,authorize:()=>{allowed=true;}};
}
test("P75 scoped candidate defines exactly two existing read-only exports",()=>{
 const {functions}=fixture();
 assert.deepEqual(Object.keys(functions).sort(),["recordingStatus","usageStatus"]);
 assert.equal(Object.isFrozen(functions),true);
});
test("P75 both read-only handlers deny before any database access",async()=>{
 const x=fixture();
 await assert.rejects(x.functions.usageStatus({auth:{uid:UID}}),e=>e.code==="permission-denied");
 await assert.rejects(x.functions.recordingStatus({auth:{uid:UID},data:{operationId:OP}}),e=>e.code==="permission-denied");
 assert.deepEqual(x.calls,["authorize","authorize"]);
});
test("P75 authorized status uses only authenticated user document",async()=>{
 const x=fixture();x.authorize();
 const r=await x.functions.usageStatus({auth:{uid:UID}});
 assert.equal(r.remaining,5);
 assert.deepEqual(x.calls,["authorize","collection:accounts","doc:"+UID]);
});
test("P75 recording status uses authenticated user, never request owner override",async()=>{
 const x=fixture();x.authorize();
 const result=await x.functions.recordingStatus({auth:{uid:UID},data:{operationId:OP,uid:"someoneElse"}});
 assert.equal(result.status,"completed");
 assert.ok(x.calls.includes("doc:"+UID));
 assert.equal(x.calls.includes("doc:someoneElse"),false);
});
test("P75 invalid operation ID rejects without Firestore reads",async()=>{
 const x=fixture();x.authorize();
 await assert.rejects(x.functions.recordingStatus({auth:{uid:UID},data:{operationId:"bad"}}),
  e=>e.code==="invalid-argument");
 assert.deepEqual(x.calls,["authorize"]);
});
test("P75 candidate fails closed if no protective wrapper provided",()=>{
 assert.throws(()=>legacyReadOnlyCandidate({}),/P75_DEPENDENCIES_REQUIRED/);
});
