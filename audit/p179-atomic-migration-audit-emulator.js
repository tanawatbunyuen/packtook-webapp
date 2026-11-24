"use strict";
// P179 isolated Firestore Emulator fixture only. NEVER import or deploy as a production migration handler.
// The synthetic keys, approvals and transactions below do NOT constitute real authorization.
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("./p177-emulator/node_modules/firebase-admin");
const {verifyApprovals,appendSyntheticAudit,verifyAuditChain,payloadString}=require("./p178-trusted-approval-audit");
const {inspectCas,DECISION}=require("./p176-owner-migration-cas");
const host=process.env.FIRESTORE_EMULATOR_HOST;
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!/^127\.0\.0\.1:\d+$/.test(host||"")||project!=="demo-packtook-p179")
 throw Error("P179_REFUSE_NON_DEMO_EMULATOR");
admin.initializeApp({projectId:project});
const db=admin.firestore();db.settings({host,ssl:false});
const accounts=db.collection("p179_demo_accounts");
const cases=db.collection("p179_demo_cases");
const ledger=db.collection("p179_demo_ledger").doc("head");
const NOW=1800000000000;
const kp={security:crypto.generateKeyPairSync("ed25519"),owner:crypto.generateKeyPairSync("ed25519")};
const registry=Object.fromEntries(["security","owner"].map(role=>[role,{
 actorId:role+"-reviewer-001",keyId:role+"-key-001",
 publicKeyPem:kp[role].publicKey.export({format:"pem",type:"spki"})}]));
