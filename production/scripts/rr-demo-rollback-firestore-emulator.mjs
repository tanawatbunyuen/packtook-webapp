/** RR62: rollback rehearsal ONLY in isolated Firebase Firestore emulator.
 * Leaves an immutable audit of what was simulated, and no production writes.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../payment-functions/index.js',import.meta.url));
const admin=require('firebase-admin');
for(const [name,value] of Object.entries({
 GCLOUD_PROJECT:'demo-packtook-v72',
 GOOGLE_CLOUD_PROJECT:'demo-packtook-v72',
 GCP_PROJECT:'demo-packtook-v72',
 FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',
 FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099'
}))assert.equal(process.env[name],value,name);
for(const name of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN',
 'PACKTOOK_PRODUCTION_PROJECT_ID','OMISE_SECRET_KEY'])
 assert.equal(process.env[name],undefined,name);
admin.initializeApp({projectId:'demo-packtook-v72'});
const db=admin.firestore();
const root=db.collection('rrDemoRollbackOnly').doc('isolated_case_001');
const data=root.collection('snapshots').doc('pilot_state');
const events=root.collection('audit');
const caseId='demo_case_001';
let passCount=0;const pass=s=>{passCount++;console.log('PASS RR_ROLLBACK '+s)};
try{
 await data.create({caseId,phase:'CLOSED',credits:77,provider:'SYNTHETIC',
 publicSignupClosed:true,accountBalanceUntouched:true,version:1});
 const initial=(await data.get()).data();
 assert.equal(initial.credits,77);assert.equal(initial.phase,'CLOSED');
 pass('baseline sandbox snapshot created');
 await db.runTransaction(async tx=>{
  const snap=await tx.get(data);
  assert.equal(snap.data().version,1);
  tx.update(data,{phase:'PILOT_SIMULATION',version:2});
  tx.create(events.doc('start'),{caseId,kind:'LOCAL_SIMULATION_START'});
 });
 const pilot=(await data.get()).data();
 assert.equal(pilot.phase,'PILOT_SIMULATION');assert.equal(pilot.version,2);
 pass('pilot stage change only in sandbox namespace');
 await db.runTransaction(async tx=>{
  const snap=await tx.get(data);
  if(snap.data().version!==2)throw Error('rollback_revision_changed');
  tx.update(data,{phase:'CLOSED',version:3});
  tx.create(events.doc('rollback'),{caseId,kind:'LOCAL_SIMULATION_ROLLBACK'});
 });
 const restored=(await data.get()).data();
 assert.equal(restored.phase,'CLOSED');assert.equal(restored.credits,77);
 assert.equal(restored.publicSignupClosed,true);assert.equal(restored.version,3);
 pass('rollback restores closed state and retains original credits');
 assert.equal((await events.get()).size,2);
 pass('start and rollback events remain audit visible');
 await assert.rejects(async()=>db.runTransaction(async tx=>{
  const snap=await tx.get(data);
  if(snap.data().version!==2)throw Error('rollback_revision_changed');
  tx.update(data,{phase:'PILOT_SIMULATION'});
 }),/rollback_revision_changed/);
 assert.equal((await data.get()).data().phase,'CLOSED');
 pass('stale rollback revision fails closed');
 const acct=await db.collection('accounts').doc(caseId).get();
 assert.equal(acct.exists,false);
 pass('real account, payment and grant namespaces never touched');
 console.log('RR_DEMO_ROLLBACK: '+passCount+'/6 PASS');
 console.log('RR_REAL_ROLLBACK_EXECUTED: false');
 console.log('RR_PRODUCTION_WRITES: 0');
 console.log('RR_RELEASE: NO_GO_RELEASE');
}finally{await admin.app().delete()}
