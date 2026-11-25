"use strict";
/** P202 independent review packet: accepts ONLY sanitized operator summaries.
 * Metadata evidence is untrusted self-report, and this code can NEVER approve a release.
 * No network, privileged API, source zip, payments or raw customer data.
 */
const {reconcile:reconcileP190,EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {summarize:cleanupSummary}=require("../p201/verify");
const {check:revisionCheck}=require("../p200/verify");
const {BUILD,REVISION,PROJECT}=require("../p198/verify");
const {SOURCE}=require("../p199/verify");
const TYPE=["function","build","revision","registry","appCheck","stagingLegacyInventory","productionLegacyInventory","ownerProvenance","securitySignoff"];
const allowed={
 function:["project","target","revision","state","runtime","sourceArchiveCandidateAttested"],
 build:["project","buildId","status","sourceGeneration","outputImageDigestVerified"],
 revision:["project","revision","ready","threeDigestsEqual","buildIdMatches","sourceGenerationMatches","buildOutputDigestMatches"],
 registry:["project","cleanupPolicy","olderThanSeconds","tagState","visibleVersions","auditDeleteEvents","deletionIndependentlyProven","cleanupPolicyDryRun"],
 appCheck:["project","validTokenAccepted","missingTokenDenied","tokenProvenanceIndependentlyAttested","revisionMatches"],
 stagingLegacyInventory:["project","complete","authLookupErrors","ownerConflicts","independentAttestation"],
 productionLegacyInventory:["project","complete","authLookupErrors","ownerConflicts","independentAttestation"],
 ownerProvenance:["project","resolved","independentAttestation"],
 securitySignoff:["project","candidateSha256","revisionAndDiffVerified","independentAttestation"]
};
const scope=Object.freeze({
 function:"packtook-staging",build:"packtook-staging",revision:"packtook-staging",
 registry:"packtook-staging",appCheck:"packtook-staging",
 stagingLegacyInventory:"packtook-staging",productionLegacyInventory:"packtook-prod-01",
 ownerProvenance:"packtook-prod-01",securitySignoff:"packtook-staging"
});
const isObject=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
const hasOnly=(x,fields)=>isObject(x)&&Object.keys(x).every(k=>fields.includes(k));
function consolidate({claims={}}={}){
 if(!hasOnly(claims,TYPE))throw Error("P202_UNRECOGNIZED_EVIDENCE_TRACK");
 const evidence=TYPE.map(track=>{
  const x=claims[track];
  if(x==null)return {track,classification:"NOT_SUPPLIED",issues:["NO_EVIDENCE"]};
  if(!hasOnly(x,allowed[track]))return {track,classification:"REJECTED",issues:["UNEXPECTED_FIELDS_OR_PII"]};
  const issues=[];
  const check=(ok,code)=>{if(!ok)issues.push(code)};
  check(x.project===scope[track],"WRONG_PROJECT");
  switch(track){
   case "function":
    check(x.target==="usageStatus","WRONG_FUNCTION");
    check(x.revision===REVISION,"REVISION_DRIFT");
    check(x.state==="ACTIVE","FUNCTION_NOT_ACTIVE");
    check(x.runtime==="nodejs22","RUNTIME_DRIFT");
    // Operator cannot simply claim this is proven via a boolean.
    break;
   case "build":
    check(x.buildId===BUILD,"BUILD_ID_DRIFT");
    check(x.status==="SUCCESS","BUILD_NOT_SUCCESS");
    check(x.sourceGeneration===SOURCE,"SOURCE_GENERATION_DRIFT");
    break;
   case "revision":
    check(x.revision===REVISION,"REVISION_DRIFT");
    check(x.ready===true,"REVISION_NOT_READY");
    check(x.threeDigestsEqual===true,"REVISION_IMAGE_DIGEST_DIFFERENTIAL");
    check(x.buildIdMatches===true,"BUILD_ID_NOT_LINKED");
    check(x.sourceGenerationMatches===true,"SOURCE_NOT_LINKED");
    break;
   case "registry":
    check(x.cleanupPolicy==="DELETE"&&x.olderThanSeconds===604800&&x.tagState==="ANY","CLEANUP_POLICY_DRIFT");
    check(x.visibleVersions===null||Number.isSafeInteger(x.visibleVersions)&&x.visibleVersions>=0,"INVALID_VERSION_COUNT");
    check(x.auditDeleteEvents===null||Number.isSafeInteger(x.auditDeleteEvents)&&x.auditDeleteEvents>=0,"INVALID_DELETE_LOG_COUNT");
    break;
   case "appCheck":
    check(x.validTokenAccepted===true&&x.missingTokenDenied===true,"APPCHECK_REAL_PROBE_MISSING");
    check(x.revisionMatches===true,"APPCHECK_REVISION_NOT_PINNED");
    break;
   case "stagingLegacyInventory":case "productionLegacyInventory":
    check(x.complete===true&&x.authLookupErrors===0&&x.ownerConflicts===0,"UNRESOLVED_LEGACY_ACCOUNT_INVENTORY");
    break;
   case "ownerProvenance":
    check(x.resolved===true,"OWNER_PROVENANCE_UNRESOLVED");
    break;
   case "securitySignoff":
    check(x.candidateSha256===EXPECTED_CANDIDATE,"CANDIDATE_SHA256_DRIFT");
    check(x.revisionAndDiffVerified===true,"RELEASE_DIFF_NOT_REVIEWED");
    break;
  }
  // Even "independentAttestation: true" supplied in JSON is not independently authenticated.
  return {track,classification:issues.length?"REJECTED":"CLAIMED_NOT_INDEPENDENTLY_VERIFIED",issues};
 });
 const external=reconcileP190().externalEvidence;
 return {
  schema:"packtook-p202-g02-security-evidence-packet-v1",
  reviewOnly:true,project:PROJECT,releaseCandidateSha256:EXPECTED_CANDIDATE,
  referenceBuild:BUILD,referenceRevision:REVISION,
  records:evidence,
  selfReportedAccepted:evidence.filter(x=>x.classification==="CLAIMED_NOT_INDEPENDENTLY_VERIFIED").length,
  independentlyVerified:0,
  requiredP190ExternalTracks:external.requirementsTotal,
  requiredP190ExternalStillMissingIndependentVerification:external.requirementsTotal,
  sourceCodeAndContainerByteEqualityVerified:false,
  buildRevisionDigestIndependentlyVerified:false,
  deletionCausalityVerified:false,
  appCheckRealStagingAttested:false,
  legacyOwnerProvenanceIndependentlyVerified:false,
  securityReviewerSignedOff:false,
  productionReads:0,cloudWrites:0,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED",
  caveat:"Only claim metadata is reconciled; neither author identity, source contents, build output digest, active enforcement, nor reviewer signature are authenticated."
 };
}
module.exports={consolidate,TYPE,allowed};
