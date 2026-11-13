import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const dir=new URL('../payment-functions/',import.meta.url);
const prod=readFileSync(new URL('index.js',dir),'utf8');
const p58=readFileSync(new URL('p58-policy-integrated-backend.cjs',dir),'utf8');
const p57=readFileSync(new URL('p57-demo-policy-epoch.cjs',dir),'utf8');
const p48risk=/function carryoverCredits\(|function purchasedCreditBalance\(/;
test('RR05 recovery candidate must remain unexported from main handler',()=>{
 for(const name of ['p54-recovery-backend-candidate','p57-demo-policy-epoch',
 'p58-policy-integrated-backend','rr03-policy-governance-contract',
 'p59-staging-proof-gates','p60-independent-approval-gates',
 'p61-pilot-dryrun','p62-release-evidence'])
  assert.equal(prod.includes(name),false,name+' unexpectedly wired to handler');
});
test('RR05 production handler still has account and payment code; no assumed deployment of recovery',()=>{
 assert.match(prod,/firebase-functions\/v2\/https/);
 assert.match(prod,/PACKTOOK_OMISE_TEST_SECRET_KEY/);
 assert.equal(prod.includes('buildP58DemoRecoveryBackend'),false);
});
test('RR05 P58 fail-closed demo guards and transactional policy checks retained',()=>{
 assert.match(p58,/assertDemoOnly\(env\)/);
 assert.match(p58,/tx\.get\(policyRef\(accountId,actorId,'owner'\)\)/);
 assert.match(p58,/tx\.get\(policyRef\(accountId,actorId,role\)\)/);
 assert.match(p58,/policy_revoked_or_invalid/);
});
test('RR03 policy prototype has no privileged claim setter',()=>{
 assert.equal(p57.includes('setCustomUserClaims'),false);
 assert.equal(p58.includes('setCustomUserClaims'),false);
});
test('RR05 P48 historical credit risk requires separate functional acceptance, not static inference',()=>{
 assert.match(prod,p48risk);
 assert.match(prod,/creditWalletRemaining/);
 const declared={status:'NOT_VERIFIED',reason:'P48 behavior needs real emulator regression against release-base handler'};
 assert.equal(declared.status,'NOT_VERIFIED');
});
