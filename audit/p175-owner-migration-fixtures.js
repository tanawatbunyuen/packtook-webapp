"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),crypto=require("node:crypto"),path=require("node:path");
const {STATES,previewOwnerMigration}=require("./p175-owner-migration-preview");
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const backend=fs.readFileSync(path.join(__dirname,"../functions/index.js"));
assert.equal(blob(backend),"92262ea2fbbb941188937d72f0eea74a735d2bf3");
assert(backend.includes('if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});'));
console.log("P175_BACKEND_ORIGINAL_PIN_AND_BOOTSTRAP_FINDING=PASS");
const good=()=>({
 accountId:"synthetic-user-001",authUid:"synthetic-user-001",accountExists:true,authUserExists:true,
 authEmailVerified:true,authUserDisabled:false,legacyFormatVerified:true,
 independentAccountProvenanceVerified:true,
 evidenceTicket:"P175-REVIEW-20261124",securityReviewerApproved:true,accountOwnerApproved:true,
 conflictingOwnershipEvidence:false
});
const cases=[
 ["unknown-account",x=>x.accountExists=false,STATES.BLOCK],
 ["invalid-account-id",x=>x.accountId="../escape",STATES.BLOCK],
 ["auth-id-mismatch",x=>x.authUid="synthetic-attacker",STATES.BLOCK],
 ["missing-auth-user",x=>x.authUserExists=false,STATES.BLOCK],
 ["unverified-email",x=>x.authEmailVerified=false,STATES.BLOCK],
 ["disabled-user",x=>x.authUserDisabled=true,STATES.BLOCK],
 ["unknown-disabled-state",x=>delete x.authUserDisabled,STATES.BLOCK],
 ["conflicting-ownership",x=>x.conflictingOwnershipEvidence=true,STATES.BLOCK],
 ["unknown-conflict-state",x=>delete x.conflictingOwnershipEvidence,STATES.BLOCK],
 ["unreviewed-legacy-format",x=>x.legacyFormatVerified=false,STATES.MANUAL_REVIEW],
 ["unknown-account-provenance",x=>x.independentAccountProvenanceVerified=false,STATES.MANUAL_REVIEW],
 ["missing-evidence-ticket",x=>delete x.evidenceTicket,STATES.MANUAL_REVIEW],
 ["security-approval-missing",x=>x.securityReviewerApproved=false,STATES.MANUAL_REVIEW],
 ["account-approval-missing",x=>x.accountOwnerApproved=false,STATES.MANUAL_REVIEW],
 ["existing-owner-matches",x=>x.ownerUid=x.accountId,STATES.NO_CHANGE],
 ["existing-owner-conflicts",x=>x.ownerUid="different-owner",STATES.BLOCK],
 ["malformed-existing-owner",x=>x.ownerUid="../../s",STATES.BLOCK],
 ["false-client-owner-payload",x=>{x.authUid="attacker";x.clientData={ownerUid:x.accountId,role:"admin"};},STATES.BLOCK],
 ["valid-evidence-preview-only",x=>{},STATES.REVIEW_CANDIDATE],
 ["wrong-ticket-format",x=>x.evidenceTicket="approved",STATES.MANUAL_REVIEW]
];
for(const [name,change,want] of cases){
 const input=good();change(input);
 const before=JSON.stringify(input);
 const actual=previewOwnerMigration(input);
 assert.equal(actual.state,want,name);assert.equal(JSON.stringify(input),before,"mutation:"+name);
 if(want===STATES.REVIEW_CANDIDATE){
  assert.equal(actual.previewOnly,true);assert.equal(actual.authorizedToWrite,false);
  assert.equal(actual.proposedOwnerUid,input.authUid);
 }
 console.log("P175_CASE_"+name.replaceAll("-","_").toUpperCase()+"=PASS");
}
console.log("P175_OFFLINE_MIGRATION_CASES=20/20_PASS");
console.log("P175_PRODUCTION_WRITES=0 P175_DEPLOYS=0 P175_OWNER_IMPORTS=0");
console.log("P175_DECISION=PREVIEW_CANDIDATE_ONLY_NO_GO");
