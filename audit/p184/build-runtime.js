"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process");
const dir=__dirname;
if(process.env.GCLOUD_PROJECT!=="demo-packtook-p184"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-p184")throw Error("P184_REFUSE_NON_DEMO_BUILD");
cp.execFileSync(process.execPath,[path.resolve(dir,"../p183/build-candidate.js")],{stdio:"inherit"});
const source=fs.readFileSync(path.resolve(dir,"../p183/.generated-index.js"),"utf8");
if(!source.includes("Explicit account owner required")||
 source.includes("if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});"))
 throw Error("P184_UNSAFE_GENERATED_BACKEND");
for(const f of ["ownerGrantVideoCredits","ownerUpdateCustomerExpiry",
 "ownerGetCustomerManageState","ownerGetCustomerAdjustmentHistory"]){
 if(source.includes("exports."+f+"="))throw Error("P184_RECOVERED_OWNER_IMPORT_BLOCK");
}
fs.writeFileSync(path.resolve(dir,"runtime/index.js"),source,{mode:0o600});
fs.copyFileSync(path.resolve(dir,"../../firestore.rules"),path.resolve(dir,"firestore.rules"));
console.log("P184_EXACT_PATCHED_FULL_BACKEND_RUNTIME=PASS");
console.log("P184_ROOT_RULES_COPIED_TO_DEMO_ONLY=PASS");
console.log("P184_RECOVERED_OWNER_IMPORTS=0");
console.log("P184_CANDIDATE_SHA256="+crypto.createHash("sha256").update(source).digest("hex"));
