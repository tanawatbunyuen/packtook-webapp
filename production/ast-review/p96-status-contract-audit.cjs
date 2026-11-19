"use strict";
/* P96 strictly offline contract comparison, no cloud or firebase bootstrap.
 * Detects missing parity evidence rather than claiming candidate equivalence.
 */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"..");
const source=path.join(ROOT,"functions/index.js");
const candidate=path.join(ROOT,"staging-candidates/p81/legacy-status-live-gate-candidate.cjs");
const delegate=path.join(ROOT,"staging-candidates/p75/legacy-status-guard-candidate.cjs");
const firebase=path.join(ROOT,"firebase.json");
const CREDIT=["reserveCredit","finalizeCredit","recoverStaleVideoReservation"];
function sha(s){return crypto.createHash("sha256").update(s).digest("hex");}
function extract(source,name){
 const marker="exports."+name+"=";
 const start=source.indexOf(marker);
 if(start<0||source.indexOf(marker,start+marker.length)>=0)throw Error("P96_DUPLICATE_OR_MISSING_EXPORT_"+name);
 const end=source.indexOf("\n});",start);
 if(end<0)throw Error("P96_UNCLOSED_HANDLER_"+name);
 return source.slice(start,end+4);
}
function audit({original=fs.readFileSync(source,"utf8"),
 candidateSource=fs.readFileSync(candidate,"utf8"),
 delegateSource=fs.readFileSync(delegate,"utf8"),
 config=JSON.parse(fs.readFileSync(firebase,"utf8"))}={}){
 const legacy={usageStatus:extract(original,"usageStatus"),
               recordingStatus:extract(original,"recordingStatus")};
 const creditHashes=Object.fromEntries(CREDIT.map(name=>[name,sha(extract(original,name))]));
 const findings=[];
 function required(id,predicate){if(!predicate)findings.push(id);}
 const codebases=Array.isArray(config.functions)?config.functions:[config.functions];
 const beta=codebases.find(x=>x&&x.codebase==="beta");
 required("BETA_CODEBASE_UNMAPPED",!!beta&&beta.source==="functions");
 required("P81_NOT_ISOLATED",!original.includes('require("../staging-candidates/p81/')&&
     !original.includes('require("./staging-candidates/p81/')&&
     !original.includes("createP81LegacyHandlers("));
 required("CANDIDATE_EXPORTS_NOT_RESTRICTED",candidateSource.includes("legacyReadOnlyCandidate")&&
  candidateSource.includes("enforceAppCheck:true")&&
  delegateSource.includes("recordingStatus,usageStatus"));
 required("CURRENT_USAGE_CONTRACT_UNKNOWN",legacy.usageStatus.includes("creditAvailable(a)")&&
   legacy.usageStatus.includes("walletStartingCredits")&&
   legacy.usageStatus.includes("subscriptionState(a)")&&
   legacy.usageStatus.includes("pendingReservations(a)"));
 required("CANDIDATE_USAGE_RESPONSE_DEPENDENCY_MISSING",candidateSource.includes("usageResponse")&&
   delegateSource.includes("return usageResponse(snap.data())"));
 required("USAGE_SEMANTIC_DIFFERENCE_NOT_DETECTED",
   legacy.usageStatus.includes("ensureAccount(id)")&&
   delegateSource.includes('db.collection("accounts").doc(uid).get()')&&
   !delegateSource.includes("ensureAccount("));
 required("RECORDING_ACCOUNT_PATH_DIFFERENCE_NOT_DETECTED",
   legacy.recordingStatus.includes("ownerRef(id)")&&
   delegateSource.includes('db.collection("accounts").doc(uid)')&&
   !delegateSource.includes("ownerRef("));
 required("CREDIT_EXPORT_MISSING",CREDIT.every(k=>creditHashes[k]));
 return {schema:"P96_STATUS_CONTRACT_AUDIT_V1",
  project:"packtook-staging",statusTargets:["recordingStatus","usageStatus"],
  creditExcluded:[...CREDIT],codebase:"beta",
  offlineSourceVerified:findings.length===0,
  findings,
  evidence:{
   usageResponseParity:"NOT_VERIFIED",
   recordingAccountPathParity:"NOT_VERIFIED",
   deployedToGitParity:"NOT_VERIFIED",
   appCheckBackend:"NOT_PROVEN",
   selectorTargeting:"NOT_VERIFIED",
   sourceToRevision:"NOT_VERIFIED"
  },
  sourceFingerprints:{
   recordingStatus:sha(legacy.recordingStatus).slice(0,16),
   usageStatus:sha(legacy.usageStatus).slice(0,16)
  },
  creditUnchangedFingerprints:creditHashes,
  candidateStatus:"UNREGISTERED_REVIEW_ONLY",
  stagingDeploy:"BLOCKED",productionRelease:"NO_GO_RELEASE"};
}
module.exports={audit,extract};
if(require.main===module){
 try{
  const x=audit();
  // hashes are local consistency aids, NOT deployed image/source attestation
  console.log(JSON.stringify(x));
  if(!x.offlineSourceVerified)process.exitCode=2;
 }catch{
  console.log('{"schema":"P96_STATUS_CONTRACT_AUDIT_V1","offlineSourceVerified":false,"stagingDeploy":"BLOCKED","productionRelease":"NO_GO_RELEASE"}');
  process.exitCode=2;
 }
}
