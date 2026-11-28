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
 const otherAccount=db.collection("accounts").doc(other);
 const otherDevice="otherdevice"+rnd, ownDevice="opdevice"+rnd;
 const fixture=(id,devices)=>({ownerUid:id,plan:"Growth",planExpiresAt:new Date(Date.now()+86400000).toISOString(),period:new Date().toISOString().slice(0,7),used:0,reserved:0,creditWalletV1:true,creditWalletRemaining:3,devices});
 await account.set(fixture(owner,[{id:device,name:"Owner",registeredBy:owner}]));
 await otherAccount.set(fixture(other,[{id:otherDevice,name:"Other",registeredBy:other}]));
 await db.collection("operatorMemberships").doc(operator).set({uid:operator,accountId:owner,role:"operator",status:"active",emailHash:emailDigest(email(operator))});
 async function reject(r,label,message){assert.equal(r.body.error?.status,"PERMISSION_DENIED",label+" "+JSON.stringify(r));assert.equal(r.status,403);assert.equal(r.body.error.message,message,label);checks++}
 async function rest(token,path,method="GET",body){
  const res=await fetch("http://"+process.env.FIRESTORE_EMULATOR_HOST+"/v1/projects/"+PROJECT+"/databases/(default)/documents/"+path,{method,headers:{"content-type":"application/json","Authorization":"Bearer "+token},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  return res.status;
 }
 async function code(actual,expected,label){assert.equal(await actual,expected,label);checks++}
 await code(rest(ownerToken,"accounts/"+owner),200,"owner direct read");
 await code(rest(otherToken,"accounts/"+owner),403,"cross tenant direct read");
 await code(rest(opToken,"accounts/"+owner),403,"operator direct read denied");
 await code(rest(ownerToken,"accounts/"+owner,"PATCH",{fields:{creditWalletRemaining:{integerValue:"999"}}}),403,"owner direct write denied");
 await code(rest(opToken,"operatorMemberships/"+operator),403,"membership direct read denied");
 await code(rest(opToken,"operatorMemberships/"+operator,"PATCH",{fields:{role:{stringValue:"admin"}}}),403,"membership escalation denied");
 await reject(await call("registerDevice",opToken,{deviceId:device}),"operator cannot claim owner device","Device belongs to another user");
 await reject(await call("reserveCredit",opToken,{operationId:op1,barcode:"TEST-A",deviceId:device}),"operator cannot spend with owner device","Operator device ownership required");
 await reject(await call("reserveCredit",opToken,{operationId:op1,barcode:"TEST-A",deviceId:otherDevice}),"operator cannot spend with other tenant device","Device not registered for tenant");
 ok(await call("registerDevice",opToken,{deviceId:ownDevice}),"operator registers own device");
 const status=ok(await call("deviceStatus",opToken,{deviceId:ownDevice}),"operator status");
 assert.equal(status.registered,true);assert.deepEqual(status.devices.map(x=>x.id),[ownDevice]);
 await reject(await call("removeDevice",opToken,{deviceId:ownDevice,targetId:device}),"operator cannot remove owner device","Device not owned by operator");
 await reject(await call("removeDevice",opToken,{deviceId:ownDevice,targetId:otherDevice}),"operator cannot remove other tenant device","Device not owned by operator");
 ok(await call("reserveCredit",opToken,{operationId:op1,barcode:"TEST-A",deviceId:ownDevice,accountId:other}),"caller accountId cannot redirect credit");
 await wallet(2,1,0);
 assert.equal((await otherAccount.get()).data().creditWalletRemaining,3);checks++;
 ok(await call("finalizeCredit",opToken,{operationId:op1,success:false}),"refund");
 await wallet(3,0,0);
 ok(await call("removeDevice",opToken,{deviceId:ownDevice,targetId:ownDevice}),"operator removes own device");
 await reject(await call("reserveCredit",opToken,{operationId:op2,barcode:"TEST-B",deviceId:ownDevice}),"removed device denied","Device not registered for tenant");
 assert.deepEqual((await account.get()).data().devices.map(x=>x.id),[device]);checks++;
 assert.deepEqual((await otherAccount.get()).data().devices.map(x=>x.id),[otherDevice]);checks++;
 assert.equal(checks,22);
 console.log("PACKTOOK_FT03_TENANT_DEVICE=22/22_PASS");
 console.log("PACKTOOK_LEGACY_OWNER_DEVICE_POLICY=NOT_VERIFIED");
 console.log("PACKTOOK_APPCHECK=NOT_SECURITY_PROOF");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}
main().catch(e=>{console.error("PACKTOOK_FT03_FAIL="+e.stack);process.exitCode=2}).finally(async()=>app.delete());
