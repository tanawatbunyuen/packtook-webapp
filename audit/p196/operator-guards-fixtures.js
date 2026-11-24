"use strict";
const assert=require("node:assert/strict");
const {authorize,safeExtract,observe,ACK,TARGET,ENDPOINT}=require("./operator-readonly-runtime");
const env={PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-staging"};
const ticket="G02-READONLY-20261124";
const record=()=>({name:TARGET,environment:"GEN_2",url:ENDPOINT,state:"ACTIVE",buildConfig:{runtime:"nodejs22"},serviceConfig:{uri:"https://usagestatus-x5r74jtjza-as.a.run.app",revision:"usagestatus-00021-abc"}});
let n=0;function test(label,fn){fn();n++;console.log("P196_"+label+"=PASS")}
function blocked(label,args,code){
 test(label,()=>assert.throws(()=>authorize(args),new RegExp(code)));
}
blocked("PRODUCTION_PROJECT_REFUSED",{project:"packtook-prod-01",ack:ACK,ticket,env},"STAGING_ONLY");
blocked("MISSING_ACK_REFUSED",{project:"packtook-staging",ticket,env},"ACK_MISSING");
blocked("GITHUB_ACTIONS_REFUSED",{project:"packtook-staging",ack:ACK,ticket,env:{...env,GITHUB_ACTIONS:"true"}},"CI_REAL_CLOUD_BLOCKED");
blocked("CI_REFUSED",{project:"packtook-staging",ack:ACK,ticket,env:{...env,CI:"true"}},"CI_REAL_CLOUD_BLOCKED");
blocked("EMULATOR_MIX_REFUSED",{project:"packtook-staging",ack:ACK,ticket,env:{...env,FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080"}},"MIXED_EMULATOR");
blocked("MISSING_TICKET_REFUSED",{project:"packtook-staging",ack:ACK,env},"APPROVAL_RECORD_MISSING");
blocked("MISMATCHED_APPROVED_PROJECT_REFUSED",{project:"packtook-staging",ack:ACK,ticket,env:{PACKTOOK_G02_OPERATOR_APPROVED_PROJECT:"packtook-prod-01"}},"APPROVAL_RECORD_MISSING");
blocked("GCLOUD_CONTEXT_MISMATCH_REFUSED",{project:"packtook-staging",ack:ACK,ticket,env:{...env,GCLOUD_PROJECT:"packtook-prod-01"}},"WRONG_CLOUD_CONTEXT");
test("STRICT_STAGING_GATE",()=>{
 assert.equal(authorize({project:"packtook-staging",ack:ACK,ticket,env}).project,"packtook-staging");
});
test("PROVIDER_WRONG_RESOURCE_REFUSED",()=>{
 assert.throws(()=>safeExtract({...record(),name:"projects/packtook-prod-01/locations/asia-southeast1/functions/usageStatus"}),/PROJECT_OR_FUNCTION/);
});
test("EXPECTED_RUNTIME_METADATA_CLASSIFIED_ONLY",()=>{
 const v=safeExtract(record());
 assert.equal(v.endpointMatchesPinned,true);
 assert.equal(v.revisionPresent,true);
 assert.equal(v.active,true);
 assert.equal(v.deployedCandidateAttested,false);
 assert.equal(v.releaseDecision,"NO_GO_RELEASE");
 assert(!JSON.stringify(v).includes("usagestatus-00021-abc"));
});
test("ALTERNATE_RUN_URI_NEVER_REPLACES_OFFICIAL_CALLABLE",()=>{
 const v=safeExtract({...record(),serviceConfig:{...record().serviceConfig,uri:"https://usage-status-xxyy.a.run.app"}});
 assert.equal(v.endpointMatchesPinned,true);
 assert.equal(v.callableAndRunUriDistinct,true);
 assert.equal(v.deployedCandidateAttested,false);
});
test("NO_REVISION_NEVER_PASS_AS_DEPLOYED",()=>{
 const v=safeExtract({...record(),serviceConfig:{uri:"https://usagestatus-x5r74jtjza-as.a.run.app"}});
 assert.equal(v.revisionPresent,false);assert.equal(v.g02Decision,"NO_GO");
});
test("INVALID_RUNTIME_MARKED_UNVERIFIED",()=>{
 const v=safeExtract({...record(),buildConfig:{runtime:"python312"}});
 assert.equal(v.runtime,"UNVERIFIED");
});
test("FIXED_GCLOUD_READONLY_ARGS_MOCKED_ONLY",()=>{
 let invoked=0;
 const v=observe({project:"packtook-staging",ack:ACK,ticket,env,
  exec:(program,argv,opts)=>{
   invoked++;
   assert.equal(program,"gcloud");
   assert.deepEqual(argv,["functions","describe","usageStatus","--gen2","--project",
   "packtook-staging","--region","asia-southeast1","--format=json","--quiet"]);
   assert.equal(opts.env.CLOUDSDK_CORE_PROJECT,"packtook-staging");
   return JSON.stringify(record());
  }});
 assert.equal(invoked,1);
 assert.equal(v.project,"packtook-staging");
 assert.equal(v.operatorIdentityIndependentlyVerified,false);
});
test("CI_CALL_NEVER_INVOKES_GCLOUD",()=>{
 let calls=0;
 assert.throws(()=>observe({project:"packtook-staging",ack:ACK,ticket,
  env:{...env,CI:"true"},exec:()=>{calls++;return "{}"}}),/CI_REAL_CLOUD_BLOCKED/);
 assert.equal(calls,0);
});
test("PII_AND_RAW_PROVIDER_NOT_LOGGED",()=>{
 const r={...record(),secretEnvVars:["SECRET"],serviceConfig:{...record().serviceConfig,secretEnvironmentVariables:[{key:"TOKEN",value:"VERY_PRIVATE"}]}};
 const v=safeExtract(r),s=JSON.stringify(v);
 assert(!s.includes("VERY_PRIVATE")&&!s.includes("SECRET")&&!s.includes("TOKEN"));
});
test("UNKNOWN_PROVIDER_RESOURCE_REFUSED",()=>assert.throws(()=>safeExtract({name:"unknown"}),/MISMATCH/));
console.log("P196_OFFLINE_OPERATOR_RUNTIME_GUARDS="+n+"/"+n+"_PASS");
console.log("P196_REAL_STAGING_READS=0 CLOUD_WRITES=0 DEPLOYS=0");
console.log("P196_G02=NO_GO_PENDING_AUTHORIZED_OPERATOR");
