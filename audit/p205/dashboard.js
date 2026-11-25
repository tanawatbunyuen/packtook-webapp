"use strict";
/** P205 OFFLINE evidence gap dashboard, never autonomously verifies identity,
 * endorses source artifacts or releases G02. Uses P204 fail-closed intake.
 */
const {intake}=require("../p204/intake");
const {REQUIREMENTS,EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {BUILD,REVISION}=require("../p198/verify");
const {REQUIREMENT_ORDER}=require("../p203/handoff");
const owners={
 STAGING_LEGACY_INVENTORY:"Authorized Staging Cloud Operator",
 PROD_LEGACY_INVENTORY:"Separately authorized Production Cloud Operator",
 STAGING_VALID_APPCHECK:"Authorized Staging App Check Operator",
 OWNER_PROVENANCE_REMEDIATION:"Independent Security Reviewer",
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:"Independent Security Reviewer"
};
const nextActions={
 STAGING_LEGACY_INVENTORY:"Collect bounded complete read-only Staging Auth/Firestore inventory and independently validate conflict counts.",
 PROD_LEGACY_INVENTORY:"Obtain separate explicit production READ authorization; collect independently checked aggregate inventory only.",
 STAGING_VALID_APPCHECK:"With operator authority, capture real staging valid-token and absent-token probe against pinned callable revision.",
 OWNER_PROVENANCE_REMEDIATION:"Investigate legacy Owner identity provenance and conflict remediation without imports or writes.",
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:"Independently attest exact P188 six-edit candidate, source/build/image/revision lineage and all security gates."
};
const prerequisites={
 STAGING_LEGACY_INVENTORY:["STAGING_READ_AUTHORIZATION","INDEPENDENT_AUTH_FIRESTORE_PROVENANCE"],
 PROD_LEGACY_INVENTORY:["SEPARATE_PRODUCTION_READ_AUTHORIZATION","INDEPENDENT_AUTH_FIRESTORE_PROVENANCE"],
 STAGING_VALID_APPCHECK:["STAGING_OPERATOR_AUTHORIZATION","REAL_TOKEN_ORIGIN_AND_REVISION_PIN"],
 OWNER_PROVENANCE_REMEDIATION:["OWNER_SOURCE_OF_TRUTH_REVIEW","NO_AUTOMATIC_OWNER_BACKFILL"],
 EXACT_RELEASE_DIFF_SECURITY_SIGNOFF:["SOURCE_ZIP_TO_P188_DIFF_PROVENANCE","BUILD_REVISION_IMAGE_DIGEST","INDEPENDENT_REVIEWER_ATTESTATION"]
};
function dashboard({submissions=[],claims={},asOf="2026-11-25T12:00:00+07:00"}={}){
 const ledger=intake({submissions,claims,asOf});
 const lanes=REQUIREMENT_ORDER.map(id=>{
  const items=ledger.records.filter(x=>x.requirement===id);
  const accepted=items.filter(x=>x.state==="SUBMITTED").length;
  const rejected=items.filter(x=>x.state==="REJECTED").length;
  const state=accepted?"SUBMITTED_UNVERIFIED":rejected?"REJECTED":"MISSING";
  return {
   id,project:REQUIREMENTS[id].project,ownerRole:owners[id],
   status:state,submitted:accepted,rejected,
   independentlyVerified:false,requiredEvidence:REQUIREMENTS[id].kind,
   prerequisites:prerequisites[id],nextAction:nextActions[id],
   approvalAuthorityGranted:false
  };
 });
 return {
  schema:"packtook-p205-g02-evidence-gap-dashboard-v1",
  project:"packtook-staging",mode:"OFFLINE_REVIEW_ONLY",
  baseline:{candidateSha256:EXPECTED_CANDIDATE,buildId:BUILD,revision:REVISION},
  stats:{
   required:lanes.length,missing:lanes.filter(x=>x.status==="MISSING").length,
   submittedUnverified:lanes.filter(x=>x.status==="SUBMITTED_UNVERIFIED").length,
   rejected:lanes.filter(x=>x.status==="REJECTED").length,
   independentlyVerified:0,
   intakeSubmitted:ledger.submitted,intakeRejected:ledger.rejected,
   releaseGatesPassed:0,releaseGatesTotal:8
  },
  lanes,
  blockers:["P188_DEPLOYED_SOURCE_UNATTESTED","BUILD_OUTPUT_DIGEST_NOT_PROVEN",
   "REAL_STAGING_APPCHECK_PENDING","LEGACY_OWNER_PROVENANCE_PENDING",
   "INDEPENDENT_SIGNOFF_PENDING"],
  // Deliberately no GO status is produced from local/untrusted metadata.
  independentReviewAvailableInOfflineMode:false,
  productionReadAuthorizationGranted:false,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",deployDecision:"NO_GO_DEPLOY",
  publicSignup:"KEEP_CLOSED",cloudCalls:0,cloudWrites:0,
  note:"Submission is not verification; a reviewer must independently authenticate protected source evidence outside GitHub CI."
 };
}
function renderMarkdown(data){
 const d=data,rows=d.lanes.map(x=>
  "| "+[x.id,x.project,x.ownerRole,x.status,x.nextAction.replace(/\|/g,"/")].join(" | ")+" |").join("\n");
 return "# PACKTOOK G02 Evidence Gap Dashboard (OFFLINE)\n\n"+
 "**Release: NO_GO_RELEASE | G02: NO_GO | Signup: KEEP_CLOSED**\n\n"+
 "Required: "+d.stats.required+" | Missing: "+d.stats.missing+
 " | Submitted (unverified): "+d.stats.submittedUnverified+
 " | Rejected: "+d.stats.rejected+
 " | Independently verified: **0/5** | Release gates: **0/8**\n\n"+
 "| Requirement | Project | Responsible role | State | Next action |\n"+
 "| --- | --- | --- | --- | --- |\n"+rows+"\n\n"+
 "This is a deterministic offline review tracker. Do NOT treat submitted metadata as authenticated security evidence.\n";
}
module.exports={dashboard,renderMarkdown};
