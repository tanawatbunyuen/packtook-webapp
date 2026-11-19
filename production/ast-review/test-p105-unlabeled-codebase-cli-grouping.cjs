"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {loadPinned,VERSION}=require("./p101-pinned-cli-parser.cjs");
const {audit,endpoint,keys,STATUS,CREDIT,NAMES}=require("./p105-unlabeled-codebase-cli-grouping.cjs");
const root=process.env.P105_FIREBASE_TOOLS_ROOT||"";
const helper=loadPinned(root);
const backend=require(path.join(root,"node_modules","firebase-tools","lib","deploy","functions","backend.js"));
test("P105 exact published CLI version and synthetic grouping",()=>{
 const r=audit(helper,backend);
 assert.equal(VERSION,"15.29.0");
 assert.equal(r.groupedByNameWithFullWant,"FIVE_OF_FIVE_SYNTHETIC");
 assert.equal(r.groupedByNameWithStatusWant,"TWO_OF_TWO_SYNTHETIC");
 assert.equal(r.creditFunctionsSelected,0);
 assert.equal(r.actualDeletePlan,"NOT_EXECUTED");
 assert.equal(r.release,"NO_GO_RELEASE");
});
test("P105 real grouping matches unlabelled 5 names with 5 desired names",()=>{
 const have=NAMES.map(n=>endpoint(n));
 const want={beta:backend.of(...NAMES.map(n=>endpoint(n,"beta")))};
 const result=helper.groupEndpointsByCodebase(want,have);
 assert.deepEqual(keys(result.beta,backend),[...NAMES].sort());
});
test("P105 unlabelled credit functions not claimed by status-only want",()=>{
 const have=NAMES.map(n=>endpoint(n));
 const want={beta:backend.of(...STATUS.map(n=>endpoint(n,"beta")))};
 const grouped=helper.groupEndpointsByCodebase(want,have);
 assert.deepEqual(keys(grouped.beta,backend),[...STATUS].sort());
 for(const id of CREDIT)assert.equal(keys(grouped.beta,backend).includes(id),false);
});
test("P105 name-based matching overrides conflicting label; ownership not proved",()=>{
 const have=[endpoint("recordingStatus","other"),endpoint("usageStatus","owner")];
 const grouped=helper.groupEndpointsByCodebase({
  beta:backend.of(...STATUS.map(n=>endpoint(n,"beta")))},have);
 assert.deepEqual(keys(grouped.beta,backend),[...STATUS].sort());
 assert.equal(audit(helper,backend).deployedOwnership,"NOT_VERIFIED");
});
test("P105 name matching uses region/project, not only bare function name",()=>{
 const have=[endpoint("recordingStatus"),{...endpoint("usageStatus"),project:"packtook-prod-01"}];
 const grouped=helper.groupEndpointsByCodebase({
  beta:backend.of(...STATUS.map(n=>endpoint(n,"beta")))},have);
 assert.deepEqual(keys(grouped.beta,backend),["recordingStatus"]);
});
test("P105 unclaimed no-label credit endpoints remain unassigned for partial want",()=>{
 const have=NAMES.map(n=>endpoint(n));
 const grouped=helper.groupEndpointsByCodebase({
  beta:backend.of(...STATUS.map(n=>endpoint(n,"beta")))},have);
 assert.ok(!keys(grouped.beta,backend).some(id=>CREDIT.includes(id)));
});
test("P105 prefix selector matches extra child even with absent codebase",()=>{
 const config=[{source:"functions",codebase:"beta"}];
 const filters=helper.getEndpointFilters({only:"functions:beta:recordingStatus,functions:beta:usageStatus"},config);
 assert.equal(helper.endpointMatchesAnyFilter(endpoint("recordingStatus-child","beta"),filters),true);
 assert.equal(helper.endpointMatchesAnyFilter(endpoint("recordingStatusChild","beta"),filters),false);
});
test("P105 mapping does not establish full deploy deletion plan or source parity",()=>{
 const r=audit(helper,backend);
 assert.equal(r.actualHaveInventory,"NOT_LOADED_FROM_CLOUD");
 assert.equal(r.actualWantBackend,"NOT_BUILT");
 assert.equal(r.sourceToGitParity,"NOT_VERIFIED");
 assert.equal(r.accountBehavior,"NOT_EQUIVALENT");
 assert.equal(r.guardDrift,"UNREMEDIATED");
 assert.equal(r.deploy,0);
});
