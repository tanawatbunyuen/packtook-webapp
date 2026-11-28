"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {emailDigest}=require("../../functions/operator-domain-v1.cjs");
const {createAtomicCreditCandidate}=require("../../functions/tenant-credit-atomic-v1.cjs");
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const clock=()=>Date.parse("2026-11-28T10:00:00.000Z");
const INC=n=>({__inc:n});
const deep=x=>JSON.parse(JSON.stringify(x));
const store=new Map();
let seq=0,transactions=0,writes=0,pass=0;
function snapshot(ref){let val=store.get(ref.path);return {exists:val!==undefined,data:()=>deep(val),id:ref.id}}
function ref(path){let id=path.split("/").at(-1);return {id,path,collection(name){return collection(path+"/"+name)}}}
function collection(prefix){return {doc(id){return ref(prefix+"/"+(id||"generated"+String(++seq).padStart(14,"0")))}}}
const db={collection,async runTransaction(fn){
 transactions++;const pending=[];let writeStarted=false;
 const tx={async get(r){if(writeStarted)throw Error("FIRESTORE_READ_AFTER_WRITE");return snapshot(r)},
 create(r,data){writeStarted=true;if(store.has(r.path)||pending.some(x=>x.ref.path===r.path))throw Error("DOCUMENT_EXISTS");pending.push({kind:"create",ref:r,data})},
 set(r,data){writeStarted=true;pending.push({kind:"set",ref:r,data})},
 update(r,data){writeStarted=true;if(!store.has(r.path))throw Error("DOCUMENT_MISSING");pending.push({kind:"update",ref:r,data})},
 delete(r){writeStarted=true;pending.push({kind:"delete",ref:r})}
 };
 const result=await fn(tx);
 for(const w of pending){
  if(w.kind==="delete"){store.delete(w.ref.path);continue}
  const old=w.kind==="update"?store.get(w.ref.path):{};
  let next={...old};
  for(const [k,v] of Object.entries(w.data)){
   next[k]=v&&Object.prototype.hasOwnProperty.call(v,"__inc")?(old[k]||0)+v.__inc:v;
  }
  store.set(w.ref.path,deep(next));writes++;
 }
 return result;
}};
const FieldValue={serverTimestamp:()=>clock(),increment:INC};
const service=createAtomicCreditCandidate({db,FieldValue,HttpsError,clock});
const owner={actorUid:"owner001",accountId:"owner001",role:"admin"};
const op={actorUid:"operator002",accountId:"owner001",role:"operator"};
const other={actorUid:"operator003",accountId:"owner001",role:"operator"};
const email="operator@example.com";
const membership={uid:op.actorUid,accountId:op.accountId,status:"active",role:"operator",emailHash:emailDigest(email)};
const acct="accounts/owner001",membershipPath="operatorMemberships/operator002";
const opId=n=>"operation"+String(n).padStart(20,"0");
function lockPath(barcode){return acct+"/barcodeLocks/"+crypto.createHash("sha256").update(barcode).digest("hex")}
function base({wallet=true,remaining=2}={}){
 store.clear();writes=0;seq=0;
 store.set(acct,{ownerUid:"owner001",plan:"Free",period:"2026-11",used:0,reserved:0,
  creditWalletV1:wallet,creditWalletRemaining:remaining,
  devices:[{id:"device-owner"},{id:"device-operator",registeredBy:"operator002"}]});
 store.set(membershipPath,deep(membership));
}
const reservation=(id,barcode="BAR1",extras={})=>({ctx:op,verifiedEmail:email,
 operationId:opId(id),barcode,deviceId:"device-operator",...extras});
