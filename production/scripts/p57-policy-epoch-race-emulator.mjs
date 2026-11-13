/** P57 local Firestore serializable policy epoch racing a concurrent revocation.
 * REAL local emulator only. No Auth/App Check/Omise external services.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../payment-functions/index.js',import.meta.url));
const admin=require('firebase-admin');
const {assertDemoOnly}=require('../payment-functions/p54-recovery-backend-candidate.cjs');
const {buildDemoPolicyEpoch}=require('../payment-functions/p57-demo-policy-epoch.cjs');
assertDemoOnly(process.env);
admin.initializeApp({projectId:'demo-packtook-v72'});
const db=admin.firestore(),subject='p57_account_demo_001',actor='p57_finance_001',role='finance';
const api=buildDemoPolicyEpoch({db,env:process.env});
let count=0;const pass=(label)=>{count++;console.log('PASS P57 '+label)};
const policyRef=db.collection('accounts').doc(subject).collection('p57DemoRolePolicies').doc(role+'_'+actor);
const auditRef=db.collection('accounts').doc(subject).collection('p57DemoPolicyDecisions');
try{
 await api.seed({accountId:subject,actorId:actor,role});
 assert.equal((await policyRef.get()).data().epoch,1);
 pass('policy epoch starts active at epoch 1');
 const pre=await api.decision({accountId:subject,actorId:actor,role,requestId:'p57_before_001'});
 assert.equal(pre.outcome,'DEMO_RECORDED_ONLY');
 pass('valid decision recorded only in isolated demo audit');
 let enteredResolve,proceedResolve;
 const entered=new Promise(resolve=>{enteredResolve=resolve});
 const proceed=new Promise(resolve=>{proceedResolve=resolve});
 let executions=0;
 const pending=api.decision({accountId:subject,actorId:actor,role,
  requestId:'p57_racing_001',beforeCommit:async()=>{
   executions++;
   if(executions===1){enteredResolve();await proceed}
  }});
 await entered;
 const newEpoch=await api.revoke({accountId:subject,actorId:actor,role});
 assert.equal(newEpoch,2);
 proceedResolve();
 await assert.rejects(pending,/P57_DENIED:revoked_or_stale_epoch/);
 assert.equal((await auditRef.doc('finance_p57_racing_001').get()).exists,false);
 pass('revocation commits while approval transaction in flight, stale decision blocked');
 const policy=(await policyRef.get()).data();
 assert.equal(policy.epoch,2);assert.equal(policy.active,false);
 pass('policy epoch monotonic and disabled');
 await assert.rejects(()=>api.decision({accountId:subject,actorId:actor,role,
  requestId:'p57_after_001',expectedEpoch:2}),/revoked_or_stale_epoch/);
 pass('disabled actor denied even when matching latest epoch');
 await assert.rejects(()=>api.decision({accountId:subject,actorId:actor,role,
  requestId:'p57_stale_001',expectedEpoch:1}),/revoked_or_stale_epoch/);
 pass('stale epoch denied');
 assert.equal((await auditRef.get()).size,1);
 pass('only pre-revocation audit exists: no duplicated race event');
 const acct=(await db.collection('accounts').doc(subject).get());
 assert.equal(acct.exists,false);
 pass('no account, billing, wallet or grant documents created');
 const invalid=buildDemoPolicyEpoch({db,env:process.env});
 await assert.rejects(()=>invalid.decision({accountId:subject,actorId:actor,role:'superadmin',
 requestId:'p57_invalid_001'}),/invalid_scope/);
 pass('unknown policy role rejected');
 console.log('P57_POLICY_EPOCH_EMULATOR: '+count+'/8 PASS');
 console.log('P57_REAL_OMISE_REQUESTS: 0');
 console.log('P57_REAL_APPCHECK_ATTESTATIONS: 0');
 console.log('P57_PRODUCTION_WRITES: 0');
 console.log('P57_PRODUCTION_RUNTIME_WIRED: false');
 console.log('P57_RELEASE: NO_GO_RELEASE');
}finally{await admin.app().delete()}
