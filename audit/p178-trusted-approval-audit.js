"use strict";
// P178 pure offline verification boundary. Trusted keys must come from a separate pinned operator registry.
// This module never imports Firebase, makes network calls, or authorizes a migration.
const crypto=require("node:crypto");
const asText=x=>typeof x==="string"&&x.length>0;
const uid=x=>asText(x)&&/^[a-zA-Z0-9_-]{1,128}$/.test(x);
const id=x=>asText(x)&&/^[A-Za-z0-9_-]{8,100}$/.test(x);
const HEX64=/^[0-9a-f]{64}$/;
function payloadString(p){
 return JSON.stringify(["PACKTOOK_P178_APPROVAL_V1",p.caseId,p.accountId,p.expectedRevision,
 p.proposedOwnerUid,p.nonce,p.expiresAt,p.role,p.actorId,p.keyId]);
}
function verifyApprovals({request,proofs,registry,now}={}){
 const blocked=reason=>({decision:"BLOCK",reason,authorizedToWrite:false});
 if(!request||!uid(request.accountId)||!id(request.caseId)||!id(request.nonce)||
 !uid(request.proposedOwnerUid)||request.proposedOwnerUid!==request.accountId||
 !Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0||
 !Number.isSafeInteger(now)||now<0)return blocked("INVALID_REQUEST");
 if(!Array.isArray(proofs)||proofs.length!==2||!registry||typeof registry!=="object")
  return blocked("MISSING_TRUSTED_APPROVALS");
 const actors=new Set(),keys=new Set();
 for(const role of ["security","owner"]){
  const matches=proofs.filter(p=>p&&p.role===role);
  if(matches.length!==1)return blocked("ROLE_REQUIRED_ONCE");
  const p=matches[0],trusted=registry[role];
  if(!trusted||!asText(trusted.keyId)||!asText(trusted.publicKeyPem)||
     !asText(trusted.actorId)||p.keyId!==trusted.keyId||p.actorId!==trusted.actorId)
   return blocked("UNTRUSTED_SIGNER");
  if(!id(p.actorId)||!id(p.keyId)||actors.has(p.actorId)||keys.has(p.keyId))
   return blocked("NON_INDEPENDENT_APPROVERS");
  actors.add(p.actorId);keys.add(p.keyId);
  if(p.caseId!==request.caseId||p.accountId!==request.accountId||
   p.expectedRevision!==request.expectedRevision||p.proposedOwnerUid!==request.proposedOwnerUid||
   p.nonce!==request.nonce||!Number.isSafeInteger(p.expiresAt)||
   p.expiresAt<=now||p.expiresAt>now+3600000)
   return blocked("SCOPE_OR_EXPIRY_MISMATCH");
  if(!asText(p.signature)||!/^[A-Za-z0-9+/]+={0,2}$/.test(p.signature))
   return blocked("INVALID_SIGNATURE_ENCODING");
  try{
   if(!crypto.verify(null,Buffer.from(payloadString(p)),trusted.publicKeyPem,
    Buffer.from(p.signature,"base64")))return blocked("INVALID_SIGNATURE");
  }catch{return blocked("INVALID_SIGNATURE");}
 }
 return {decision:"REVIEW_CANDIDATE",reason:"OFFLINE_SIGNATURES_VALID_ONLY",
   authorizedToWrite:false,previewOnly:true,accountId:request.accountId,
   evidenceDigest:crypto.createHash("sha256").update(JSON.stringify(
     proofs.map(p=>[p.role,p.actorId,p.keyId,p.signature]).sort((a,b)=>a[0].localeCompare(b[0])))).digest("hex")};
}
const GENESIS="0".repeat(64);
function eventHash(event){
 return crypto.createHash("sha256").update(JSON.stringify([
 "PACKTOOK_P178_AUDIT_V1",event.sequence,event.previousHash,event.caseId,
 event.accountId,event.expectedRevision,event.outcome,event.evidenceDigest
 ])).digest("hex");
}
function verifyAuditChain(events){
 if(!Array.isArray(events))return {valid:false,reason:"NOT_AN_ARRAY"};
 let previous=GENESIS;
 const cases=new Set();
 for(let i=0;i<events.length;i++){
  const e=events[i];
  if(!e||e.sequence!==i+1||e.previousHash!==previous||
   !id(e.caseId)||!uid(e.accountId)||
   !Number.isSafeInteger(e.expectedRevision)||e.expectedRevision<0||
   !["REVIEW_CANDIDATE","BLOCK","NO_CHANGE"].includes(e.outcome)||
   !asText(e.evidenceDigest)||!HEX64.test(e.evidenceDigest)||
   !asText(e.hash)||!HEX64.test(e.hash)||e.hash!==eventHash(e)||
   cases.has(e.caseId))return {valid:false,reason:"CHAIN_INTEGRITY_OR_REPLAY"};
  cases.add(e.caseId);previous=e.hash;
 }
 return {valid:true,head:previous,count:events.length};
}
function appendSyntheticAudit(existing,record){
 const current=verifyAuditChain(existing);
 if(!current.valid||!record||!id(record.caseId)||existing.some(e=>e.caseId===record.caseId))
  return {ok:false,reason:"INVALID_CHAIN_OR_REPLAY"};
 const event={sequence:existing.length+1,previousHash:current.head,
  caseId:record.caseId,accountId:record.accountId,
  expectedRevision:record.expectedRevision,outcome:record.outcome,evidenceDigest:record.evidenceDigest};
 event.hash=eventHash(event);
 const next=[...existing,event];
 return verifyAuditChain(next).valid?{ok:true,events:next,event}:{ok:false,reason:"INVALID_EVENT"};
}
module.exports={verifyApprovals,verifyAuditChain,appendSyntheticAudit,payloadString,GENESIS};
