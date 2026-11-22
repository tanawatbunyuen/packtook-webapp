"use strict";
// P123 compares read-only Cloud Functions describe JSON against operator-attested baseline.
// It never invokes cloud APIs, never authorizes deployment, and does not print secrets.
const fs=require("node:fs"),path=require("node:path");
const base=JSON.parse(fs.readFileSync(path.join(__dirname,"p123-six-revision-baseline.json"),"utf8"));
if(process.argv.length!==3){console.error("P123_USAGE=node audit/p123-six-revision-compare.cjs <directory-of-describe-json>");process.exit(2)}
const dir=path.resolve(process.argv[2]);
const names=Object.keys(base.functions);
const required=["recordingStatus","usageStatus","ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry"];
if(JSON.stringify(names)!==JSON.stringify(required)||base.project_id!=="packtook-staging"||base.region!=="asia-southeast1"||base.deploy_authorized!==false)throw Error("P123_INVALID_BASELINE");
let matches=0,changes=0,missing=0;
for(const name of required){
 let obj;
 try{obj=JSON.parse(fs.readFileSync(path.join(dir,name+".json"),"utf8"))}
 catch(e){missing++;console.log("P123_FUNCTION="+name+" RESULT=UNAVAILABLE");continue}
 const expected="projects/"+base.project_id+"/locations/"+base.region+"/functions/"+name;
 if(obj.name!==expected){changes++;console.log("P123_FUNCTION="+name+" RESULT=RESOURCE_ID_MISMATCH");continue}
 const service=obj.serviceConfig||{};
 const revision=service.revision||service.revisionName||"UNSET";
 const state=obj.state||"UNKNOWN";
 const codebase=(obj.labels||{})["firebase-functions-codebase"]||"UNSET";
 const b=base.functions[name];
 const same=revision===b.revision&&state===b.state&&codebase===b.codebase_label;
 if(same)matches++;else changes++;
 console.log("P123_FUNCTION="+name+" RESULT="+(same?"BASELINE_MATCH":"DRIFT_OR_UNVERIFIED")+" REVISION="+String(revision).slice(0,180)+" STATE="+String(state).slice(0,40)+" CODEBASE="+String(codebase).slice(0,40));
}
console.log("P123_MATCH="+matches+" P123_CHANGED="+changes+" P123_UNAVAILABLE="+missing);
console.log("P123_SOURCE_PARITY=UNVERIFIED P123_DEPLOY_AUTHORIZED=NO");
console.log("P123_RESULT="+(matches===6?"REVISION_BASELINE_MATCH_NOT_SOURCE_ATTESTATION":"NO_GO_REVISION_DRIFT_OR_UNAVAILABLE"));
if(matches!==6)process.exitCode=1;
