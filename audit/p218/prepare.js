"use strict";
/**
 * P218: prepare verified P188 patched backend in an isolated local directory.
 * Does not modify functions/index.js, firebase.json, cloud resources, IAM,
 * release gates, existing Staging revision or source ZIP. No upload or deploy.
 */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const {record}=require("../p172-release-gates");
const root=path.resolve(__dirname,"../..");
const base=path.join(root,"functions");
const p188=path.join(root,"audit/p188/candidate-index.js");
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const blob=x=>crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+x.length+"\0"),x])).digest("hex");
const BIN_DIR=".p218-staging-candidate-build";
const safe=(v)=>typeof v==="string"&&v.startsWith("demo-packtook-");
function stage({target,oldSourceSha256,expectedImage="NOT_FOUND"}={}){
 const old=fs.readFileSync(path.join(base,"index.js"));
 const candidate=fs.readFileSync(p188);
 const pkg=fs.readFileSync(path.join(base,"package.json"));
 const expected=EXPECTED_CANDIDATE;
 const issues=[];
 if(sha(candidate)!==expected)issues.push("P188_SOURCE_NOT_PINNED");
 if(blob(old)!==record.source_pins["functions/index.js"])
  issues.push("ROOT_BACKEND_HISTORICAL_PIN_DRIFT");
 if(!candidate.includes('const {FieldValue}=require("firebase-admin/firestore");')||
  !candidate.includes('ref.create({ownerUid:id,plan:"Free"')||
  candidate.includes('if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});'))
  issues.push("CRITICAL_G02_SECURITY_GUARDS_MISSING");
 if(expectedImage!=="NOT_FOUND")
  issues.push("REGISTRY_IMAGE_STATUS_NOT_OPERATOR_REPORTED_NOT_FOUND");
 if(oldSourceSha256!==undefined &&
   oldSourceSha256!=="25d4550e989b4a4a88eacc011db8f6733a2f3cd322d09db0e33168541df15cd3")
  issues.push("STAGING_SOURCE_OBSERVATION_DRIFT");
 const targets=new Set(["local-fixture-only","offline-operator-review"]);
 if(!targets.has(target))issues.push("UNAUTHORIZED_BUILD_TARGET");
 const gate=record.gates.find(x=>x.id==="G02_BACKEND_AUTH");
 if(!gate||gate.status!=="NO_GO"||record.decision!=="NO_GO_RELEASE")
  issues.push("RELEASE_GATE_UNEXPECTEDLY_OPEN");
 const result={
  schema:"packtook-p218-g02-staging-repair-bundle-v1",
  state:issues.length?"BLOCKED":"CANDIDATE_PREPARED_FOR_OFFLINE_REVIEW",
  issueCodes:issues,
  expectedCandidateSha256:expected,actualCandidateSha256:sha(candidate),
  operatorReportedStagingEntrySha256:"25d4550e989b4a4a88eacc011db8f6733a2f3cd322d09db0e33168541df15cd3",
  operatorReportedStagingMatchesCandidate:false,
  oldRevisionImagePresentInArtifactRegistry:"NOT_VERIFIED_IN_THIS_RUN",
  oldBuildImageTraceability:"UNVERIFIED",
  noStagingCloudCalls:true,
  deploymentPerformed:false,
  independentSecurityApproval:false,
  g02Decision:"NO_GO",releaseDecision:"NO_GO_RELEASE",
  deployDecision:"NO_GO_DEPLOY",publicSignup:"KEEP_CLOSED"
 };
 if(issues.length)return result;
 if(!target)return result;
 // Keep generated artifacts outside functions/ and outside tracked dirs.
 const out=path.join(root,BIN_DIR);
 if(fs.existsSync(out))throw Error("P218_OUTPUT_ALREADY_EXISTS_FAIL_CLOSED");
 fs.mkdirSync(out,{recursive:false,mode:0o700});
 const write=(name,data)=>fs.writeFileSync(path.join(out,name),data,{mode:0o600,flag:"wx"});
 write("index.js",candidate);
 write("package.json",pkg);
 write("manifest.json",JSON.stringify({
  schema:result.schema,entrypoint:"index.js",candidateSha256:expected,
  packageSha256:sha(pkg),release:"NO_GO_RELEASE",
  scope:"OFFLINE_REVIEW_ONLY",deployForbidden:true
 },null,2)+"\n");
 result.fileCount=3;
 result.outputDirectory=BIN_DIR;
 return result;
}
if(require.main===module){
 try{
  if(process.argv.length!==3||process.argv[2]!=="--offline-only")
   throw Error("P218_USAGE_OFFLINE_ONLY");
  const r=stage({target:"local-fixture-only"});
  console.log("P218_REPAIR_BUNDLE_STATUS="+r.state);
  console.log("P218_LOCAL_PATCH_SHA256_MATCH="+(r.expectedCandidateSha256===r.actualCandidateSha256));
  console.log("P218_STAGING_SOURCE_MISMATCH_RECORDED="+!r.operatorReportedStagingMatchesCandidate);
  console.log("P218_DEPLOYMENT_PERFORMED=FALSE");
  console.log("P218_G02=NO_GO_RELEASE");
  if(r.issueCodes.length)process.exitCode=1;
 }catch(e){console.error("P218_BLOCK="+String(e.message||"ERROR").replace(/[^A-Za-z0-9_ -]/g,"").slice(0,100));process.exitCode=1}
}
module.exports={stage,BIN_DIR,sha,blob};
