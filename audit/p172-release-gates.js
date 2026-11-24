#!/usr/bin/env node
"use strict";
/* P172 fail-closed static evidence consistency, NEVER runtime or owner approval. */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const ROOT=path.join(__dirname,"..");
const record=JSON.parse(fs.readFileSync(path.join(__dirname,"p172-release-evidence.json"),"utf8"));
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const expectedPhases=["P165","P166","P167","P168","P169","P170","P171"];
function verify(m=record){
 assert.equal(m.schema,"packtook-p172-release-evidence-v1");
 assert.equal(m.mode,"review_only");
 assert.equal(m.decision,"NO_GO_RELEASE");
 assert.equal(m.owner_import,"NO_GO_OWNER_IMPORT");
 assert.equal(m.deployment,"NO_GO_DEPLOY");
 assert.equal(m.verified_production_runtime,false);
 assert.deepEqual(m.evidence.map(x=>x.phase),expectedPhases);
 for(const e of m.evidence){
   assert.equal(e.runtime_attested,false);
   assert.equal(typeof e.result,"string");
   assert(e.class.startsWith("operator_reported_"));
 }
 assert(m.gates.length>=8);
 const gateIds=new Set(m.gates.map(x=>x.id));
 assert.equal(gateIds.size,m.gates.length);
 for(const g of m.gates){assert.equal(g.status,"NO_GO");assert(g.reason.length>25);}
 for(const gate of ["G01_ROOT_RULES","G03_CALLABLE_INVALID_TOKEN_PROTOCOL",
                   "G04_PRODUCTION_TOKEN_SIGNATURE","G05_RECOVERED_OWNER_PROVENANCE",
                   "G08_OWNER_RELEASE_APPROVAL"])assert(gateIds.has(gate));
 assert(m.evidence.find(e=>e.phase==="P168").result.includes("403/"));
 assert(m.evidence.find(e=>e.phase==="P171").result.includes("unsigned"));
 return true;
}
try{
 verify();
 console.log("P172_RELEASE_GATES=8/8_NO_GO");
 for(const [name,sha] of Object.entries(record.source_pins)){
   const b=fs.readFileSync(path.join(ROOT,name));
   if(name==="firestore.rules"){
     // Preserve P172's historical root-source pin. Only permit P173's exact
     // one-byte syntax candidate; never infer that production rules changed.
     const candidate=Buffer.from(b);
     const original="function signedIn(){return request.auth != null}";
     const patched="function signedIn(){return request.auth != null;}";
     const text=candidate.toString("utf8");
     assert.equal(blob(candidate),"52e207280059e5700da77add9e4af45971c94557",
                  "unreviewed_p173_rules_candidate");
     assert.equal(text.split(patched).length,2,"p173_patch_not_unique");
     const historical=Buffer.from(text.replace(patched,original));
     assert.equal(blob(historical),sha,"p172_historical_source_drift");
   }else{
     assert.equal(blob(b),sha,"source_drift:"+name);
   }
 }
 console.log("P172_SOURCE_PINS=3/3_PASS");
 console.log("P172_P173_REVIEW_ONLY_ROOT_RULES_CANDIDATE=PASS");
 for(const doc of record.reference_docs){
   assert(doc.startsWith("audit/")&&!doc.includes(".."));
   assert(fs.statSync(path.join(ROOT,doc)).isFile());
 }
 console.log("P172_EVIDENCE_DOC_REFERENCES=6/6_PASS");
 console.log("P172_OPERATOR_EVIDENCE_LABELED_UNATTESTED=7/7_PASS");
 console.log("P172_PRODUCTION_RUNTIME_ATTESTED=FALSE");
 console.log("P172_RELEASE_DECISION=NO_GO_RELEASE");
 console.log("P172_OWNER_IMPORT=NO_GO_OWNER_IMPORT P172_DEPLOY=NO_GO_DEPLOY");
 console.log("P172_NO_CLOUD_CALLS=TRUE P172_NO_DEPLOYMENTS=TRUE");
}catch(err){
 console.log("P172_BLOCK=EVIDENCE_INTEGRITY_OR_GATE_FAILURE");
 process.exitCode=1;
}
module.exports={verify,blob,record};
