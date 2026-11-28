"use strict";
/**
 * Local Firestore Emulator concurrency test. FAIL CLOSED without explicit local
 * FIRESTORE_EMULATOR_HOST and hard-pinned demo project. Never connect to cloud.
 * Run via firebase emulators:exec --only firestore --project demo-packtook-atomic-v1 ...
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {createAtomicCreditCandidate}=require("../tenant-credit-atomic-v1.cjs");
const {emailDigest}=require("../operator-domain-v1.cjs");
const host=process.env.FIRESTORE_EMULATOR_HOST||"";
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT||"";
if(!/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(host)||
   project!=="demo-packtook-atomic-v1"){
 console.error("PACKTOOK_EMULATOR_FAIL_CLOSED=NO_VERIFIED_LOCAL_DEMO_ENDPOINT");
 process.exit(2);
}
const app=admin.initializeApp({projectId:project},"packtook-atomic-emulator-"+process.pid);
const db=app.firestore();
const FieldValue=admin.firestore.FieldValue;
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const now=Date.parse("2026-11-28T10:00:00Z");
const service=createAtomicCreditCandidate({db,FieldValue,HttpsError,clock:()=>now});
const id=crypto.randomUUID().replace(/-/g,"").slice(0,20);
const accountId="atomic"+id;
const uid="operator"+id;
const email=id+"@example.test";
const ctx={actorUid:uid,accountId,role:"operator"};
const prefix=()=>db.collection("accounts").doc(accountId);
const member=()=>db.collection("operatorMemberships").doc(uid);
const op=n=>"operation"+String(n).padStart(20,"0");
const reserve=(n,barcode,approvalId)=>service.reserve({ctx,verifiedEmail:email,operationId:op(n),
 barcode,deviceId:"operator-device",...(approvalId?{approvalId}:{})});
const finalize=(n,success)=>service.finalize({ctx,verifiedEmail:email,operationId:op(n),
 success,...(success?{filename:"video.mp4",bytes:2500}:{})});
let pass=0;
async function setup(balance){
 const ref=prefix();
 await ref.set({ownerUid:accountId,plan:"Free",period:"2026-11",used:0,reserved:0,
  creditWalletV1:true,creditWalletRemaining:balance,
  devices:[{id:"operator-device",registeredBy:uid}]});
 await member().set({uid,accountId,role:"operator",status:"active",emailHash:emailDigest(email)});
}
async function balance(){
 const s=await prefix().get(),v=s.data();
 return {remaining:v.creditWalletRemaining,reserved:v.reserved,used:v.used};
}
function success(r){return r.status==="fulfilled"}
function failure(r){return r.status==="rejected"&&r.reason?.code==="resource-exhausted"}
async function run(){
 // Two competing operations and only one wallet credit. Firestore retries must
 // serialize the winning transaction; losing reservation cannot double-spend.
 await setup(1);
 const a=await Promise.allSettled([reserve(1,"CONCURRENT-A"),reserve(2,"CONCURRENT-B")]);
 assert.equal(a.filter(success).length,1,"Exactly one credit reservation succeeds");
 assert.equal(a.filter(failure).length,1,"Other reservation exhausts credits");
 assert.deepEqual(await balance(),{remaining:0,reserved:1,used:0});
 pass++;
 // Revocation is checked by a transaction-local membership document read.
 await member().update({status:"revoked"});
 await assert.rejects(reserve(3,"CONCURRENT-C"),e=>e.code==="permission-denied");
 await member().update({status:"active"});
 pass++;
 // Same operation ID replay concurrent: one reserve, another idempotent result.
 await setup(2);
 const b=await Promise.allSettled([reserve(4,"SAME-OP"),reserve(4,"SAME-OP")]);
 assert.equal(b.filter(success).length,2,"Both retries resolve safely");
 assert.equal(b.filter(x=>success(x)&&x.value.idempotent).length,1);
 assert.deepEqual(await balance(),{remaining:1,reserved:1,used:0});
 pass++;
 // Simultaneous competing finish requests: only one finalization can commit.
 const c=await Promise.allSettled([finalize(4,true),finalize(4,false)]);
 assert.equal(c.filter(success).length,1);
 assert.equal(c.filter(x=>x.status==="rejected"&&x.reason?.code==="failed-precondition").length,1);
 const winner=c.find(success).value.status;
 assert.deepEqual(await balance(),winner==="completed"?
  {remaining:1,reserved:0,used:1}:{remaining:2,reserved:0,used:0});
 pass++;
 // Separate completed barcode + one approval token: racing overrides may use
 // it at most once, even if wallet has enough for both.
 await setup(3);
 const barcode="DUP-EMULATOR",requestId="request"+id,approvalId="approval"+id;
 const lockHash=crypto.createHash("sha256").update(barcode).digest("hex");
 await prefix().collection("barcodeLocks").doc(lockHash).set({
  status:"completed",barcode,operationId:op(900)});
 await prefix().collection("duplicateRequests").doc(requestId).set({
  status:"approved",accountId,requestedBy:uid,approvalId,barcode});
 await prefix().collection("duplicateApprovals").doc(approvalId).set({
  status:"approved",accountId,requestedBy:uid,requestId,barcode,expiresAtMs:now+60000});
 const d=await Promise.allSettled([reserve(6,barcode,approvalId),reserve(7,barcode,approvalId)]);
 assert.equal(d.filter(success).length,1);
 assert.equal(d.filter(x=>x.status==="rejected").length,1);
 assert.deepEqual(await balance(),{remaining:2,reserved:1,used:0});
 assert.equal((await prefix().collection("duplicateApprovals").doc(approvalId).get()).data().status,"consumed");
 assert.equal((await prefix().collection("duplicateRequests").doc(requestId).get()).data().status,"consumed");
 pass++;
 console.log("PACKTOOK_FIRESTORE_EMULATOR_CONCURRENCY=5/5_PASS");
 console.log("PACKTOOK_FIRESTORE_EMULATOR_PROJECT="+project);
 console.log("PACKTOOK_FIRESTORE_EMULATOR_WALLET_NO_DOUBLE_SPEND=PASS");
 console.log("PACKTOOK_FIRESTORE_EMULATOR_DUPLICATE_APPROVAL_SINGLE_USE=PASS");
 console.log("PACKTOOK_CLOUD_WRITES=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}
run().catch(e=>{console.error("PACKTOOK_EMULATOR_TEST_FAIL="+e.message);process.exitCode=2})
 .finally(async()=>{await app.delete()});
