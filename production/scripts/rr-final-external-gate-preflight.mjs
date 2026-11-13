/** Release external gate inventory. No secrets, no network and no side effects. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {assessStagingProofs}=require('../payment-functions/p59-staging-proof-gates.cjs');
const {assessApprovals}=require('../payment-functions/p60-independent-approval-gates.cjs');
const {dryRunPilot}=require('../payment-functions/p61-pilot-dryrun.cjs');
const {evaluateReadiness}=require('../payment-functions/p62-release-evidence.cjs');
const index=readFileSync(new URL('../payment-functions/index.js',import.meta.url),'utf8');
const allFiles=[
 'p54-recovery-backend-candidate.cjs','p58-policy-integrated-backend.cjs',
 'p59-staging-proof-gates.cjs','p60-independent-approval-gates.cjs',
 'p61-pilot-dryrun.cjs','p62-release-evidence.cjs'
];
test('no recovery candidate exported from production handler',()=>{
 for(const name of allFiles)assert.equal(index.includes(name),false);
});
test('staging App Check and Omise real evidence are missing',()=>{
 const r=assessStagingProofs({});assert.equal(r.status,'HOLD');
 assert.equal(r.missing.length,8);assert.equal(r.releaseAuthorized,false);
});
test('all five real independent approvals missing',()=>{
 const r=assessApprovals({});assert.equal(r.status,'HOLD');assert.equal(r.missing.length,5);
});
test('pilot dryrun stays NO_GO and never authorizes production',()=>{
 const r=dryRunPilot({});assert.equal(r.decision,'NO_GO');
 assert.equal(r.productionWrites,0);assert.equal(r.commandsExecuted,0);
});
test('release readiness never self-authorizes',()=>{
 const r=evaluateReadiness({});assert.equal(r.decision,'NO_GO');
 assert.equal(r.requiresHumanApproval,true);assert.equal(r.releaseAuthorized,false);
});
test('cloud credential / production project environment must be absent',()=>{
 for(const name of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN',
 'OMISE_SECRET_KEY','PACKTOOK_PRODUCTION_PROJECT_ID'])
 assert.equal(process.env[name],undefined,name);
});
