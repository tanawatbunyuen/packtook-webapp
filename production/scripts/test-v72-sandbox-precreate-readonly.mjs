import assert from "node:assert/strict";
import {evaluate} from "./v72-sandbox-precreate-readonly.mjs";
const base={projectId:"packtook-v72-sandbox-01",projectLookup:"NOT_FOUND_UNPROVEN",
 billingAccounts:[{open:true}],budgetAudits:[{status:"READABLE"}],cli:true,
 branch:"feature/v7.2-controlled-public-pilot-readiness",clean:true};
const good=evaluate(base);
assert.equal(good.inventoryPass,true);
assert.equal(good.createProjectAuthorized,false);
assert.equal(good.productionWrites,false);
assert.equal(good.sandboxWrites,false);
assert(good.pending.includes("PROJECT_ID_AVAILABILITY_NOT_PROVEN"));
const negatives=[
 {projectId:"packtook-prod-01"},{projectId:"production-project"},
 {projectId:"packtook-v72-sandbox-EXAMPLE"},
 {projectId:"packtook-v72-sandbox-12345678901234567890"},
 {projectLookup:"EXISTS"},{projectLookup:"UNKNOWN_UNVERIFIED"},
 {budgetAudits:[{status:"PERMISSION_DENIED"}]},
 {billingAccounts:[]},
 {billingAccounts:[{open:false}]},{cli:false},{branch:"main"},{clean:false}
];
for(const c of negatives){
 const result=evaluate({...base,...c});
 assert.equal(result.inventoryPass,false);
 assert.equal(result.createProjectAuthorized,false);
 assert.equal(result.productionWrites,false);
}
const unknown=evaluate({...base,projectLookup:"UNKNOWN_UNVERIFIED",
 budgetAudits:[{status:"PERMISSION_DENIED"}]});
assert.equal(unknown.inventoryPass,false);
assert(unknown.blockers.includes("PROJECT_LOOKUP_PERMISSION_OR_STATUS_UNVERIFIED"));
assert(unknown.blockers.includes("BILLING_BUDGET_INVENTORY_NOT_READABLE"));
assert.equal(unknown.createProjectAuthorized,false);
assert(unknown.pending.includes("PROJECT_ID_AVAILABILITY_NOT_PROVEN"));
console.log("PASS: read-only sandbox precreation inventory and no cloud writes");
console.log("PASS: "+negatives.length+" negative fixtures reject unsafe contexts");
console.log(JSON.stringify({mode:"OFFLINE_V72_SANDBOX_PREFLIGHT_TEST",
 passed:true,negativeCases:negatives.length,productionWrites:false,
 sandboxWrites:false,projectCreationAuthorized:false,
 decision:"NO_GO_SANDBOX_MUTATIONS_AND_NO_GO_CONTROLLED_PILOT"},null,2));