function balances(){const a=store.get(acct);return [a.reserved,a.used,a.creditWalletRemaining]}
async function denied(call,code){const before=writes;await assert.rejects(call(),e=>e instanceof HttpsError&&e.code===code);assert.equal(writes,before);pass++}
(async()=>{
 base();const res=await service.reserve(reservation(1));assert.equal(res.status,"reserved");
 assert.deepEqual(balances(),[1,0,1]);pass++;
 const replay=await service.reserve(reservation(1));assert.equal(replay.idempotent,true);
 assert.deepEqual(balances(),[1,0,1]);pass++;
 await denied(()=>service.reserve(reservation(2,"BAR1")),"already-exists");
 await denied(()=>service.reserve(reservation(3,"BAR2",{verifiedEmail:"wrong@example.com"})),"permission-denied");
 store.set(membershipPath,{...membership,status:"revoked"});
 await denied(()=>service.reserve(reservation(3,"BAR2")),"permission-denied");
 store.set(membershipPath,deep(membership));
 const finish=()=>service.finalize({ctx:op,verifiedEmail:email,operationId:opId(1),success:true,filename:"video.mp4",bytes:5000});
 assert.equal((await finish()).status,"completed");assert.deepEqual(balances(),[0,1,1]);pass++;
 assert.equal((await finish()).idempotent,true);assert.deepEqual(balances(),[0,1,1]);pass++;
 await denied(()=>service.reserve(reservation(4,"BAR1")),"already-exists");
 base();await service.reserve(reservation(5,"BAR5"));
 await denied(()=>service.finalize({ctx:owner,operationId:opId(5),success:true,filename:"video.mp4",bytes:5000}),"permission-denied");
 assert.equal((await service.finalize({ctx:op,verifiedEmail:email,operationId:opId(5),success:false})).status,"failed");
 assert.deepEqual(balances(),[0,0,2]);pass++;
 const twice=await service.finalize({ctx:op,verifiedEmail:email,operationId:opId(5),success:false});
 assert.equal(twice.idempotent,true);assert.deepEqual(balances(),[0,0,2]);pass++;
 base({remaining:0});
 await denied(()=>service.reserve(reservation(6,"BAR6")),"resource-exhausted");
 base();const now=clock();
 const barcode="BAR7",requestId="request0000000000001",approvalId="approval000000000001";
 store.set(lockPath(barcode),{status:"completed",operationId:opId(90),barcode});
 store.set(acct+"/duplicateRequests/"+requestId,{status:"approved",accountId:"owner001",
  requestedBy:"operator002",barcode,approvalId});
 store.set(acct+"/duplicateApprovals/"+approvalId,{status:"approved",accountId:"owner001",
  requestedBy:"operator002",barcode,requestId,expiresAtMs:now+30000});
 const approved=reservation(7,barcode,{approvalId});
 assert.equal((await service.reserve(approved)).status,"reserved");
 assert.equal(store.get(acct+"/duplicateApprovals/"+approvalId).status,"consumed");
 assert.equal(store.get(acct+"/duplicateRequests/"+requestId).status,"consumed");
 assert.deepEqual(balances(),[1,0,1]);pass++;
 await denied(()=>service.reserve(reservation(8,barcode,{approvalId})),"already-exists");
 assert.equal((await service.finalize({ctx:op,verifiedEmail:email,operationId:opId(7),success:false})).status,"failed");
 assert.equal(store.get(lockPath(barcode)).status,"completed");
 assert.equal(store.get(lockPath(barcode)).operationId,opId(90));
 assert.deepEqual(balances(),[0,0,2]);pass++;
 await denied(()=>service.reserve(reservation(9,barcode,{approvalId})),"permission-denied");
 base({wallet:false});
 await service.reserve(reservation(10,"BAR10"));
 assert.deepEqual(balances().slice(0,2),[1,0]);pass++;
 await service.finalize({ctx:op,verifiedEmail:email,operationId:opId(10),success:true,filename:"ok.mp4",bytes:1001});
 assert.deepEqual(balances().slice(0,2),[0,1]);pass++;
 base();store.set(membershipPath,{...membership,accountId:"other"});
 await denied(()=>service.reserve(reservation(11,"BAR11")),"permission-denied");
 assert.equal(pass,19);
 console.log("PACKTOOK_ATOMIC_CREDIT_MOCK_CASES=19/19_PASS");
 console.log("PACKTOOK_ATOMIC_CREDIT_INMEMORY_TRANSACTIONS="+transactions);
 console.log("PACKTOOK_TX_READ_AFTER_WRITE=GUARDED");
 console.log("PACKTOOK_TX_DENIED_WRITES=0");
 console.log("PACKTOOK_BACKEND_INDEX_WIRED=NO");
 console.log("PACKTOOK_FIRESTORE_EMULATOR=NOT_EXECUTED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
})().catch(e=>{console.error("PACKTOOK_ATOMIC_CREDIT_MOCK=FAIL "+e.stack);process.exitCode=2});
