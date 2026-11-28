"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");

const PROJECT="demo-packtook-integrated-01";

const local=h=>/^127\.0\.0\.1:\d+$/.test(h||"");

assert.equal(process.env.GCLOUD_PROJECT,PROJECT);

assert.equal(process.env.GOOGLE_CLOUD_PROJECT,PROJECT);

assert.ok(local(process.env.FIRESTORE_EMULATOR_HOST));

assert.ok(local(process.env.FIREBASE_AUTH_EMULATOR_HOST));

assert.ok(local(process.env.FIREBASE_EMULATOR_HUB));

const app=admin.initializeApp(
 {projectId:PROJECT},
 "owner-test-"+process.pid
);

const db=app.firestore();
const auth=app.auth();

const rnd=crypto.randomBytes(8).toString("hex");

const owner="platformowner"+rnd;
const customer="customer"+rnd;
const operator="operator"+rnd;
const unverified="unverified"+rnd;
const other="othercustomer"+rnd;

const password="Demo-"+rnd+"Aa1!";

let checks=0;

function pass(name){
 checks++;
 console.log("PASS "+name);
}

async function createUser(uid,verified,claim){

 const email=uid+"@example.test";

 await auth.createUser({
  uid,email,password,
  emailVerified:verified
 });

 if(claim){

  await auth.setCustomUserClaims(uid,{
   packtookPlatformOwner:true
  });

 }

 const r=await fetch(
  "http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+
  "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",
  {
   method:"POST",
   headers:{"content-type":"application/json"},
   body:JSON.stringify({
    email,password,
    returnSecureToken:true
   }),
   signal:AbortSignal.timeout(15000)
  }
 );

 assert.equal(r.status,200);

 const x=await r.json();

 assert.ok(x.idToken);

 return x.idToken;

}

async function call(name,token,data){

 const r=await fetch(
  "http://127.0.0.1:5001/"+PROJECT+
  "/asia-southeast1/"+name,
  {
   method:"POST",
   headers:{
    "content-type":"application/json",
    Authorization:"Bearer "+token,
    "X-Firebase-AppCheck":
      "local-emulator-placeholder-not-a-real-token"
   },
   body:JSON.stringify({data}),
   signal:AbortSignal.timeout(30000)
  }
 );

 return {status:r.status,body:await r.json()};

}

function ok(r){
 assert.equal(r.status,200,JSON.stringify(r));
 assert.ok(r.body.result);
 return r.body.result;
}

function denied(r,code){
 assert.ok(r.status>=400);
 assert.equal(
  r.body.error?.status,
  code,
  JSON.stringify(r)
 );
}

