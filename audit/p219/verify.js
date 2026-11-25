"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {record}=require("../p172-release-gates");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const ROOT=path.resolve(__dirname,"../..");
const OLD_SHA="25d4550e989b4a4a88eacc011db8f6733a2f3cd322d09db0e33168541df15cd3";
const UNSAFE=[
 'if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});',
 'const role=ref.id===id?"admin":"operator";'
];
const REQUIRED=[
 'async function assertAdmin(uidValue){const ref=own(uidValue),snap=await ref.get();if(!snap.exists||snap.data().ownerUid!==uidValue)',
 'const acc=own(accountId),lock=acc.collection("barcodeLocks")',
 'if(!aSnap.exists||aSnap.data().ownerUid!==accountId)',
 'if(!snap.exists||snap.data().ownerUid!==id)',
 'ref.create({ownerUid:id,plan:"Free"',
 'const {FieldValue}=require("firebase-admin/firestore");'
];
const REJECTED_EXPORTS=["ownerGrantVideoCredits","ownerUpdateCustomerExpiry",
 "ownerGetCustomerManageState","ownerGetCustomerAdjustmentHistory"];
function verify({candidate,reportedStagingSha=OLD_SHA,
 operatorFindings={legacyBackfill:"FOUND",selfAdmin:"FOUND"},releaseRecord=record}={}){
 const issues=[];
 const source=candidate===undefined?fs.readFileSync(path.join(ROOT,"audit/p188/candidate-index.js")):candidate;
 const content=Buffer.isBuffer(source)?source.toString("utf8"):"";
 if(!Buffer.isBuffer(source)||sha(source)!==EXPECTED_CANDIDATE)issues.push("EXACT_P188_PIN_MISMATCH");
 if(reportedStagingSha!==OLD_SHA)issues.push("STAGING_SOURCE_OBSERVATION_DRIFT");
 if(operatorFindings?.legacyBackfill!=="FOUND"||operatorFindings?.selfAdmin!=="FOUND")
  issues.push("LEGACY_OPERATOR_FINDINGS_DRIFT");
 if(UNSAFE.some(x=>content.includes(x)))issues.push("UNSAFE_LEGACY_OWNER_AUTHZ_IN_REPAIR");
 for(const token of REQUIRED)if(!content.includes(token))issues.push("REQUIRED_REPAIR_INVARIANT_MISSING");
 if(REJECTED_EXPORTS.some(x=>content.includes("exports."+x+"=")))issues.push("RECOVERED_OWNER_IMPORT_UNAUTHORIZED");
 if(!releaseRecord||releaseRecord.gates?.length!==8||
  releaseRecord.gates.some(g=>g.status!=="NO_GO")||
  releaseRecord.decision!=="NO_GO_RELEASE"||releaseRecord.deployment!=="NO_GO_DEPLOY")
  issues.push("RELEASE_GATE_DRIFT");
 return {
  schema:"packtook-p219-g02-runtime-remediation-readiness-v1",
  classification:issues.length?"REJECTED":"CANDIDATE_REPAIR_VERIFIED_LOCAL_ONLY",
  candidateSha256:EXPECTED_CANDIDATE,
  stagingPreviousSourceSha256:OLD_SHA,
  previousStagingMismatchObserved:reportedStagingSha===OLD_SHA,
  candidateUnsafePatternsAbsent:UNSAFE.every(x=>!content.includes(x)),
  candidateGuardInvariantsPresent:REQUIRED.every(x=>content.includes(x)),
  stagingCurrentSourceRemediated:false,
  stagingCloudRevisionVerified:false,
  operatorEvidenceIndependentlyAuthenticated:false,
  deployAuthorizedByThisReport:false,
  liveRuntimeG02Tested:false,
  cloudReads:0,cloudWrites:0,
  issues,releaseGatesPassed:0,releaseGatesTotal:8,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED"
 };
}
module.exports={verify,OLD_SHA,UNSAFE,REQUIRED};
