"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const manifest=require("./evidence.json");
const old=fs.readFileSync(path.resolve(__dirname,"../../functions/index.js"),"utf8");
const now=fs.readFileSync(path.resolve(__dirname,"../p188/candidate-index.js"),"utf8");
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
function blob(s){
 const b=Buffer.from(s);
 return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
}
assert.equal(blob(old),manifest.sourcePins.originalFunctionsBlob);
assert.equal(sha(now),manifest.sourcePins.isolatedCandidateSha256);
const changes=[
 ['async function assertAdmin(uidValue){const accountId=await accountIdFor(uidValue);if(accountId!==uidValue)throw new HttpsError("permission-denied","Admin only");return accountId}',
  'async function assertAdmin(uidValue){const ref=own(uidValue),snap=await ref.get();if(!snap.exists||snap.data().ownerUid!==uidValue)throw new HttpsError("permission-denied","Explicit account owner required");return uidValue}'],
 ['const acc=await ensureAccount(accountId),lock=acc.collection("barcodeLocks").doc(barcodeKey(barcode));',
  'const acc=own(accountId),lock=acc.collection("barcodeLocks").doc(barcodeKey(barcode));'],
 ['  if(!lSnap.exists||lSnap.data().status!=="completed")throw new HttpsError("failed-precondition","No completed video for barcode");\n  const a=aSnap.data();\n  // Account currently has a single Firebase user; separate employee roles are not yet implemented.\n  if(acc.id!==accountId||a.ownerUid&&a.ownerUid!==accountId)throw new HttpsError("permission-denied","Owner approval required");\n  if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});',
  '  if(!aSnap.exists||aSnap.data().ownerUid!==accountId)throw new HttpsError("permission-denied","Explicit account owner required");\n  if(!lSnap.exists||lSnap.data().status!=="completed")throw new HttpsError("failed-precondition","No completed video for barcode");'],
 [' const id=uid(req),ref=await ensureAccount(id),snap=await ref.get(),a=snap.data();\n const role=ref.id===id?"admin":"operator";\n return {role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false};',
  ' const id=uid(req),ref=own(id),snap=await ref.get();\n if(!snap.exists||snap.data().ownerUid!==id)throw new HttpsError("permission-denied","Explicit account owner required");\n return {role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false};'],
 ['const {FieldValue}=admin.firestore;', 'const {FieldValue}=require("firebase-admin/firestore");'],
 ['ref.create({plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})',
  'ref.create({ownerUid:id,plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})']
];
function reconstruct(){
 let text=old;
 for(const [from,to] of changes){
  assert.equal(text.split(from).length-1,1,"P189_SOURCE_CONTEXT_DRIFT");
  text=text.replace(from,to);
 }
 return text;
}
function secure(source){
 const patterns=[
 'async function assertAdmin(uidValue){const ref=own(uidValue),snap=await ref.get();if(!snap.exists||snap.data().ownerUid!==uidValue)',
 'const acc=own(accountId),lock=acc.collection("barcodeLocks")',
 'if(!aSnap.exists||aSnap.data().ownerUid!==accountId)',
 'if(!snap.exists||snap.data().ownerUid!==id)',
 'const {FieldValue}=require("firebase-admin/firestore");',
 'ref.create({ownerUid:id,plan:"Free"'
 ];
 return patterns.every(p=>source.includes(p))&&
  !source.includes('if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});')&&
  !source.includes('const role=ref.id===id?"admin":"operator";')&&
  !["ownerGrantVideoCredits","ownerUpdateCustomerExpiry",
  "ownerGetCustomerManageState","ownerGetCustomerAdjustmentHistory"]
    .some(fn=>source.includes("exports."+fn+"="));
}
assert.equal(reconstruct(),now,"P189_UNREVIEWED_DIFF_DETECTED");
assert(secure(now),"P189_AUTHZ_INVARIANTS_FAILED");
console.log("P189_EXACT_SIX_EDIT_FULL_BACKEND_DIFF=PASS");
console.log("P189_PINNED_SOURCE_AND_CANDIDATE_HASHES=PASS");
const exp=Array.from(old.matchAll(/exports\.([A-Za-z0-9_]+)=(?:onCall|onRequest)\(/g),x=>x[1]);
const actual=Array.from(now.matchAll(/exports\.([A-Za-z0-9_]+)=(?:onCall|onRequest)\(/g),x=>x[1]);
assert.deepEqual(actual,exp,"P189_UNREVIEWED_EXPORTED_HANDLER_CHANGE");
console.log("P189_HANDLER_EXPORT_PARITY="+exp.length+"/"+exp.length+"_PASS");
let n=0;
for(const [name,altered] of [
 ["REMOVE_ADMIN_GUARD",now.replace('if(!snap.exists||snap.data().ownerUid!==uidValue)','if(false)')],
 ["REMOVE_DUPLICATE_OWNER_CHECK",now.replace('if(!aSnap.exists||aSnap.data().ownerUid!==accountId)','if(false)')],
 ["RESTORE_LEGACY_AUTOBACKFILL",now.replace('  tx.create(approval,','  if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});\n  tx.create(approval,')],
 ["REMOVE_NEW_ACCOUNT_OWNER",now.replace('ref.create({ownerUid:id,plan:"Free"','ref.create({plan:"Free"')],
 ["RESTORE_BAD_FIELDVALUE",now.replace('const {FieldValue}=require("firebase-admin/firestore");','const {FieldValue}=admin.firestore;')],
 ["IMPORT_RECOVERED_OWNER",now+'\nexports.ownerGrantVideoCredits=onCall(options,async()=>{});']
 ]){
 assert.notEqual(altered,now,name+" mutation not applied");
 assert.equal(secure(altered),false,"P189_SECURITY_MUTATION_SURVIVED_"+name);
 n++;
 console.log("P189_MUTATION_"+name+"=REJECTED");
}
console.log("P189_NEGATIVE_SECURITY_MUTATIONS="+n+"/"+n+"_REJECTED");
const statuses=manifest.checks.map(c=>c.status);
assert.equal(manifest.checks.length,8);
assert.equal(statuses.filter(x=>x==="PASS").length,4);
assert.equal(statuses.filter(x=>x==="NOT_VERIFIED").length,4);
assert.equal(manifest.g02Decision,"NO_GO");
assert.equal(manifest.releaseDecision,"NO_GO_RELEASE");
assert.equal(manifest.deployDecision,"NO_GO_DEPLOY");
assert.equal(manifest.publicSignup,"KEEP_CLOSED");
assert.equal(manifest.productionReads,0);
assert.equal(manifest.productionWrites,0);
assert.equal(manifest.ownerImports,0);
console.log("P189_EVIDENCE_COVERAGE=4/8_REVIEW_TRACKS_PASSED");
console.log("P189_LIVE_AND_SECURITY_SIGNOFF_TRACKS=4/8_NOT_VERIFIED");
console.log("P189_G02=NO_GO");
console.log("P189_PRODUCTION_READS=0 PRODUCTION_WRITES=0 DEPLOY=0");
