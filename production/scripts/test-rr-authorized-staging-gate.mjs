import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {assertAuthorizedIsolatedStaging}=require('../payment-functions/rr-authorized-staging-gate.cjs');
const base={
 RR_STAGING_PROJECT_ID:'packtook-staging',
 RR_ENABLE_REAL_STAGING_PROBES:'I_AUTHORIZE_TEST_ONLY_READS',
 RR_PUBLIC_SIGNUP_CLOSED:'true',RR_NO_PRODUCTION_WRITES:'true',
 GCLOUD_PROJECT:'packtook-staging',GOOGLE_CLOUD_PROJECT:'packtook-staging',
 GCP_PROJECT:'packtook-staging',
 RR_APPCHECK_LIMITED_USE_TOKEN_FILE:'/run/secrets/appcheck-token',
 RR_OMISE_TEST_SECRET_FILE:'/run/secrets/omise-test-secret',
 RR_STAGING_FIREBASE_APP_ID:'1:123456789:web:abcdef0123456789',
 RR_OMISE_TEST_CHARGE_ID:'chrg_test_123456789abcdef',
 RR_EXPECTED_AMOUNT_SATANG:'29900',
 RR_EXPECTED_ACCOUNT_ID:'account_demo001',RR_EXPECTED_REQUEST_ID:'request_demo001'
};
const exists=()=>true;
test('all configured still NEVER grants production writes or release',()=>{
 const a=assertAuthorizedIsolatedStaging(base,exists);
 assert.equal(a.permitted,true);assert.equal(a.productionWritesAllowed,false);
 assert.equal(a.chargeCreationAllowed,false);assert.equal(a.refundAllowed,false);
 assert.equal(a.publicActivationAllowed,false);
});
test('default missing staging inputs fail closed',()=>{
 const a=assertAuthorizedIsolatedStaging({});assert.equal(a.permitted,false);
 assert.ok(a.missing.length>=7);
});
test('production project is never permitted',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,RR_STAGING_PROJECT_ID:'packtook-prod-01'},exists);
 assert.equal(a.permitted,false);
});
test('production cloud project mismatch fails',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,GCLOUD_PROJECT:'packtook-prod-01'},exists);
 assert.ok(a.missing.includes('gcloud_project_mismatch'));
});
test('no env production secrets or service account key allowed',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,OMISE_SECRET_KEY:'skey_live_invalid'},exists);
 assert.ok(a.missing.includes('unsafe_runtime_environment'));
});
test('public signup not closed fails',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,RR_PUBLIC_SIGNUP_CLOSED:'false'},exists);
 assert.ok(a.missing.includes('public_signup_closed_not_confirmed'));
});
test('requires explicit authorization phrase',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,RR_ENABLE_REAL_STAGING_PROBES:'true'},exists);
 assert.ok(a.missing.includes('explicit_probe_authorization_absent'));
});
test('charge id must be test only',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,RR_OMISE_TEST_CHARGE_ID:'chrg_live_123456789abcdef'},exists);
 assert.ok(a.missing.includes('omise_test_charge_id_missing'));
});
test('mounted secrets must be absolute out of checkout',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,RR_OMISE_TEST_SECRET_FILE:'./secret.txt'},exists);
 assert.ok(a.missing.includes('omise_test_secret_file_not_mounted'));
});
test('missing mounted secret fails closed',()=>{
 const a=assertAuthorizedIsolatedStaging(base,()=>false);assert.equal(a.permitted,false);
 assert.ok(a.missing.some(x=>x.includes('not_mounted')));
});
test('invalid evidence amount fails',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,RR_EXPECTED_AMOUNT_SATANG:'0'},exists);
 assert.ok(a.missing.includes('expected_charge_amount_invalid'));
});
test('cannot proceed with disabled production-write prohibition',()=>{
 const a=assertAuthorizedIsolatedStaging({...base,RR_NO_PRODUCTION_WRITES:'false'},exists);
 assert.ok(a.missing.includes('production_write_prohibition_absent'));
});
