/** Explicit manual verification in packtook-staging ONLY.
 * Not invoked by GitHub PR CI; never deployed; never creates charges or refunds.
 * Secrets must be mounted outside checkout under /run/secrets/ by trusted staging operator.
 * Requires Firebase ADC workload identity with narrowly scoped App Check verifier access.
 */
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {assertAuthorizedIsolatedStaging}=require('../payment-functions/rr-authorized-staging-gate.cjs');
const {buildReadOnlyOmiseTestProbe}=require('../payment-functions/rr-staging-readonly-omise-probe.cjs');
const config=assertAuthorizedIsolatedStaging(process.env);
if(!config.permitted){
 console.error('STAGING_PROBE_NOT_EXECUTED:',config.missing.join(','));
 process.exitCode=2;
}else{
 const admin=require('firebase-admin');
 const projectId=process.env.RR_STAGING_PROJECT_ID;
 const app=admin.initializeApp({projectId});
 const statuses=[];
 try{
  const limitedUseToken=readFileSync(process.env.RR_APPCHECK_LIMITED_USE_TOKEN_FILE,'utf8').trim();
  if(!limitedUseToken||limitedUseToken.length<100)throw Error('appcheck_token_invalid_length');
  const appCheck=admin.appCheck(app);
  const initial=await appCheck.verifyToken(limitedUseToken,{consume:true});
  if(initial.alreadyConsumed||initial.appId!==process.env.RR_STAGING_FIREBASE_APP_ID)
   throw Error('appcheck_first_use_or_app_mismatch');
  statuses.push('APPCHECK_REAL_FIRST_CONSUME_PASS');
  const replay=await appCheck.verifyToken(limitedUseToken,{consume:true});
  if(replay.alreadyConsumed!==true)throw Error('appcheck_replay_not_denied');
  statuses.push('APPCHECK_REAL_REPLAY_DETECTED_PASS');

  const probe=buildReadOnlyOmiseTestProbe({
   fetchImpl:fetch,
   readTestSecret:async()=>readFileSync(process.env.RR_OMISE_TEST_SECRET_FILE,'utf8').trim(),
   timeoutMs:3500
  });
  const charge=await probe.readCharge(process.env.RR_OMISE_TEST_CHARGE_ID);
  if(charge.amount!==Number(process.env.RR_EXPECTED_AMOUNT_SATANG)||
      charge.uid!==process.env.RR_EXPECTED_ACCOUNT_ID||
      charge.requestId!==process.env.RR_EXPECTED_REQUEST_ID||
      charge.livemode!==false)
   throw Error('omise_test_evidence_mismatch');
  statuses.push('OMISE_READONLY_TEST_GET_MATCH_PASS');
  console.log('STAGING_PROBE_EVIDENCE:',statuses.join(','));
  console.log('STAGING_BROWSER_E2E: NOT_TESTED_BY_THIS_RUNNER');
  console.log('STAGING_APPROVAL: HUMAN_REVIEW_REQUIRED');
  console.log('STAGING_RELEASE: NO_GO_RELEASE');
 }catch(error){
  // Do not emit error objects: SDK/HTTP failure text may contain response secrets or tokens.
  console.error('STAGING_PROBE_FAILED: consult privately secured staging logs');
  process.exitCode=1;
 }finally{await app.delete()}
}
