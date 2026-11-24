"use strict";
// P188 — generate ONLY an isolated exact-source G02 release-candidate artifact.
// Never change functions/index.js or any production configuration.
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const dir=__dirname;
if(process.env.GCLOUD_PROJECT!=="demo-packtook-p184"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-p184")
 throw Error("P188_REQUIRES_ISOLATED_DEMO_PROJECT");
cp.execFileSync(process.execPath,[path.resolve(dir,"../p183/build-candidate.js")],{stdio:"inherit"});
let source=fs.readFileSync(path.resolve(dir,"../p183/.generated-index.js"),"utf8");
const changes=[
 ['const {FieldValue}=admin.firestore;','const {FieldValue}=require("firebase-admin/firestore");'],
 ['ref.create({plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})',
  'ref.create({ownerUid:id,plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})']
];
for(const [from,to] of changes){
 if(source.split(from).length!==2)throw Error("P188_UNEXPECTED_PATCH_CONTEXT");
 source=source.replace(from,to);
}
if(source.includes('if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});')||
 source.includes('const role=ref.id===id?"admin":"operator";')||
 source.includes('const {FieldValue}=admin.firestore;'))
 throw Error("P188_G02_UNSAFE_LEGACY_LOGIC");
for(const fn of ["ownerGrantVideoCredits","ownerUpdateCustomerExpiry",
"ownerGetCustomerManageState","ownerGetCustomerAdjustmentHistory"]){
 if(source.includes("exports."+fn+"="))throw Error("P188_RECOVERED_OWNER_IMPORT_DISALLOWED");
}
fs.writeFileSync(path.join(dir,"candidate-index.js"),source,{mode:0o600});
console.log("P188_G02_PINNED_RELEASE_CANDIDATE_GENERATED=PASS");
console.log("P188_NEW_ACCOUNT_OWNER_ONLY_ON_CREATE=PASS");
console.log("P188_LEGACY_OWNER_AUTOBACKFILL=DENIED");
console.log("P188_CANDIDATE_SHA256="+crypto.createHash("sha256").update(source).digest("hex"));