function packageFor(accountId,caseId,expectedRevision=1){
 const request={caseId,accountId,expectedRevision,proposedOwnerUid:accountId,nonce:"nonce_"+caseId};
 const proofs=["security","owner"].map(role=>{
  const p={...request,role,actorId:registry[role].actorId,keyId:registry[role].keyId,expiresAt:NOW+600000};
  p.signature=crypto.sign(null,Buffer.from(payloadString(p)),kp[role].privateKey).toString("base64");
  return p;
 });
 const previewInput={accountId,authUid:accountId,ownerUid:null,
  accountExists:true,authUserExists:true,authEmailVerified:true,authUserDisabled:false,
  legacyFormatVerified:true,independentAccountProvenanceVerified:true,
  evidenceTicket:"P175-REVIEW-20261124",securityReviewerApproved:true,
  accountOwnerApproved:true,conflictingOwnershipEvidence:false};
 return {request,proofs,previewInput,operatorEvidence:{
  independentlyVerified:true,caseReference:"P176-REVIEW-20261124"}};
}
async function seed(accountId,ownerUid=null,revision=1){
 await accounts.doc(accountId).set({ownerUid,revision,fixtureOnly:true});
}
async function attempt(pkg,{inject=null}={}){
 const verified=verifyApprovals({request:pkg.request,proofs:pkg.proofs,registry,now:NOW});
 if(verified.decision!=="REVIEW_CANDIDATE")return "APPROVAL_BLOCK";
 return db.runTransaction(async tx=>{
  const accountRef=accounts.doc(pkg.request.accountId),caseRef=cases.doc(pkg.request.caseId);
  // Reads precede all writes for Firestore transaction compatibility.
  const [accountSnap,caseSnap,ledgerSnap]=await Promise.all([
   tx.get(accountRef),tx.get(caseRef),tx.get(ledger)]);
  if(!accountSnap.exists)return "MISSING_ACCOUNT";
  if(caseSnap.exists)return "REPLAY_BLOCK";
  const d=accountSnap.data(),latest={accountId:accountRef.id,ownerUid:d.ownerUid,revision:d.revision};
  const inspected=inspectCas({observed:{accountId:accountRef.id,
   ownerUid:pkg.previewInput.ownerUid,revision:pkg.request.expectedRevision},
   latest,previewInput:pkg.previewInput,operatorEvidence:pkg.operatorEvidence});
  if(inspected.decision!==DECISION.CANDIDATE_ONLY)return inspected.decision;
  const entries=ledgerSnap.exists?ledgerSnap.data().events:[];
  if(!verifyAuditChain(entries).valid)return "AUDIT_INTEGRITY_BLOCK";
  const proposal=appendSyntheticAudit(entries,{
   caseId:pkg.request.caseId,accountId:pkg.request.accountId,
   expectedRevision:pkg.request.expectedRevision,
   outcome:"REVIEW_CANDIDATE",evidenceDigest:verified.evidenceDigest});
  if(!proposal.ok)return "AUDIT_APPEND_BLOCK";
  if(inject==="BEFORE_WRITE")throw Error("P179_INJECT_BEFORE_WRITE");
  tx.update(accountRef,{ownerUid:pkg.request.accountId,revision:d.revision+1});
  tx.create(caseRef,{accountId:pkg.request.accountId,evidenceDigest:verified.evidenceDigest,
   fixtureOnly:true});
  tx.set(ledger,{events:proposal.events,head:proposal.event.hash,count:proposal.events.length,
   fixtureOnly:true});
  if(inject==="AFTER_STAGED_WRITES")throw Error("P179_INJECT_AFTER_STAGED_WRITES");
  return "ATOMIC_SIMULATED_COMMIT";
 });
}
async function readState(id,caseId){
 const [a,c,l]=await Promise.all([accounts.doc(id).get(),cases.doc(caseId).get(),ledger.get()]);
 return {account:a.exists?a.data():null,caseExists:c.exists,
  events:l.exists?l.data().events:[]};
}
async function reset(){
 const old=await ledger.get();if(old.exists)await ledger.delete();
}
let passed=0;
async function test(name,fn){await fn();passed++;console.log("P179_"+name+"=PASS");}
(async()=>{
 await reset();
 await test("ATOMIC_ACCOUNT_AND_AUDIT_COMMIT",async()=>{
  const id="p179_alpha",caseId="p179_case_0001";await seed(id);
  assert.equal(await attempt(packageFor(id,caseId)),"ATOMIC_SIMULATED_COMMIT");
  const s=await readState(id,caseId);
  assert.equal(s.account.ownerUid,id);assert.equal(s.account.revision,2);
  assert.equal(s.caseExists,true);assert.equal(s.events.length,1);
  assert.equal(verifyAuditChain(s.events).valid,true);
 });
 await test("REPLAY_CANNOT_DOUBLE_COMMIT",async()=>{
  const pkg=packageFor("p179_alpha","p179_case_0001");
  assert.equal(await attempt(pkg),"REPLAY_BLOCK");
  assert.equal((await ledger.get()).data().count,1);
 });
 await test("STALE_REVISION_BLOCKS",async()=>{
  const id="p179_stale",caseId="p179_case_0002";await seed(id,null,3);
  assert.equal(await attempt(packageFor(id,caseId,1)),DECISION.BLOCK);
  const s=await readState(id,caseId);assert.equal(s.caseExists,false);assert.equal(s.account.ownerUid,null);
 });
 await test("INVALID_SIGNATURE_BLOCKS_ALL_WRITES",async()=>{
  const id="p179_bad_signature",caseId="p179_case_0003";await seed(id);
  const p=packageFor(id,caseId);p.proofs[0].signature="invalid";
  assert.equal(await attempt(p),"APPROVAL_BLOCK");
  const s=await readState(id,caseId);assert.equal(s.account.ownerUid,null);assert.equal(s.caseExists,false);
 });
 await test("BEFORE_WRITE_THROW_ROLLS_BACK",async()=>{
  const id="p179_before_fail",caseId="p179_case_0004";await seed(id);
  await assert.rejects(attempt(packageFor(id,caseId),{inject:"BEFORE_WRITE"}),/P179_INJECT_BEFORE_WRITE/);
  const s=await readState(id,caseId);assert.equal(s.account.ownerUid,null);assert.equal(s.caseExists,false);
  assert.equal(s.events.length,1);
 });
 await test("AFTER_STAGING_THROW_ROLLS_BACK_ALL",async()=>{
  const id="p179_after_fail",caseId="p179_case_0005";await seed(id);
  await assert.rejects(attempt(packageFor(id,caseId),{inject:"AFTER_STAGED_WRITES"}),/P179_INJECT_AFTER_STAGED_WRITES/);
  const s=await readState(id,caseId);assert.equal(s.account.ownerUid,null);assert.equal(s.caseExists,false);
  assert.equal(s.events.length,1);
 });
 await test("CONCURRENT_WRITERS_AT_MOST_ONE",async()=>{
  const id="p179_race",a=packageFor(id,"p179_case_0006"),b=packageFor(id,"p179_case_0007");
  await seed(id);
  const settled=await Promise.allSettled([attempt(a),attempt(b)]);
  const wins=settled.filter(x=>x.status==="fulfilled"&&x.value==="ATOMIC_SIMULATED_COMMIT");
  assert.equal(wins.length,1,JSON.stringify(settled));
  const snap=(await accounts.doc(id).get()).data();assert.equal(snap.revision,2);
  assert.equal(snap.ownerUid,id);
  const cs=await Promise.all([cases.doc(a.request.caseId).get(),cases.doc(b.request.caseId).get()]);
  assert.equal(cs.filter(x=>x.exists).length,1);
  assert.equal((await ledger.get()).data().count,2);
 });
 await test("WRONG_OWNER_EXISTING_BLOCKED",async()=>{
  const id="p179_wrong_owner",caseId="p179_case_0008";await seed(id,"other_owner");
  assert.equal(await attempt(packageFor(id,caseId)),DECISION.BLOCK);
  assert.equal((await accounts.doc(id).get()).data().ownerUid,"other_owner");
  assert.equal((await cases.doc(caseId).get()).exists,false);
 });
 await test("MISSING_ACCOUNT_BLOCKED",async()=>{
  const caseId="p179_case_0009";
  assert.equal(await attempt(packageFor("p179_missing",caseId)),"MISSING_ACCOUNT");
  assert.equal((await cases.doc(caseId).get()).exists,false);
 });
 await test("TAMPERED_LEDGER_REFUSES_MIGRATION",async()=>{
  const doc=(await ledger.get()).data();
  await ledger.update({events:[{...doc.events[0],outcome:"BLOCK"},...doc.events.slice(1)]});
  const id="p179_tampered",caseId="p179_case_0010";await seed(id);
  assert.equal(await attempt(packageFor(id,caseId)),"AUDIT_INTEGRITY_BLOCK");
  assert.equal((await accounts.doc(id).get()).data().ownerUid,null);
  assert.equal((await cases.doc(caseId).get()).exists,false);
 });
 console.log("P179_DEMO_ATOMIC_TRANSACTION_CASES="+passed+"/"+passed+"_PASS");
 console.log("P179_PRODUCTION_WRITES=0 P179_DEPLOYS=0 P179_OWNER_IMPORTS=0");
 console.log("P179_DECISION=NO_GO_RELEASE_NO_GO_OWNER_IMPORT_NO_GO_DEPLOY");
 await admin.app().delete();
})().catch(async e=>{console.error("P179_FAILED",e);try{await admin.app().delete();}catch{}process.exitCode=1;});
