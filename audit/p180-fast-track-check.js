"use strict";
// P180 read-only static gate reconciliation. This script never authorizes a release.
const fs=require("node:fs"),assert=require("node:assert/strict"),path=require("node:path");
const dir=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(dir,"p180-fast-track-matrix.json"),"utf8"));
const prior=JSON.parse(fs.readFileSync(path.join(dir,"p172-release-evidence.json"),"utf8"));
const required=new Set(prior.gates.map(x=>x.id));
assert.equal(manifest.schema,"packtook-production-fast-track-v1");
assert.equal(manifest.mode,"review_only");
assert.equal(manifest.currentDecision,"NO_GO_RELEASE");
assert.equal(manifest.deployment,"NO_GO_DEPLOY");
assert.equal(manifest.publicSignup,"KEEP_CLOSED");
assert.equal(manifest.ownerImports,"NO_GO_OWNER_IMPORT");
assert.deepEqual(new Set(manifest.gateEvidence.map(x=>x.id)),required);
assert.equal(manifest.gateEvidence.length,8);
for(const g of manifest.gateEvidence){
 assert.equal(g.status,"NO_GO");
 assert.equal(prior.gates.find(x=>x.id===g.id).status,"NO_GO");
 assert(g.proof.length>35&&g.owner.length>3);
}
const grouped=manifest.stages.flatMap(s=>s.gates);
assert.equal(grouped.length,8);
assert.equal(new Set(grouped).size,8);
for(const x of grouped)assert(required.has(x));
assert.deepEqual(manifest.stages.map(x=>x.id),["S1","S2","S3","S4"]);
for(const stage of manifest.stages)assert(stage.tasks.length>=3);
assert.equal(prior.verified_production_runtime,false);
assert.equal(prior.decision,"NO_GO_RELEASE");
assert.equal(prior.deployment,"NO_GO_DEPLOY");
const pending=manifest.gateEvidence.filter(x=>x.status!=="GO").length;
console.log("P180_RELEASE_GATES="+pending+"/8_STILL_NO_GO");
console.log("P180_FOUR_STAGE_PLAN=PASS");
console.log("P180_GATE_COVERAGE=8/8_PASS");
console.log("P180_GATES_RECONCILE_P172=PASS");
console.log("P180_PRODUCTION_RUNTIME_ATTESTATION=NOT_VERIFIED");
console.log("P180_CI_IS_NOT_RELEASE_APPROVAL=PASS");
console.log("P180_DEPLOYMENT=NO_GO_DEPLOY PUBLIC_SIGNUP=KEEP_CLOSED");
