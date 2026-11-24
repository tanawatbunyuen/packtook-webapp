"use strict";
// REVIEW ONLY. Generate an isolated exact-backend G02 candidate from pinned source.
// Never replace functions/index.js, deploy, import an Owner recovery source, or modify production.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const base=path.resolve(__dirname,"../../functions/index.js");
const output=path.resolve(__dirname,".generated-index.js");
const original=fs.readFileSync(base);
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
if(blob(original)!=="92262ea2fbbb941188937d72f0eea74a735d2bf3")
 throw Error("P183_BACKEND_SOURCE_DRIFT");
let content=original.toString("utf8");
const changes=[
 [
  'async function assertAdmin(uidValue){const accountId=await accountIdFor(uidValue);if(accountId!==uidValue)throw new HttpsError("permission-denied","Admin only");return accountId}',
  'async function assertAdmin(uidValue){const ref=own(uidValue),snap=await ref.get();if(!snap.exists||snap.data().ownerUid!==uidValue)throw new HttpsError("permission-denied","Explicit account owner required");return uidValue}'
 ],
 [
  'const acc=await ensureAccount(accountId),lock=acc.collection("barcodeLocks").doc(barcodeKey(barcode));',
  'const acc=own(accountId),lock=acc.collection("barcodeLocks").doc(barcodeKey(barcode));'
 ],
 [
  '  if(!lSnap.exists||lSnap.data().status!=="completed")throw new HttpsError("failed-precondition","No completed video for barcode");\n  const a=aSnap.data();\n  // Account currently has a single Firebase user; separate employee roles are not yet implemented.\n  if(acc.id!==accountId||a.ownerUid&&a.ownerUid!==accountId)throw new HttpsError("permission-denied","Owner approval required");\n  if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});',
  '  if(!aSnap.exists||aSnap.data().ownerUid!==accountId)throw new HttpsError("permission-denied","Explicit account owner required");\n  if(!lSnap.exists||lSnap.data().status!=="completed")throw new HttpsError("failed-precondition","No completed video for barcode");'
 ],
 [
  ' const id=uid(req),ref=await ensureAccount(id),snap=await ref.get(),a=snap.data();\n const role=ref.id===id?"admin":"operator";\n return {role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false};',
  ' const id=uid(req),ref=own(id),snap=await ref.get();\n if(!snap.exists||snap.data().ownerUid!==id)throw new HttpsError("permission-denied","Explicit account owner required");\n return {role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false};'
 ]
];
for(const [from,to] of changes){
 const n=content.split(from).length-1;
 if(n!==1)throw Error("P183_UNEXPECTED_PATCH_CONTEXT_MATCHES="+n);
 content=content.replace(from,to);
}
if(content.includes("if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});")||
   content.includes('const role=ref.id===id?"admin":"operator";')||
   content.includes("if(accountId!==uidValue)throw new HttpsError"))
 throw Error("P183_UNSAFE_LEGACY_AUTH_REMAINS");
fs.writeFileSync(output,content,{mode:0o600});
console.log("P183_FULL_BACKEND_CANDIDATE_GENERATED=PASS");
console.log("P183_PATCHED_BLOCKS=4/4");
console.log("P183_ORIGINAL_BACKEND_UNMODIFIED=PASS");
console.log("P183_CANDIDATE_SHA256="+crypto.createHash("sha256").update(content).digest("hex"));
