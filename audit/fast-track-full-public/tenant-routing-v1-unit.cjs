"use strict";
const assert=require("node:assert/strict");
const {emailDigest}=require("../../functions/operator-domain-v1.cjs");
const {createTenantResolver}=require("../../functions/tenant-routing-v1.cjs");
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const owners={
 owner001:{plan:"Free",ownerUid:"owner001"},
 otherowner:{plan:"Free",ownerUid:"otherowner"},
 invalidown:{plan:"Free",ownerUid:"otherowner"}
};
const members={
 operator002:{uid:"operator002",accountId:"owner001",status:"active",role:"operator",emailHash:emailDigest("operator@example.com")},
 revoked003:{uid:"revoked003",accountId:"owner001",status:"revoked",role:"operator",emailHash:emailDigest("revoked@example.com")},
 otheroperator:{uid:"otheroperator",accountId:"otherowner",status:"active",role:"operator",emailHash:emailDigest("other@example.com")},
 badowner:{uid:"badowner",accountId:"invalidown",status:"active",role:"operator",emailHash:emailDigest("bad@example.com")},
};
const db={collection(name){assert.ok(["accounts","operatorMemberships"].includes(name));return {doc(id){
 return {id,async get(){const item=name==="accounts"?owners[id]:members[id];return {exists:!!item,data:()=>item}}}
}}}};
const r=createTenantResolver({db,HttpsError});
function req(uid,email,verified=true){return {auth:{uid,token:{email,email_verified:verified}}}}
async function denied(promise,code){await assert.rejects(promise,x=>x instanceof HttpsError&&x.code===code)}
(async()=>{
 const a=await r.resolve(req("owner001","owner@example.com"));
 assert.equal(a.role,"admin");assert.equal(a.accountId,"owner001");
 const o=await r.resolve(req("operator002","operator@example.com"));
 assert.equal(o.role,"operator");assert.equal(o.accountId,"owner001");
 await denied(r.resolve(req("operator002","operator@example.com"),{ownerOnly:true}),"permission-denied");
 await denied(r.resolve(req("operator002","operator@example.com"),{allowOperator:false}),"permission-denied");
 await denied(r.resolve(req("revoked003","revoked@example.com")),"permission-denied");
 await denied(r.resolve(req("operator002","changed@example.com")),"permission-denied");
 await denied(r.resolve(req("badowner","bad@example.com")),"permission-denied");
 await denied(r.resolve(req("unknown","unknown@example.com")),"failed-precondition");
 await denied(r.resolve(req("operator002","operator@example.com",false)),"permission-denied");
 await denied(r.resolve({auth:null}),"unauthenticated");
 assert.equal((await r.resolve(req("otheroperator","other@example.com"))).accountId,"otherowner");
 assert.equal(r.requireReservationActor(o,{recordedBy:o.actorUid}),true);
 assert.throws(()=>r.requireReservationActor(o,{recordedBy:"otheroperator"}),x=>x.code==="permission-denied");
 assert.throws(()=>r.requireReservationActor(o,{}),x=>x.code==="permission-denied");
 assert.equal(r.requireReservationActor(a,{}),true);
 assert.throws(()=>r.requireReservationActor(a,{recordedBy:"operator002"}),x=>x.code==="permission-denied");
 assert.equal(r.requireBillingOwner(a),true);
 assert.throws(()=>r.requireBillingOwner(o),x=>x.code==="permission-denied");
 console.log("PACKTOOK_TENANT_ROUTING_OFFLINE=18/18_PASS");
 console.log("PACKTOOK_SHARED_CREDIT_INTEGRATION=NOT_WIRED");
 console.log("PACKTOOK_FIREBASE_REQUESTS=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
})().catch(e=>{console.error("PACKTOOK_TENANT_ROUTING_TEST=FAIL "+e.message);process.exitCode=2});
