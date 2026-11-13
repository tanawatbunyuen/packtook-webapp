import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {evaluateReadiness}=require('../payment-functions/p62-release-evidence.cjs');
test('P62 no metrics -> NO_GO',()=>{
 const x=evaluateReadiness();assert.equal(x.decision,'NO_GO');assert.equal(x.metricsValid,false);
});
test('P62 duplicates cannot pass reconciliation',()=>{
 const x=evaluateReadiness({observations:{testCases:10,unreconciled:0,duplicateEntitlements:1,rollbackExercise:'VERIFIED',alertingExercise:'VERIFIED',incidentRunbookReviewed:true}});
 assert.equal(x.metricsValid,false);assert.equal(x.releaseAuthorized,false);
});
test('P62 even healthy-looking metrics never permit production automatically',()=>{
 const x=evaluateReadiness({observations:{testCases:10,unreconciled:0,duplicateEntitlements:0,rollbackExercise:'VERIFIED',alertingExercise:'VERIFIED',incidentRunbookReviewed:true}});
 assert.equal(x.metricsValid,true);assert.equal(x.decision,'NO_GO');assert.equal(x.publicSignupClosed,true);
});
test('P62 missing rollback proof fails closed',()=>{
 const x=evaluateReadiness({observations:{testCases:1,unreconciled:0,duplicateEntitlements:0,rollbackExercise:'NOT_TESTED',alertingExercise:'VERIFIED',incidentRunbookReviewed:true}});
 assert.equal(x.metricsValid,false);
});
