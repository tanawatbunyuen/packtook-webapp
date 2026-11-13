import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {dryRunPilot}=require('../payment-functions/p61-pilot-dryrun.cjs');
test('P61 no evidence -> NO_GO with zero writes',()=>{
 const x=dryRunPilot({});assert.equal(x.decision,'NO_GO');assert.equal(x.productionWrites,0);assert.equal(x.commandsExecuted,0);
});
test('P61 false public signup blocks pilot',()=>{
 const x=dryRunPilot({limits:{maxTestAccounts:2,publicSignupClosed:false,refundExecutorDisabled:true,entitlementExecutorDisabled:true,rollbackDocumented:true}});
 assert.ok(x.gaps.includes('P61:pilot_boundaries'));
});
test('P61 no refund or grant executor permitted',()=>{
 const x=dryRunPilot({limits:{maxTestAccounts:2,publicSignupClosed:true,refundExecutorDisabled:false,entitlementExecutorDisabled:false,rollbackDocumented:true}});
 assert.equal(x.decision,'NO_GO');assert.ok(x.gaps.includes('P61:pilot_boundaries'));
});
test('P61 bounded local plan is never an executable release permission',()=>{
 const x=dryRunPilot({limits:{maxTestAccounts:2,publicSignupClosed:true,refundExecutorDisabled:true,entitlementExecutorDisabled:true,rollbackDocumented:true}});
 assert.equal(x.releaseAuthorized,false);assert.equal(x.simulation,'ONLY');
});
