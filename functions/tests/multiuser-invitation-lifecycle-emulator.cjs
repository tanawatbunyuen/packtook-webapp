"use strict";
/** LOCAL DEMO ONLY: real callable invitation/acceptance lifecycle smoke.
 * Uses Auth/Firestore/Functions emulators, synthetic fixture writes only.
 * Placeholder App Check is accepted by local Emulator only; this is NOT a
 * valid token or a security verification, never use outside this file.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {emailDigest}=require("../operator-domain-v1.cjs");
const PROJECT="demo-packtook-integrated-01",HOST="127.0.0.1:5001";
const local=h=>/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(h||"");
if((process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT)!==PROJECT||
 !local(process.env.FIREBASE_AUTH_EMULATOR_HOST)||
 !local(process.env.FIRESTORE_EMULATOR_HOST)||
 !local(process.env.FIREBASE_EMULATOR_HUB)){
 console.error("PACKTOOK_INVITE_E2E_FAIL_CLOSED=NONDEMO_OR_NONLOCAL");
 process.exit(2);
}
const app=admin.initializeApp({projectId:PROJECT},"invite-e2e-"+process.pid);
const db=app.firestore(),auth=app.auth();
const rnd=crypto.randomBytes(9).toString("hex");
const owner="inviteowner"+rnd,operator="inviteoperator"+rnd;
const email=id=>id+"@example.test",password="Test-"+rnd+"Aa1!";
const base="http://"+HOST+"/"+PROJECT+"/asia-southeast1/";
let passed=0;
async function user(id){
 await auth.createUser({uid:id,email:email(id),emailVerified:true,password});
 const res=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+
  "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({email:email(id),password,returnSecureToken:true}),
   signal:AbortSignal.timeout(15000)});
 assert.equal(res.status,200,"Auth local login");
 const data=await res.json();assert.ok(data.idToken);
 assert.equal((await auth.verifyIdToken(data.idToken)).uid,id);
 return data.idToken;
}
async function call(endpoint,token,data={}){
 const res=await fetch(base+endpoint,{method:"POST",headers:{
  "content-type":"application/json","authorization":"Bearer "+token,
  "X-Firebase-AppCheck":"local-emulator-placeholder-not-a-real-token"},
  body:JSON.stringify({data}),signal:AbortSignal.timeout(30000)});
 const body=await res.text();let parsed;
 try{parsed=JSON.parse(body)}catch{throw Error(endpoint+" returned HTTP "+res.status+" nonJSON")}
 return {status:res.status,body:parsed};
}
function ok(r,label){assert.equal(r.status,200,label+" "+JSON.stringify(r));assert.ok(r.body.result,label+" result missing");passed++}
function rejected(r,label){assert.ok([400,401,403,404,409,412].includes(r.status),label+" "+JSON.stringify(r));assert.ok(r.body.error,label+" no error");passed++}
async function main(){
 const [ot,pt]=await Promise.all([user(owner),user(operator)]);
 await db.collection("accounts").doc(owner).set({ownerUid:owner,plan:"Free",
  period:new Date().toISOString().slice(0,7),used:0,reserved:0,
  creditWalletV1:true,creditWalletRemaining:5,devices:[]});
 rejected(await call("inviteOperator",ot,{email:email(owner)}),"no self invitation");
 rejected(await call("acceptOperatorInvite",pt),"no invitation acceptance blocked");
 const invite=await call("inviteOperator",ot,{email:email(operator)});
 ok(invite,"owner invite");
 assert.equal(invite.body.result.invited,true);
 const hash=emailDigest(email(operator));
 const idx=await db.collection("operatorInviteIndex").doc(hash).get();
 assert.equal(idx.exists,true);assert.equal(idx.data().status,"pending");passed++;
 const ownerInv=await db.collection("accounts").doc(owner).collection("operatorInvites").doc(hash).get();
 assert.equal(ownerInv.exists,true);passed++;
 const accepted=await call("acceptOperatorInvite",pt);
 ok(accepted,"operator acceptance");
 assert.equal(accepted.body.result.accepted,true);
 const member=await db.collection("operatorMemberships").doc(operator).get();
 assert.equal(member.exists,true);assert.equal(member.data().accountId,owner);
 assert.equal(member.data().status,"active");passed++;
 const idxAfter=await db.collection("operatorInviteIndex").doc(hash).get();
 assert.equal(idxAfter.data().status,"accepted");passed++;
 rejected(await call("acceptOperatorInvite",pt),"double accept blocked");
 rejected(await call("inviteOperator",pt,{email:"extra"+rnd+"@example.test"}),"operator cannot invite");
 const role=await call("accountRole",pt);
 ok(role,"accepted operator role");
 assert.equal(role.body.result.role,"operator");passed++;
 assert.equal((await db.collection("accounts").doc(operator).get()).exists,false);passed++;
 assert.equal(passed,12,"Expected 12 invitation lifecycle assertions");
 console.log("PACKTOOK_INVITATION_ACCEPTANCE_E2E=12/12_PASS");
 console.log("PACKTOOK_LOCAL_PLACEHOLDER_APPCHECK=NOT_SECURITY_PROOF");
 console.log("PACKTOOK_STAGING_APPCHECK=NOT_VERIFIED");
 console.log("PACKTOOK_LOCAL_AUTH_FIRESTORE_FIXTURE_WRITES=YES");
 console.log("PACKTOOK_CLOUD_WRITES=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}
main().catch(e=>{console.error("PACKTOOK_INVITATION_ACCEPTANCE_E2E_FAIL="+e.stack);process.exitCode=2})
.finally(async()=>app.delete());
