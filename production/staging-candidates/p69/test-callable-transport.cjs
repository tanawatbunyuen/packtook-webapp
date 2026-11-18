"use strict";
/* P69 true Firebase Functions emulator HTTP callable transport test.
 * Sends only loopback requests to demo Firebase project, with no real creds.
 */
const {test}=require("node:test"),assert=require("node:assert/strict");
const HOST="http://127.0.0.1:5199";
const PROJ="demo-packtook-p69";
function guard(){
 if(process.env.GCLOUD_PROJECT!==PROJ||process.env.GCP_PROJECT!==PROJ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9199"||
  process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8199"||
  process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
  throw Error("P69_EMULATOR_ONLY");
}
async function call(name,headers={},data={}){
 const url=HOST+"/"+PROJ+"/asia-southeast1/"+name;
 const resp=await fetch(url,{method:"POST",headers:{"content-type":"application/json",...headers},
  body:JSON.stringify({data}),signal:AbortSignal.timeout(10000)});
 const body=await resp.json();
 return {status:resp.status,body};
}
async function signup(){
 const r=await fetch("http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:"p69-local@example.invalid",password:"not-a-real-secret-123",returnSecureToken:true}),
  signal:AbortSignal.timeout(10000)});
 const data=await r.json();
 assert.equal(r.ok,true,"Auth emulator signup must work");
 return data.idToken;
}
function assertDenied(r){
 assert.notEqual(r.status,200);
 assert.ok(r.body&&r.body.error,"Expected callable error envelope");
 assert.equal(r.body.result,undefined);
}
test("P69 actual callable transport via local Functions Emulator (negative matrix)",async t=>{
 guard();
 await t.test("anonymous usageStatus rejected at real onCall transport",async()=>{
  assertDenied(await call("p69UsageStatus"));
 });
 await t.test("anonymous recordingStatus rejected at real onCall transport",async()=>{
  assertDenied(await call("p69RecordingStatus",{}, {operationId:"p69_order000000001"}));
 });
 const token=await signup();
 await t.test("signed-in but missing App Check token cannot read usage",async()=>{
  assertDenied(await call("p69UsageStatus",{authorization:"Bearer "+token}));
 });
 await t.test("signed-in but missing App Check token cannot read recording",async()=>{
  assertDenied(await call("p69RecordingStatus",{authorization:"Bearer "+token},{operationId:"p69_order000000001"}));
 });
 await t.test("invalid bearer token cannot read usage",async()=>{
  assertDenied(await call("p69UsageStatus",{authorization:"Bearer invalid"}));
 });
 await t.test("unrecognized App Check token cannot establish valid session",async()=>{
  assertDenied(await call("p69UsageStatus",{"X-Firebase-AppCheck":"not-a-valid-token"}));
 });
});
