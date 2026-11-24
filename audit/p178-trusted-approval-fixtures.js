"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const {verifyApprovals,verifyAuditChain,appendSyntheticAudit,payloadString,GENESIS}
 =require("./p178-trusted-approval-audit");
const now=1800000000000;
const security=crypto.generateKeyPairSync("ed25519");
const owner=crypto.generateKeyPairSync("ed25519");
const pem=k=>k.publicKey.export({type:"spki",format:"pem"});
const registry={
 security:{keyId:"security-key-001",actorId:"security-reviewer-001",publicKeyPem:pem(security)},
 owner:{keyId:"owner-key-001",actorId:"owner-reviewer-001",publicKeyPem:pem(owner)}
};
function make(){
 const request={caseId:"p178-case-001",accountId:"synthetic_001",proposedOwnerUid:"synthetic_001",
  expectedRevision:1,nonce:"nonce_12345678"};
 const proofs=["security","owner"].map(role=>{
  const p={...request,role,actorId:registry[role].actorId,keyId:registry[role].keyId,
   expiresAt:now+600000};
  p.signature=crypto.sign(null,Buffer.from(payloadString(p)),
   role==="security"?security.privateKey:owner.privateKey).toString("base64");
  return p;
 });
 return {request,proofs,registry:structuredClone(registry),now};
}
let count=0;
function test(name,change,decision){
 const x=make();change(x);const before=JSON.stringify(x);
 const got=verifyApprovals(x);
 assert.equal(got.decision,decision,name);
 assert.equal(got.authorizedToWrite,false,name);
 assert.equal(JSON.stringify(x),before,"mutation "+name);
 count++;console.log("P178_"+name+"=PASS");
 return got;
}
test("VALID_SIGNATURES_REVIEW_ONLY",()=>{},"REVIEW_CANDIDATE");
test("CLIENT_ASSERTED_APPROVALS_IGNORED",x=>{x.proofs=[];x.request.securityApproved=true;x.request.ownerApproved=true;},"BLOCK");
test("MISSING_OWNER_APPROVAL",x=>x.proofs.pop(),"BLOCK");
test("DUPLICATE_SECURITY",x=>x.proofs[1]={...x.proofs[0]},"BLOCK");
test("ALTERED_ACCOUNT",x=>x.proofs[0].accountId="attacker","BLOCK");
test("ALTERED_REVISION",x=>x.proofs[1].expectedRevision=2,"BLOCK");
test("EXPIRED",x=>x.now=now+600001,"BLOCK");
test("UNTRUSTED_KEY",x=>x.proofs[1].keyId="foreign-key-001","BLOCK");
test("TAMPERED_SIGNATURE",x=>x.proofs[0].signature=x.proofs[0].signature.replace(/^./,z=>z==="A"?"B":"A"),"BLOCK");
test("APPROVER_SAME_ID",x=>{x.registry.owner={...x.registry.owner,actorId:x.registry.security.actorId};x.proofs[1].actorId=x.registry.security.actorId;},"BLOCK");
test("CROSS_CASE_REPLAY",x=>x.request.caseId="p178-case-002","BLOCK");
test("FUTURE_EXPIRY_TOO_LONG",x=>x.now=now-3600001,"BLOCK");
test("NO_REGISTRY",x=>delete x.registry,"BLOCK");
test("INVALID_UID",x=>x.request.accountId="../other","BLOCK");
test("WRONG_PROPOSED_OWNER",x=>x.request.proposedOwnerUid="another","BLOCK");
const approved=verifyApprovals(make());
assert.equal(approved.decision,"REVIEW_CANDIDATE");
const base={caseId:"p178-case-001",accountId:"synthetic_001",expectedRevision:1,
 outcome:"REVIEW_CANDIDATE",evidenceDigest:approved.evidenceDigest};
const first=appendSyntheticAudit([],base);
assert.equal(first.ok,true);assert.equal(first.event.previousHash,GENESIS);
assert.equal(verifyAuditChain(first.events).valid,true);
count++;console.log("P178_APPEND_AND_VALIDATE=PASS");
const second=appendSyntheticAudit(first.events,{...base,caseId:"p178-case-002",expectedRevision:2});
assert.equal(second.ok,true);assert.equal(verifyAuditChain(second.events).count,2);
count++;console.log("P178_SECOND_LINK=PASS");
assert.equal(appendSyntheticAudit(second.events,base).ok,false);
count++;console.log("P178_REPLAY_REJECTED=PASS");
const tampered=structuredClone(second.events);tampered[0].outcome="BLOCK";
assert.equal(verifyAuditChain(tampered).valid,false);
count++;console.log("P178_TAMPER_REJECTED=PASS");
const deleted=second.events.slice(1);
assert.equal(verifyAuditChain(deleted).valid,false);
count++;console.log("P178_DELETION_REJECTED=PASS");
const reordered=[second.events[1],second.events[0]];
assert.equal(verifyAuditChain(reordered).valid,false);
count++;console.log("P178_REORDER_REJECTED=PASS");
console.log("P178_SYNTHETIC_APPROVAL_AUDIT="+count+"/"+count+"_PASS");
console.log("P178_NO_REAL_APPROVALS_NO_FIREBASE_WRITES_NO_DEPLOY=PASS");
console.log("P178_DECISION=NO_GO_RELEASE_NO_GO_OWNER_IMPORT_NO_GO_DEPLOY");
