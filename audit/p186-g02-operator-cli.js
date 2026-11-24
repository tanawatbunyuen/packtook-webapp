"use strict";
// P186 operator-invoked read-only account inventory; never run in CI on live projects.
// Prints aggregate counts only; no user IDs, emails, keys or auth tokens.
const {validateGate}=require("./p186-g02-operator-gate");
const {inventory}=require("./p185-legacy-inventory");
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{
 const m=/^--([a-z-]+)=(.+)$/.exec(s);if(!m)throw Error("P186_UNKNOWN_ARGUMENT");
 return [m[1],m[2]];
}));
if(Object.keys(opts).some(x=>!["project","ack","max-docs","page-size"].includes(x)))
 throw Error("P186_UNKNOWN_OPTION");
const gate=validateGate({project:opts.project,ack:opts.ack,env:process.env});
if(!gate.allowed){console.error("P186_DENIED="+gate.reason);process.exit(3);}
const maxDocs=Number(opts["max-docs"]??1000),pageSize=Number(opts["page-size"]??50);
if(!Number.isSafeInteger(maxDocs)||maxDocs<1||maxDocs>10000||
 !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>500)
 throw Error("P186_INVALID_BOUNDS");
// Only after all safety checks are complete do we load the Firebase Admin SDK.
const admin=require("./p177-emulator/node_modules/firebase-admin");
admin.initializeApp({projectId:gate.project});
const db=admin.firestore(),auth=admin.auth();
const accounts=db.collection("accounts");
const listAccounts=async(after,limit)=>{
 let q=accounts.orderBy(admin.firestore.FieldPath.documentId()).limit(limit);
 if(after)q=q.startAfter(after);
 const snap=await q.get();
 return snap.docs.map(d=>({id:d.id,data:{ownerUid:d.get("ownerUid")}}));
};
const lookupUser=async uid=>{
 try{const u=await auth.getUser(uid);
  return {exists:true,disabled:u.disabled,emailVerified:u.emailVerified};
 }catch(e){
  if(e?.code==="auth/user-not-found")return {exists:false};
  throw e;
 }
};
(async()=>{
 try{
  const r=await inventory({listAccounts,lookupUser,maxDocs,pageSize});
  // Fingerprint is derived from account IDs and must not be distributed.
  delete r.inventoryFingerprint;
  // Snapshot time and scope, with no record-level fields.
  const safe={...r,project:gate.project,scope:gate.mode,
   source:"FIRESTORE_AND_AUTH_READ_ONLY_OPERATOR",attestedByCI:false,
   note:"Owner provenance is NOT established; manual independent evidence required"};
  console.log("P186_AGGREGATE_REPORT="+JSON.stringify(safe));
  console.log("P186_NO_MIGRATION_NO_APPROVAL_NO_WRITE=TRUE");
  if(!r.complete){console.error("P186_INCOMPLETE_INVENTORY_BOUNDED_SCAN");process.exitCode=2;}
 }catch(e){
  console.error("P186_OPERATOR_SCAN_FAILED="+String(e.code||e.name||"ERROR"));
  process.exitCode=1;
 }finally{await admin.app().delete();}
})();
