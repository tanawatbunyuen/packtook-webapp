"use strict";
const assert=require("node:assert/strict");
const {emailDigest}=require("../../functions/operator-domain-v1.cjs");
const {createTenantTransactionGuards}=require("../../functions/tenant-credit-transaction-bridge-v1.cjs");
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const owner={actorUid:"owner001",accountId:"owner001",role:"admin"};
const operator={actorUid:"operator002",accountId:"owner001",role:"operator"};
const email="operator@example.com";
const membership={uid:"operator002",accountId:"owner001",role:"operator",status:"active",emailHash:emailDigest(email)};
const docs=new Map();
const key=(collection,id)=>collection+"/"+id;
const db={collection(name){return {doc(id){return {id,key:key(name,id)}}}}};
function ref(k){return {id:k.split("/").at(-1),key:k}}
const acct=ref("accounts/owner001"),rec=ref("accounts/owner001/recordings/op0000000000000001");
const appr=ref("accounts/owner001/duplicateApprovals/approval001"),req=ref("accounts/owner001/duplicateRequests/request001");
const mref=ref("operatorMemberships/operator002");
const now=Date.now();
function setup(){
 docs.clear();
 docs.set(acct.key,{ownerUid:"owner001",creditWalletRemaining:4,reserved:0});
 docs.set(mref.key,{...membership});
}
const tx={writes:[],readCount:0,async get(x){this.readCount++;const d=docs.get(x.key);return {exists:d!==undefined,data:()=>d,id:x.id}}};
const bridge=createTenantTransactionGuards({db,HttpsError});
async function denied(fn,part){await assert.rejects(fn(),e=>e instanceof HttpsError&&e.message.includes(part));pass++}
let pass=0;
(async()=>{
 setup();
 let result=await bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec});
 assert.equal(result.accountId,"owner001");assert.equal(result.recordedBy,operator.actorUid);pass++;
 assert.equal(tx.writes.length,0);pass++;
 await denied(()=>bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:"attacker@example.com",accountRef:acct,recordRef:rec}),"MEMBERSHIP_REVOKED_OR_MISMATCH");
 docs.set(mref.key,{...membership,status:"revoked"});
 await denied(()=>bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec}),"MEMBERSHIP_REVOKED_OR_MISMATCH");
 setup();
 docs.set(rec.key,{status:"reserved",accountId:"owner001",recordedBy:"operator002"});
 await denied(()=>bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec}),"OPERATION_ALREADY_EXISTS");
 await bridge.beforeFinalize(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec,operationId:rec.id});pass++;
 await denied(()=>bridge.beforeFinalize(tx,{ctx:owner,accountRef:acct,recordRef:rec,operationId:rec.id}),"RECORDING_ACTOR_MISMATCH");
 docs.set(rec.key,{...docs.get(rec.key),recordedBy:"operator003"});
 await denied(()=>bridge.beforeFinalize(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec,operationId:rec.id}),"RECORDING_ACTOR_MISMATCH");
 setup();
 docs.set(appr.key,{status:"approved",accountId:"owner001",requestedBy:"operator002",requestId:req.id,barcode:"BAR123",expiresAtMs:now+10000});
 docs.set(req.key,{status:"approved",accountId:"owner001",requestedBy:"operator002",approvalId:appr.id,barcode:"BAR123"});
 result=await bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec,approvalRef:appr,requestRef:req,barcode:"BAR123",nowMs:now});
 assert.equal(result.approval.status,"approved");pass++;
 docs.set(appr.key,{...docs.get(appr.key),status:"consumed"});
 await denied(()=>bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec,approvalRef:appr,requestRef:req,barcode:"BAR123",nowMs:now}),"APPROVAL_NOT_AVAILABLE");
 docs.set(appr.key,{...docs.get(appr.key),status:"approved"});
 docs.set(req.key,{...docs.get(req.key),accountId:"other"});
 await denied(()=>bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec,approvalRef:appr,requestRef:req,barcode:"BAR123",nowMs:now}),"APPROVAL_TENANT_OR_ACTOR_MISMATCH");
 docs.set(req.key,{...docs.get(req.key),accountId:"owner001"});
 await denied(()=>bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec,approvalRef:appr,requestRef:req,barcode:"BAR123",nowMs:now+20000}),"APPROVAL_EXPIRED");
 await denied(()=>bridge.beforeReserve(tx,{ctx:operator,verifiedEmail:email,accountRef:acct,recordRef:rec,approvalRef:appr,barcode:"BAR123",nowMs:now}),"Approval and request");
 assert.equal(pass,13);
 console.log("PACKTOOK_TRANSACTION_BRIDGE_MOCK_CASES=13/13_PASS");
 console.log("PACKTOOK_TX_MEMBERSHIP_READ=INSIDE_TRANSACTION_MOCK");
 console.log("PACKTOOK_TX_WRITE_OPERATIONS=0");
 console.log("PACKTOOK_INDEX_INTEGRATION=NOT_WIRED");
 console.log("PACKTOOK_EMULATOR=NOT_EXECUTED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
})().catch(e=>{console.error("PACKTOOK_TRANSACTION_BRIDGE_MOCK=FAIL "+e.stack);process.exitCode=2});
