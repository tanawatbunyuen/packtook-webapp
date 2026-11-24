"use strict";
// P177 isolated demo-only Firestore Emulator harness: never import functions/index.js or deploy.
const assert=require("node:assert/strict");
const admin=require("./p177-emulator/node_modules/firebase-admin");
const {inspectCas,DECISION}=require("./p176-owner-migration-cas");
const host=process.env.FIRESTORE_EMULATOR_HOST;
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!/^127\.0\.0\.1:\d+$/.test(host||"")||project!=="demo-packtook-p177"){
 throw Error("P177_EMULATOR_ONLY_GATE: refusing non-local target");
}
admin.initializeApp({projectId:project});
const db=admin.firestore();
db.settings({host,ssl:false});
const root=db.collection("p177_synthetic_accounts");
const make=(accountId="p177_synthetic_001")=>({
 previewInput:{accountId,authUid:accountId,ownerUid:null,
 accountExists:true,authUserExists:true,authEmailVerified:true,authUserDisabled:false,
 legacyFormatVerified:true,independentAccountProvenanceVerified:true,
 evidenceTicket:"P175-REVIEW-20261124",securityReviewerApproved:true,
 accountOwnerApproved:true,conflictingOwnershipEvidence:false},
 operatorEvidence:{independentlyVerified:true,caseReference:"P176-REVIEW-20261124"}
});
async function seed(id,ownerUid=null,revision=1){
 const ref=root.doc(id);await ref.set({ownerUid,revision,marker:"synthetic-test"});
 return ref;
}
// TEST HARNESS ONLY. This is NOT an authorized owner migration operation.
// Deliberately does not use this function outside isolated demo emulator.
async function simulateTransaction(ref,request,barrier=async()=>{}){
 const {previewInput,operatorEvidence,expectedRevision}=request;
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists)return "MISSING";
  const data=snap.data();
  const snapshot={accountId:ref.id,ownerUid:data.ownerUid,revision:data.revision};
  const observed={...snapshot,revision:expectedRevision};
  const result=inspectCas({previewInput,operatorEvidence,observed,latest:snapshot});
  if(result.decision!==DECISION.CANDIDATE_ONLY)return result.decision;
  // Gate is an intentionally synthetic transaction fixture, NOT a production authorization.
  if(previewInput.authUid!==ref.id)return "BLOCK";
  await barrier();
  tx.update(ref,{ownerUid:result.proposedOwnerUid,revision:data.revision+1});
  return "SIMULATED_COMMIT";
 });
}
(async()=>{
 let count=0;
 const test=async(name,fn)=>{await fn();count++;console.log("P177_"+name+"=PASS");};
 await test("SINGLE_DEMO_TRANSACTION",async()=>{
  const id="p177_single",ref=await seed(id),r=make(id);
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:1}),"SIMULATED_COMMIT");
  const x=(await ref.get()).data();assert.equal(x.ownerUid,id);assert.equal(x.revision,2);
 });
 await test("STALE_REVISION_REJECTED",async()=>{
  const id="p177_stale",ref=await seed(id),r=make(id);
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:0}),DECISION.BLOCK);
  assert.equal((await ref.get()).data().ownerUid,null);
 });
 await test("EXISTING_OWNER_UNCHANGED",async()=>{
  const id="p177_existing",ref=await seed(id,id),r=make(id);
  r.previewInput.ownerUid=id;
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:1}),DECISION.NO_CHANGE);
  assert.equal((await ref.get()).data().revision,1);
 });
 await test("FOREIGN_OWNER_BLOCKED",async()=>{
  const id="p177_foreign",ref=await seed(id,"other_user"),r=make(id);
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:1}),DECISION.BLOCK);
 });
 await test("IDENTITY_SWAP_BLOCKED",async()=>{
  const id="p177_swap",ref=await seed(id),r=make("other_user");
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:1}),DECISION.BLOCK);
  assert.equal((await ref.get()).data().ownerUid,null);
 });
 await test("MISSING_APPROVAL_REJECTED",async()=>{
  const id="p177_no_approval",ref=await seed(id),r=make(id);
  r.previewInput.securityReviewerApproved=false;
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:1}),DECISION.REVIEW);
 });
 await test("DISABLED_USER_BLOCKED",async()=>{
  const id="p177_disabled",ref=await seed(id),r=make(id);
  r.previewInput.authUserDisabled=true;
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:1}),DECISION.BLOCK);
 });
 await test("MISSING_DOCUMENT_REJECTED",async()=>{
  const id="p177_missing",ref=root.doc(id),r=make(id);
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:1}),"MISSING");
 });
 await test("CONCURRENT_SAME_REVISION_ONLY_ONE_COMMIT",async()=>{
  const id="p177_race",ref=await seed(id),r=make(id);
  const outcomes=await Promise.all([simulateTransaction(ref,{...r,expectedRevision:1}),simulateTransaction(ref,{...r,expectedRevision:1})]);
  assert.equal(outcomes.filter(x=>x==="SIMULATED_COMMIT").length,1,JSON.stringify(outcomes));
  assert.equal(outcomes.filter(x=>x!== "SIMULATED_COMMIT").length,1);
  const data=(await ref.get()).data();
  assert.equal(data.ownerUid,id);assert.equal(data.revision,2);
 });
 await test("REPLAY_IDEMPOTENT",async()=>{
  const id="p177_replay",ref=await seed(id),r=make(id);
  await simulateTransaction(ref,{...r,expectedRevision:1});
  assert.equal(await simulateTransaction(ref,{...r,expectedRevision:1}),DECISION.BLOCK);
  assert.equal((await ref.get()).data().revision,2);
 });
 console.log("P177_FIRESTORE_EMULATOR="+count+"/"+count+"_PASS");
 console.log("P177_SCOPE=DEMO_ONLY_SYNTHETIC_TEST_WRITES");
 console.log("P177_RELEASE=NO_GO_RELEASE_NO_GO_OWNER_IMPORT_NO_GO_DEPLOY");
 await admin.app().delete();
})().catch(async e=>{console.error("P177_FAILED",e);try{await admin.app().delete();}catch{}process.exitCode=1;});
