import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {assessStagingProofs,required}=require('../payment-functions/p59-staging-proof-gates.cjs');
test('P59 missing all real staging integration proofs -> HOLD',()=>{
 const out=assessStagingProofs({});
 assert.equal(out.status,'HOLD');assert.equal(out.missing.length,8);
 assert.equal(out.releaseAuthorized,false);
});
test('P59 mock/non-staging evidence never passes',()=>{
 const proof=Object.fromEntries(required.map(k=>[k,{status:'VERIFIED',environment:'mock',evidenceRef:'https://example.invalid/e',reviewer:'QA'}]));
 assert.equal(assessStagingProofs(proof).status,'HOLD');
});
test('P59 real-shaped evidence can only submit for human review, not authorize release',()=>{
 const proof=Object.fromEntries(required.map(k=>[k,{status:'VERIFIED',environment:'isolated-staging',evidenceRef:'https://example.invalid/e',reviewer:'Security'}]));
 const out=assessStagingProofs(proof);assert.equal(out.status,'EVIDENCE_SUBMITTED_FOR_HUMAN_REVIEW');
 assert.equal(out.releaseAuthorized,false);
});
test('P59 reject unverifiable missing provenance',()=>{
 const proof=Object.fromEntries(required.map(k=>[k,{status:'VERIFIED',environment:'isolated-staging',evidenceRef:'',reviewer:'Security'}]));
 assert.equal(assessStagingProofs(proof).missing.length,8);
});
