"use strict";
/** Integrated real HTTP callable credit lifecycle on LOCAL DEMO emulator only.
 * Synthetic Auth + Firestore fixtures only; placeholder AppCheck is accepted by
 * local emulator, NOT evidence of real token cryptographic integrity.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {emailDigest}=require("../operator-domain-v1.cjs");
const PROJECT="demo-packtook-integrated-01";
const local=h=>/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(h||"");
if((process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT)!==PROJECT||
 !local(process.env.FIREBASE_AUTH_EMULATOR_HOST)||
 !local(process.env.FIRESTORE_EMULATOR_HOST)||
 !local(process.env.FIREBASE_EMULATOR_HUB)){
 console.error("PACKTOOK_CREDIT_CALLABLE_E2E_FAIL_CLOSED=NONLOCAL_DEMO");
 process.exit(2);
}
const app=admin.initializeApp({projectId:PROJECT},"credit-callable-"+process.pid);
const db=app.firestore(),auth=app.auth();
const rnd=crypto.randomBytes(10).toString("hex"),owner="creditowner"+rnd,
 operator="creditoperator"+rnd,other="creditother"+rnd;
const password="Local-"+rnd+"Aa1!";
const email=id=>id+"@example.test";
const account=db.collection("accounts").doc(owner);
const device="creditdevice"+rnd;
const op1="creditopone"+rnd,op2="creditoptwo"+rnd,op3="creditopthree"+rnd;
let checks=0;
async function user(uid){
 await auth.createUser({uid,email:email(uid),emailVerified:true,password});
 const res=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+
  "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({email:email(uid),password,returnSecureToken:true}),
   signal:AbortSignal.timeout(15000)});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.ok(data.idToken);
 assert.equal((await auth.verifyIdToken(data.idToken)).uid,uid);
 return data.idToken;
}
async function call(name,token,data){
 const res=await fetch("http://127.0.0.1:5001/"+PROJECT+"/asia-southeast1/"+name,{
  method:"POST",headers:{"content-type":"application/json","Authorization":"Bearer "+token,
   "X-Firebase-AppCheck":"local-emulator-placeholder-not-a-real-token"},
  body:JSON.stringify({data}),signal:AbortSignal.timeout(30000)});
 const raw=await res.text();let body;
 try{body=JSON.parse(raw)}catch{throw Error(name+": non-json HTTP"+res.status)}
 return {status:res.status,body};
}
function ok(r,label){assert.equal(r.status,200,label+" "+JSON.stringify(r));assert.ok(r.body.result);checks++;return r.body.result}
function denied(r,label){
 assert.ok([400,401,403,404,409,412,429].includes(r.status),label+" "+JSON.stringify(r));
 assert.ok(r.body.error,label+": error response required");checks++;
}
async function wallet(expectedRemaining,expectedReserved,expectedUsed){
 const a=(await account.get()).data();
 assert.equal(a.creditWalletRemaining,expectedRemaining);
 assert.equal(a.reserved,expectedReserved);
 assert.equal(a.used,expectedUsed);checks++;
}
async function main(){
 const [ownerToken,opToken,otherToken]=await Promise.all([user(owner),user(operator),user(other)]);
 const period=new Date().toISOString().slice(0,7);
 await account.set({ownerUid:owner,plan:"Free",period,used:0,reserved:0,
  creditWalletV1:true,creditWalletRemaining:3,
  devices:[{id:device,name:"Operator",registeredBy:operator}]});
 await db.collection("operatorMemberships").doc(operator).set({
  uid:operator,accountId:owner,role:"operator",status:"active",emailHash:emailDigest(email(operator))});
 // Operators can spend only their tenant's credits on their own device.
 denied(await call("reserveCredit",otherToken,{operationId:op1,barcode:"CR-A",deviceId:device}),
  "outsider cannot use shared device");
 denied(await call("reserveCredit",ownerToken,{operationId:op1,barcode:"CR-A",deviceId:device}),
  "owner cannot use operator-bound device in legacy owner path");
 const reserve1=ok(await call("reserveCredit",opToken,{operationId:op1,barcode:"CR-A",deviceId:device}),
  "reserve first operation");
 assert.equal(reserve1.status,"reserved");
 await wallet(2,1,0);
 const retry1=ok(await call("reserveCredit",opToken,{operationId:op1,barcode:"CR-A",deviceId:device}),
  "idempotent reserve");
 assert.equal(retry1.idempotent,true);
 await wallet(2,1,0);
 denied(await call("reserveCredit",opToken,{operationId:op1,barcode:"DIFFERENT",deviceId:device}),
  "same op different barcode blocked");
 denied(await call("finalizeCredit",otherToken,{operationId:op1,success:true,filename:"x.mp4",bytes:3000}),
  "outsider cannot finalize operator recording");
 const finalized=ok(await call("finalizeCredit",opToken,{operationId:op1,success:true,filename:"a.mp4",bytes:3000}),
  "finalize success");
 assert.equal(finalized.status,"completed");
 await wallet(2,0,1);
 const again=ok(await call("finalizeCredit",opToken,{operationId:op1,success:true,filename:"a.mp4",bytes:3000}),
  "finalize idempotent");
 assert.equal(again.idempotent,true);
 await wallet(2,0,1);
 denied(await call("reserveCredit",opToken,{operationId:op2,barcode:"CR-A",deviceId:device}),
  "completed duplicate barcode blocked without approval");
 ok(await call("reserveCredit",opToken,{operationId:op2,barcode:"CR-B",deviceId:device}),
  "reserve second operation");
 await wallet(1,1,1);
 const failure=ok(await call("finalizeCredit",opToken,{operationId:op2,success:false}),
  "finalize failed recording refunds");
 assert.equal(failure.status,"failed");
 await wallet(2,0,1);
 // Revoke membership: even idempotent finalization must reject.
 await db.collection("operatorMemberships").doc(operator).update({status:"revoked"});
 denied(await call("finalizeCredit",opToken,{operationId:op1,success:true,filename:"a.mp4",bytes:3000}),
  "revoked operator cannot retry finalization");
 denied(await call("reserveCredit",opToken,{operationId:op3,barcode:"CR-C",deviceId:device}),
  "revoked operator cannot reserve");
 await wallet(2,0,1);
 assert.equal(checks,22,"Expected exactly 22 credit callable checks; got "+checks);
 console.log("PACKTOOK_INTEGRATED_CREDIT_CALLABLE_E2E=22/22_PASS");
 console.log("PACKTOOK_CREDIT_DOUBLE_SPEND_AND_REFUND=PASS");
 console.log("PACKTOOK_CREDIT_REVOKED_MEMBERSHIP=DENIED");
 console.log("PACKTOOK_APPCHECK_LOCAL_PLACEHOLDER=NOT_SECURITY_PROOF");
 console.log("PACKTOOK_CLOUD_WRITES=0");
 console.log("PACKTOOK_LOCAL_DEMO_FIXTURE_WRITES=YES");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}
main().catch(e=>{console.error("PACKTOOK_INTEGRATED_CREDIT_CALLABLE_E2E_FAIL="+e.stack);process.exitCode=2})
.finally(async()=>app.delete());
