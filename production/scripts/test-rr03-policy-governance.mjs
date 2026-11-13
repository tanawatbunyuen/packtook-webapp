import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {evaluatePolicyChange}=require('../payment-functions/rr03-policy-governance-contract.cjs');
const good={accountId:'account_demo001',actorId:'finance_user001',policyId:'finance_user001',
 role:'finance',action:'REVOKE',requesterId:'requester_demo01',
 securityApproverId:'sec_approver001',ownerApproverId:'owner_approver01',
 securityApprovalVerified:true,ownerApprovalVerified:true,
 tenantScopeConfirmed:true,principalDisabled:false,principalEmailVerified:true,
 expectedEpoch:2,evidenceRef:'https://example.invalid/evidence'};
test('RR03 valid-looking authorization stays review-only, never writes',()=>{
 const r=evaluatePolicyChange(good);assert.equal(r.gate,'REVIEW_ONLY');
 assert.equal(r.mayWritePolicy,false);assert.equal(r.releaseAuthorized,false);
});
test('RR03 self-approval fails closed',()=>{
 const r=evaluatePolicyChange({...good,ownerApproverId:good.actorId});
 assert.equal(r.gate,'HOLD');assert.ok(r.fail.includes('self_or_colluding_identity'));
});
test('RR03 missing independent approval fails closed',()=>{
 const r=evaluatePolicyChange({...good,securityApprovalVerified:false});
 assert.ok(r.fail.includes('approvals_unverified'));
});
test('RR03 cross tenant / unverified scope fails closed',()=>{
 const r=evaluatePolicyChange({...good,tenantScopeConfirmed:false});
 assert.ok(r.fail.includes('tenant_scope_unverified'));
});
test('RR03 disabled subject fails closed',()=>{
 const r=evaluatePolicyChange({...good,principalDisabled:true});
 assert.ok(r.fail.includes('principal_not_eligible'));
});
test('RR03 invalid epoch fails closed',()=>{
 const r=evaluatePolicyChange({...good,expectedEpoch:0});
 assert.ok(r.fail.includes('invalid_epoch'));
});
test('RR03 privilege escalation outside allowed roles is rejected',()=>{
 const r=evaluatePolicyChange({...good,role:'superadmin'});
 assert.ok(r.fail.includes('invalid_role_or_action'));
});
test('RR03 untrusted evidence is rejected',()=>{
 const r=evaluatePolicyChange({...good,evidenceRef:'test-only'});
 assert.ok(r.fail.includes('evidence_missing'));
});
