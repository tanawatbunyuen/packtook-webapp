"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {accountRoleCandidate,duplicateApprovalCandidate}=require("./p174-authz-guard-candidate");
const source=fs.readFileSync(path.join(__dirname,"../functions/index.js"));
const gitBlob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
assert.equal(gitBlob(source),"92262ea2fbbb941188937d72f0eea74a735d2bf3");
console.log("P174_PINNED_BACKEND_SOURCE=PASS");
const text=source.toString("utf8");
assert(text.includes('const role=ref.id===id?"admin":"operator";'));
assert(text.includes('return {role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false};'));
assert(text.includes('if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});'));
assert(text.includes('if(accountId!==uidValue)throw new HttpsError("permission-denied","Admin only")'));
console.log("P174_SOURCE_FINDINGS=4/4_CONFIRMED");
const uid="synthetic-a",other="synthetic-b";
const request=(id=uid,verified=true)=>({auth:{uid:id,token:{email_verified:verified}}});
const a=(owner)=>({exists:true,data:{ownerUid:owner}});
const c={exists:true,status:"completed"};
function deny(fn,code){assert.throws(fn,e=>e.code===code);}
const cases=[
 ["signed-out",()=>deny(()=>accountRoleCandidate({},a(uid)),"unauthenticated")],
 ["unverified",()=>deny(()=>accountRoleCandidate(request(uid,false),a(uid)),"permission-denied")],
 ["missing-account",()=>deny(()=>accountRoleCandidate(request(),null),"permission-denied")],
 ["missing-owner",()=>deny(()=>accountRoleCandidate(request(),a(undefined)),"permission-denied")],
 ["other-owner",()=>deny(()=>accountRoleCandidate(request(),a(other)),"permission-denied")],
 ["forged-owner-payload",()=>deny(()=>accountRoleCandidate({...request(),data:{ownerUid:uid,role:"admin"}},a(other)),"permission-denied")],
 ["owner-admin",()=>assert.equal(accountRoleCandidate(request(),a(uid)).role,"admin")],
 ["duplicate-unowned",()=>deny(()=>duplicateApprovalCandidate(request(),a(undefined),c),"permission-denied")],
 ["duplicate-other-owner",()=>deny(()=>duplicateApprovalCandidate(request(),a(other),c),"permission-denied")],
 ["duplicate-no-lock",()=>deny(()=>duplicateApprovalCandidate(request(),a(uid),null),"failed-precondition")],
 ["duplicate-incomplete",()=>deny(()=>duplicateApprovalCandidate(request(),a(uid),{exists:true,status:"reserved"}),"failed-precondition")],
 ["duplicate-owner-completed",()=>assert.equal(duplicateApprovalCandidate(request(),a(uid),c).approvedBy,uid)]
];
for(const [name,fn] of cases){fn();console.log("P174_CASE_"+name.toUpperCase().replaceAll("-","_")+"=PASS");}
console.log("P174_AUTHZ_OFFLINE_CASES=12/12_PASS");
console.log("P174_NO_PRODUCTION_PATCH=TRUE");
console.log("P174_DECISION=NO_GO_CANDIDATE_ONLY");
