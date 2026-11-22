"use strict";
// P123 local fixture tests: exact match, revision drift, missing function, foreign project.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const assert=require("node:assert/strict");
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,"p123-six-revision-baseline.json"),"utf8"));
const work=fs.mkdtempSync(path.join(os.tmpdir(),"p123-test-"));
const script=path.join(__dirname,"p123-six-revision-compare.cjs");
const names=Object.keys(baseline.functions);
try{
 for(const name of names){
   const b=baseline.functions[name];
   fs.writeFileSync(path.join(work,name+".json"),JSON.stringify({
     name:"projects/packtook-staging/locations/asia-southeast1/functions/"+name,
     state:b.state,labels:{},serviceConfig:{revision:b.revision},
     buildConfig:{source:{storageSource:{bucket:"fixture"}}}
   }));
 }
 function run(){return cp.spawnSync(process.execPath,[script,work],{encoding:"utf8"})}
 let result=run();
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stdout,/P123_MATCH=6 P123_CHANGED=0 P123_UNAVAILABLE=0/);
 assert.match(result.stdout,/P123_SOURCE_PARITY=UNVERIFIED P123_DEPLOY_AUTHORIZED=NO/);
 console.log("P123_FIXTURE_BASELINE=PASS");
 const p=path.join(work,"usageStatus.json");
 const obj=JSON.parse(fs.readFileSync(p,"utf8"));obj.serviceConfig.revision="usagestatus-99999-drift";
 fs.writeFileSync(p,JSON.stringify(obj));
 result=run();assert.equal(result.status,1);assert.match(result.stdout,/P123_MATCH=5 P123_CHANGED=1 P123_UNAVAILABLE=0/);
 console.log("P123_FIXTURE_REVISION_DRIFT_BLOCK=PASS");
 obj.serviceConfig.revision=baseline.functions.usageStatus.revision;
 obj.name="projects/packtook-prod-01/locations/asia-southeast1/functions/usageStatus";
 fs.writeFileSync(p,JSON.stringify(obj));
 result=run();assert.equal(result.status,1);assert.match(result.stdout,/RESOURCE_ID_MISMATCH/);
 console.log("P123_FIXTURE_FOREIGN_PROJECT_BLOCK=PASS");
 fs.unlinkSync(p);
 result=run();assert.equal(result.status,1);assert.match(result.stdout,/P123_MATCH=5 P123_CHANGED=0 P123_UNAVAILABLE=1/);
 console.log("P123_FIXTURE_MISSING_FUNCTION_BLOCK=PASS");
 console.log("P123_FIXTURE_RESULT=4/4_PASS");
}finally{fs.rmSync(work,{recursive:true,force:true})}
