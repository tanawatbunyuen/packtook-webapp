"use strict";
/**
 * LOCAL ONLY authenticated integrated Callables E2E. Requires firebase emulators:exec
 * --project demo-packtook-integrated-01 --only auth,firestore,functions.
 * All users and Firestore fixtures are ephemeral synthetic demo data.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {emailDigest}=require("../operator-domain-v1.cjs");
const PROJECT="demo-packtook-integrated-01";
const check=h=>/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(h||"");
const current=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(current!==PROJECT||!check(process.env.FIRESTORE_EMULATOR_HOST)||
 !check(process.env.FIREBASE_AUTH_EMULATOR_HOST)||
 !check(process.env.FIREBASE_EMULATOR_HUB)){
 console.error("PACKTOOK_AUTHENTICATED_E2E_FAIL_CLOSED=NONLOCAL_DEMO_CONFIG");
 process.exit(2);
}
const app=admin.initializeApp({projectId:PROJECT},"packtook-local-e2e-"+process.pid);
const db=app.firestore(),auth=app.auth();
const suffix=crypto.randomBytes(10).toString("hex");
const uid=n=>n+suffix;
const owner=uid("owner"),operator=uid("operator"),outsider=uid("outsider");
const emails={owner:owner+"@example.test",operator:operator+"@example.test",outsider:outsider+"@example.test"};
const password="LocalTest-"+suffix+"Aa1!";
const apiBase="http://127.0.0.1:5001/"+PROJECT+"/asia-southeast1/";
const opId="record"+suffix;
const ownerAccount=()=>db.collection("accounts").doc(owner);
let cases=0;
async function createUser(id,email){
 await auth.createUser({uid:id,email,password,emailVerified:true});
 const r=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+
  "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({email,password,returnSecureToken:true}),
   signal:AbortSignal.timeout(15000)});
 const json=await r.json();
 if(!r.ok||!json.idToken)throw Error("Auth Emulator signIn failed "+JSON.stringify(json));
 return json.idToken;
}
async function call(name,token,data={}){
 const r=await fetch(apiBase+name,{method:"POST",headers:{
  "content-type":"application/json","authorization":"Bearer "+token},
  body:JSON.stringify({data}),signal:AbortSignal.timeout(20000)});
 let json;const response=await r.text();
 try{json=JSON.parse(response)}catch{throw Error(name+" non-JSON HTTP "+r.status+" "+response.slice(0,250))}
 return {status:r.status,json};
}
function expectOk(r,name){assert.equal(r.status,200,name+": "+JSON.stringify(r));assert.ok(r.json.result,name+" missing callable result");cases++}
function expectDenied(r,name){assert.ok([400,401,403,404,412].includes(r.status),name+": expected reject, got "+JSON.stringify(r));assert.ok(r.json.error,name+" missing error");cases++}
async function main(){
 const [ownerToken,operatorToken,outsiderToken]=await Promise.all([
  createUser(owner,emails.owner),createUser(operator,emails.operator),createUser(outsider,emails.outsider)]);
 const period=new Date().toISOString().slice(0,7);
 await ownerAccount().set({ownerUid:owner,plan:"Free",period,used:0,reserved:0,
  creditWalletV1:true,creditWalletRemaining:5,
  devices:[{id:"ownerdevice000000001",name:"Owner recorder"},
           {id:"operatordevice0000001",name:"Operator recorder",registeredBy:operator}]});
 await db.collection("operatorMemberships").doc(operator).set({
  uid:operator,accountId:owner,role:"operator",status:"active",emailHash:emailDigest(emails.operator)});
 await ownerAccount().collection("recordings").doc(opId).set({
  operationId:opId,barcode:"LOCAL-PRIVATE-BARCODE",accountId:owner,
  recordedBy:owner,period,status:"completed",file:{filename:"owner.mp4",bytes:4000}});
 expectOk(await call("accountRole",ownerToken),"owner accountRole");
 const opRole=await call("accountRole",operatorToken);
 expectOk(opRole,"operator accountRole");
 assert.equal(opRole.json.result.role,"operator");
 assert.equal(opRole.json.result.accountId,owner);
 assert.equal(opRole.json.result.canApproveDuplicates,false);
 cases++;
 const usage=await call("usageStatus",operatorToken);
 expectOk(usage,"operator usageStatus");
 assert.equal(usage.json.result.remaining,5);
 cases++;
 const devices=await call("deviceStatus",operatorToken,{deviceId:"operatordevice0000001"});
 expectOk(devices,"operator deviceStatus");
 assert.equal(devices.json.result.registered,true);
 assert.equal(devices.json.result.devices.length,1);
 cases++;
 expectDenied(await call("recordingStatus",operatorToken,{operationId:opId}),"operator cannot read owner recording");
 expectDenied(await call("subscriptionOverview",operatorToken),"operator cannot read billing");
 expectDenied(await call("pendingVideoReservations",operatorToken),"operator cannot invoke owner recovery listing");
 expectDenied(await call("authorizeDuplicate",operatorToken,{barcode:"LOCAL-PRIVATE-BARCODE",reason:"operator denied owner bypass"}),"operator cannot self authorize legacy override");
 await db.collection("operatorMemberships").doc(operator).update({status:"revoked"});
 expectDenied(await call("accountRole",operatorToken),"revoked operator denied");
 expectDenied(await call("deviceStatus",operatorToken,{deviceId:"operatordevice0000001"}),"revoked operator device blocked");
 // Pending invitation should prohibit account bootstrap.
 await db.collection("operatorInviteIndex").doc(emailDigest(emails.outsider)).set({
  status:"pending",accountId:owner,expiresAtMs:Date.now()+600000});
 expectDenied(await call("accountRole",outsiderToken),"pending operator invite blocked");
 assert.equal((await db.collection("accounts").doc(outsider).get()).exists,false,
  "Pending invite must not silently create standalone Free account");
 cases++;
 console.log("PACKTOOK_AUTHENTICATED_EMULATOR_E2E="+cases+"/13_PASS");
 console.log("PACKTOOK_OPERATOR_TENANT_ISOLATION=PASS");
 console.log("PACKTOOK_OWNER_BILLING_GUARD=PASS");
 console.log("PACKTOOK_REVOKED_OPERATOR_GUARD=PASS");
 console.log("PACKTOOK_PENDING_INVITATION_BOOTSTRAP=BLOCKED");
 console.log("PACKTOOK_APP_CHECK_VALID_TOKEN=NOT_TESTED");
 console.log("PACKTOOK_LOCAL_DEMO_FIXTURE_WRITES=YES");
 console.log("PACKTOOK_CLOUD_WRITES=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}
main().catch(e=>{console.error("PACKTOOK_AUTHENTICATED_EMULATOR_E2E_FAIL="+e.stack);process.exitCode=2})
 .finally(async()=>{await app.delete()});