async function main(){

 const [ot,ct,pt,ut]=await Promise.all([
  createUser(owner,true,true),
  createUser(customer,true,false),
  createUser(operator,true,false),
  createUser(unverified,false,true),
  createUser(other,true,false)
 ]);

 const ref=db.collection("accounts").doc(customer);
 const otherRef=db.collection("accounts").doc(other);

 const fixture={
  plan:"Growth",
  planExpiresAt:"2099-01-01T00:00:00.000Z",
  creditWalletV1:true,
  creditWalletRemaining:10,
  reserved:0,
  used:0
 };

 await ref.set({...fixture,ownerUid:customer});
 await otherRef.set({...fixture,ownerUid:other});

 await db.collection("operatorMemberships")
  .doc(operator).set({
   uid:operator,
   accountId:customer,
   role:"operator",
   status:"active"
  });

 const read={customerUid:customer};

 const state=ok(await call(
  "ownerGetCustomerManageState",ot,read
 ));

 assert.equal(state.remainingCredits,10);
 pass("platform owner access");

 denied(await call(
  "ownerGetCustomerManageState",ct,read
 ),"PERMISSION_DENIED");
 pass("customer denied");

 denied(await call(
  "ownerGetCustomerManageState",pt,read
 ),"PERMISSION_DENIED");
 pass("operator denied");

 denied(await call(
  "ownerGetCustomerManageState",ut,read
 ),"PERMISSION_DENIED");
 pass("unverified platform owner denied");

 const grant={
  customerUid:customer,
  amount:5,
  reason:"Synthetic credit test",
  requestId:crypto.randomUUID()
 };

 const added=ok(await call(
  "ownerGrantVideoCredits",ot,grant
 ));

 assert.equal(added.before,10);
 assert.equal(added.after,15);
 pass("grant response");

 assert.equal(
  (await ref.get()).data().creditWalletRemaining,
  15
 );
 pass("grant persisted");

 denied(await call(
  "ownerGrantVideoCredits",ot,
  {...grant,amount:0,requestId:crypto.randomUUID()}
 ),"INVALID_ARGUMENT");
 pass("zero amount rejected");

 denied(await call(
  "ownerGrantVideoCredits",ot,
  {...grant,amount:-1,requestId:crypto.randomUUID()}
 ),"INVALID_ARGUMENT");
 pass("negative amount rejected");

 denied(await call(
  "ownerGrantVideoCredits",ot,
  {...grant,customerUid:owner,
   requestId:crypto.randomUUID()}
 ),"PERMISSION_DENIED");
 pass("self adjustment rejected");

 const replay=ok(await call(
  "ownerGrantVideoCredits",ot,grant
 ));

 assert.equal(replay.replayed,true);
 pass("idempotent replay");

 assert.equal(
  (await ref.get()).data().creditWalletRemaining,
  15
 );
 pass("no double credit");

 denied(await call(
  "ownerGrantVideoCredits",ot,
  {...grant,amount:6}
 ),"ALREADY_EXISTS");
 pass("modified payload rejected");

 await ref.update({openBillingRequestId:"demo-billing"});

 denied(await call(
  "ownerGrantVideoCredits",ot,
  {...grant,requestId:crypto.randomUUID()}
 ),"FAILED_PRECONDITION");
 pass("pending billing protected");

 await ref.update({
  openBillingRequestId:null,
  plan:"Pro"
 });

 denied(await call(
  "ownerGrantVideoCredits",ot,
  {...grant,requestId:crypto.randomUUID()}
 ),"FAILED_PRECONDITION");
 pass("unlimited plan protected");

 await ref.update({plan:"Growth"});

 const expiry={
  customerUid:customer,
  expiryDate:"2099-06-15",
  reason:"Synthetic expiry test",
  requestId:crypto.randomUUID()
 };

 const changed=ok(await call(
  "ownerUpdateCustomerExpiry",ot,expiry
 ));

 assert.equal(
  changed.expiryAt,
  "2099-06-15T17:00:00.000Z"
 );
 pass("expiry Bangkok boundary");

 assert.equal(
  (await ref.get()).data().planExpiresAt,
  changed.expiryAt
 );
 pass("expiry persisted");

 denied(await call(
  "ownerUpdateCustomerExpiry",ot,
  {...expiry,expiryDate:"2099-02-30",
   requestId:crypto.randomUUID()}
 ),"INVALID_ARGUMENT");
 pass("invalid calendar date rejected");

 const history=ok(await call(
  "ownerGetCustomerAdjustmentHistory",
  ot,read
 ));

 assert.equal(history.events.length,2);
 pass("history audit count");

 const credit=history.events.find(
  x=>x.operation==="grantCredits"
 );

 assert.equal(credit.before,10);
 assert.equal(credit.after,15);
 pass("credit history numeric integrity");

 const otherHistory=ok(await call(
  "ownerGetCustomerAdjustmentHistory",ot,
  {customerUid:other}
 ));

 assert.equal(otherHistory.events.length,0);

 assert.equal(
  (await otherRef.get()).data().creditWalletRemaining,
  10
 );
 pass("cross customer state isolation");

 assert.equal(checks,20);

 console.log("PACKTOOK_OWNER_MANAGEMENT_E2E=20/20_PASS");
 console.log("PACKTOOK_APPCHECK_LOCAL=NOT_SECURITY_PROOF");
 console.log("PACKTOOK_CLOUD_WRITES=0");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");

}

main()
 .catch(e=>{
  console.error("PACKTOOK_OWNER_E2E_FAIL="+e.stack);
  process.exitCode=2;
 })
 .finally(async()=>app.delete());
