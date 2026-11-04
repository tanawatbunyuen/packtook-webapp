// PACKTOOK V7.2 — deterministic, OFFLINE mock Cloud Run traffic rehearsal.
// Simulates two revisions and rollback A -> B -> A using the same exact
// named-revision traffic form used by Cloud Run. No network or Cloud writes.
// A passing simulation DOES NOT prove a real non-production rollback.
import assert from "node:assert/strict";
const SERVICE="packtook-v72-rollback-sandbox";
const A=SERVICE+"-00001-aaa",B=SERVICE+"-00002-bbb";
function make(){return {revisions:[A,B],latest:B,traffic:[{revision:A,percent:100,latestRevision:false}]}}
function migrate(state,revision){
 assert(state.revisions.includes(revision),"revision must exist");
 state.traffic=[{revision,percent:100,latestRevision:false}];
 return state;
}
function validate(state,revision){
 return state.traffic.length===1&&state.traffic[0].percent===100&&
 state.traffic[0].revision===revision&&state.traffic[0].latestRevision===false;
}
const trial=make();
assert(validate(trial,A));
migrate(trial,B);
assert(validate(trial,B));
migrate(trial,A);
assert(validate(trial,A));
assert.notEqual(trial.latest,A,"rollback must not confuse latest with known-good revision");
const bad=[
 {revisions:[A],latest:B,traffic:[{revision:A,percent:50,latestRevision:false}]},
 {revisions:[A,B],latest:B,traffic:[{revision:A,percent:100,latestRevision:true}]},
 {revisions:[A,B],latest:B,traffic:[{revision:B,percent:100,latestRevision:false}]},
 {revisions:[A,B],latest:B,traffic:[{revision:A,percent:90,latestRevision:false},{revision:B,percent:10,latestRevision:false}]}
];
for(const state of bad)assert.equal(validate(state,A),false);
assert.throws(()=>migrate(make(),"unknown-revision"));
console.log("PASS: OFFLINE mock revision A -> B -> A routing with exact named revisions");
console.log("PASS: rejects split, LATEST auto-route, wrong and missing revisions");
console.log(JSON.stringify({mode:"OFFLINE_TRAFFIC_ROLLBACK_SIMULATION",
 mockOnly:true,steps:["A=100","B=100","A=100"],negativeCases:5,
 cloudRunNonProductionRehearsalVerified:false,
 productionWrites:false,ownerDeployApproval:false,
 decision:"NO_GO_CONTROLLED_PILOT"},null,2));
