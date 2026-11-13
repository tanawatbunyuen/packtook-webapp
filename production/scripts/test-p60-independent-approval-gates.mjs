import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {assessApprovals,roles}=require('../payment-functions/p60-independent-approval-gates.cjs');
test('P60 no signoffs -> HOLD',()=>assert.equal(assessApprovals({}).missing.length,5));
test('P60 self approval cannot be treated as independent',()=>{
 const v=Object.fromEntries(roles.map(role=>[role,{decision:'APPROVE',scope:'recovery-controlled-pilot',actorId:'same_person',evidenceRef:'https://example.invalid/doc',independent:true}]));
 assert.equal(assessApprovals(v).status,'HOLD');
});
test('P60 declared approvals do not activate pilot without external verification',()=>{
 const v=Object.fromEntries(roles.map((role,i)=>[role,{decision:'APPROVE',scope:'recovery-controlled-pilot',actorId:'reviewer_'+i,evidenceRef:'https://example.invalid/doc',independent:true}]));
 const out=assessApprovals(v);assert.equal(out.status,'AWAIT_EXTERNAL_VERIFICATION');assert.equal(out.releaseAuthorized,false);
});
test('P60 scope mismatch fails closed',()=>{
 const v={Owner:{decision:'APPROVE',scope:'production-global',actorId:'reviewer_owner',evidenceRef:'https://example.invalid/doc',independent:true}};
 assert.equal(assessApprovals(v).status,'HOLD');
});
