"use strict";
const assert=require("node:assert/strict");
const {inspectCas,DECISION}=require("./p176-owner-migration-cas");
const good=()=>({
 previewInput:{accountId:"synthetic-owner",authUid:"synthetic-owner",ownerUid:null,
 accountExists:true,authUserExists:true,authEmailVerified:true,authUserDisabled:false,
 legacyFormatVerified:true,independentAccountProvenanceVerified:true,
 evidenceTicket:"P175-REVIEW-20261124",securityReviewerApproved:true,
 accountOwnerApproved:true,conflictingOwnershipEvidence:false},
 observed:{accountId:"synthetic-owner",ownerUid:null,revision:2},
 latest:{accountId:"synthetic-owner",ownerUid:null,revision:2},
 operatorEvidence:{independentlyVerified:true,caseReference:"P176-REVIEW-20261124"}
});
const cases=[
 ["valid-preview",x=>{},DECISION.CANDIDATE_ONLY],
 ["missing-original",x=>delete x.observed,DECISION.BLOCK],
 ["missing-latest",x=>delete x.latest,DECISION.BLOCK],
 ["revision-race",x=>x.latest.revision=3,DECISION.BLOCK],
 ["owner-claimed-concurrently",x=>x.latest.ownerUid="another",DECISION.BLOCK],
 ["account-swapped",x=>x.latest.accountId="other",DECISION.BLOCK],
 ["preview-mismatched-owner",x=>x.previewInput.ownerUid="synthetic-owner",DECISION.BLOCK],
 ["preview-mismatched-account",x=>x.previewInput.accountId="another",DECISION.BLOCK],
 ["invalid-revision",x=>x.latest.revision=-1,DECISION.BLOCK],
 ["operator-not-verified",x=>x.operatorEvidence.independentlyVerified=false,DECISION.REVIEW],
 ["no-operator-ticket",x=>delete x.operatorEvidence.caseReference,DECISION.REVIEW],
 ["auth-user-disabled",x=>x.previewInput.authUserDisabled=true,DECISION.BLOCK],
 ["conflicted-provenance",x=>x.previewInput.conflictingOwnershipEvidence=true,DECISION.BLOCK],
 ["missing-security-approval",x=>x.previewInput.securityReviewerApproved=false,DECISION.REVIEW],
 ["existing-matching-owner",x=>{x.observed.ownerUid="synthetic-owner";x.latest.ownerUid="synthetic-owner";x.previewInput.ownerUid="synthetic-owner";},DECISION.NO_CHANGE]
];
for(const [name,change,expected] of cases){
 const input=good();change(input);const prior=JSON.stringify(input);
 const outcome=inspectCas(input);
 assert.equal(outcome.decision,expected,name);
 assert.equal(outcome.authorizedToWrite,false,name);
 assert.equal(JSON.stringify(input),prior,"input mutated "+name);
 if(outcome.decision===DECISION.CANDIDATE_ONLY)assert.equal(outcome.previewOnly,true);
 console.log("P176_"+name.toUpperCase().replaceAll("-","_")+"=PASS");
}
console.log("P176_SYNTHETIC_CAS_FIXTURES=15/15_PASS");
console.log("P176_NO_EMULATOR_NO_DATABASE_WRITES_NO_DEPLOY=PASS");
console.log("P176_DECISION=NO_GO_RELEASE_NO_GO_OWNER_IMPORT_NO_GO_DEPLOY");
