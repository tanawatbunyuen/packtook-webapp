'use strict';
// V5: ACTUAL PACKTOOK recording credit handlers + Firestore Emulator transactions.
// No service deployment, no real provider, no real Firestore. Demo project only.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))
  throw Error('LOOPBACK_FIRESTORE_EMULATOR_REQUIRED');
if(process.env.GCLOUD_PROJECT!=='demo-packtook-v5-lifecycle' ||
   process.env.GOOGLE_APPLICATION_CREDENTIALS ||
   process.env.FIREBASE_TOKEN ||
   process.env.OMISE_SECRET_KEY)
  throw Error('DEMO_PROJECT_NO_CLOUD_CREDENTIALS_REQUIRED');
const admin=require('firebase-admin');
admin.initializeApp({projectId:process.env.GCLOUD_PROJECT});
const db=admin.firestore(),FieldValue=admin.firestore.FieldValue;
const DEVICE='v5_device_mock_0000001';
let seq=0;
const future=()=>new Date(Date.now()+30*86400000).toISOString();
class HttpsError extends Error{
 constructor(code,message,details){super(message);this.code=code;this.details=details}
}
const sandbox={
 exports:{},Buffer,URLSearchParams,Date,Promise,
 console:{log(){},warn(){},error(){}},
 require(name){
  if(name==='firebase-admin')return {
   initializeApp(){},
   firestore:Object.assign(()=>({
    collection:(...args)=>db.collection(...args),
    runTransaction:(fn,opts)=>db.runTransaction(tx=>Promise.resolve().then(()=>fn(tx)),opts)
   }),{FieldValue})
  };
  if(name==='firebase-functions/v2/https')
   return {onCall:(_opts,handler)=>handler,onRequest:(_opts,handler)=>handler,HttpsError};
  if(name==='firebase-functions/params')
   return {defineSecret:()=>({value:()=>{throw Error('OMISE_NOT_ALLOWED_IN_V5')}})};
  if(name==='node:crypto')return crypto;
  throw Error('UNEXPECTED_MODULE_'+name);
 },
 fetch:async()=>{throw Error('EXTERNAL_HTTP_FORBIDDEN')}
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../functions/index.js'),'utf8'),
 sandbox,{filename:'functions/index.js',timeout:4000});
async function harness({credits=5,reserved=0,plan='Business'}={}){
 const id='mock_v5_user_'+(++seq)+'_0000000000';
 const acc=db.collection('accounts').doc(id);
 const period=new Date().toISOString().slice(0,7);
 await acc.set({
  plan,planExpiresAt:future(),billingVersion:1,creditWalletV1:true,
  creditWalletRemaining:credits,walletStartingCredits:credits,
  devices:[{id:DEVICE,name:'Mock device'}],
  period,used:0,reserved,ownerUid:id
 });
 const invoke=(handler,data,uid=id)=>sandbox.exports[handler]({
  auth:{uid,token:{email_verified:true}},data
 });
 const rec=op=>acc.collection('recordings').doc(op);
 const state=async()=> (await acc.get()).data();
 const audits=async()=> (await acc.collection('audit').get()).docs.map(d=>d.data());
 const op=(suffix)=>'mock_v5_op_'+seq+'_'+suffix.padEnd(12,'0');
 const reserve=(operationId,barcode='BARCODE_'+operationId)=>invoke('reserveCredit',
  {deviceId:DEVICE,operationId,barcode});
 const finalize=(operationId,success)=>invoke('finalizeCredit',
  {operationId,success,...(success?{filename:'mock.mp4',bytes:4096}:{})});
 const recover=(operationId,confirmNoVideo=true)=>invoke('recoverStaleVideoReservation',
  {operationId,confirmNoVideo});
 return {id,acc,rec,state,audits,op,reserve,finalize,recover,invoke};
}
test('reserve then successful finalize uses one credit and never refunds on replay',async()=>{
 const h=await harness();
 const id=h.op('success');
 const r=await h.reserve(id);
 assert.equal(r.status,'reserved');
 assert.equal((await h.state()).creditWalletRemaining,4);
 assert.equal((await h.state()).reserved,1);
 const f=await h.finalize(id,true);
 assert.equal(f.status,'completed');
 assert.equal((await h.state()).creditWalletRemaining,4);
 assert.equal((await h.state()).reserved,0);
 assert.equal((await h.state()).used,1);
 const replay=await h.finalize(id,true);
 assert.equal(replay.idempotent,true);
 assert.equal((await h.state()).creditWalletRemaining,4);
 assert.deepEqual((await h.audits()).map(x=>x.action).sort(),['completed','reserve']);
});
test('reserve then failed recording returns exactly one credit',async()=>{
 const h=await harness(),id=h.op('failure');
 await h.reserve(id);
 assert.equal((await h.state()).creditWalletRemaining,4);
 const r=await h.finalize(id,false);
 assert.equal(r.status,'failed');
 const again=await h.finalize(id,false);
 assert.equal(again.idempotent,true);
 const a=await h.state();
 assert.equal(a.creditWalletRemaining,5);
 assert.equal(a.reserved,0);
 assert.equal(a.used,0);
 assert.deepEqual((await h.audits()).map(x=>x.action).sort(),['failed','reserve']);
});
test('same operation reserve is idempotent, no second debit',async()=>{
 const h=await harness(),id=h.op('same');
 await h.reserve(id);
 const replay=await h.reserve(id);
 assert.equal(replay.idempotent,true);
 assert.equal((await h.state()).creditWalletRemaining,4);
 assert.equal((await h.audits()).filter(x=>x.action==='reserve').length,1);
});
test('same barcode cannot start second recording without owner approval',async()=>{
 const h=await harness(),id=h.op('first'),id2=h.op('second');
 await h.reserve(id,'V5_SHARED_BARCODE');
 await h.finalize(id,true);
 await assert.rejects(h.reserve(id2,'V5_SHARED_BARCODE'),/Barcode already scanned or recorded/);
 assert.equal((await h.state()).creditWalletRemaining,4);
});
test('out of credits refuses reservation and never makes recording',async()=>{
 const h=await harness({credits:0}),id=h.op('no_credit');
 await assert.rejects(h.reserve(id),/Video credit balance exhausted/);
 assert.equal((await h.rec(id).get()).exists,false);
 assert.equal((await h.audits()).length,0);
});
test('finalizing an unknown recording fails closed',async()=>{
 const h=await harness();
 await assert.rejects(h.finalize(h.op('unknown'),true),/Reservation not found/);
 assert.equal((await h.state()).creditWalletRemaining,5);
});
test('stale recovery needs explicit user confirmation, even after age',async()=>{
 const h=await harness(),id=h.op('unconfirmed');
 await h.reserve(id);
 await age(h,id);
 await assert.rejects(h.recover(id,false),/Confirm that no usable recording/);
 assert.equal((await h.state()).creditWalletRemaining,4);
});
test('recovery refuses a reservation younger than 30 minutes',async()=>{
 const h=await harness(),id=h.op('young');
 await h.reserve(id);
 await assert.rejects(h.recover(id),/at least 30 minutes old/);
 assert.equal((await h.state()).creditWalletRemaining,4);
});
async function age(h,id){
 await h.rec(id).update({
  createdAt:admin.firestore.Timestamp.fromMillis(Date.now()-35*60*1000)
 });
}
test('stale recovery returns credit exactly once and closes recording',async()=>{
 const h=await harness(),id=h.op('stale');
 await h.reserve(id);
 await age(h,id);
 const result=await h.recover(id);
 assert.equal(result.status,'failed');
 assert.equal(result.creditReturned,true);
 const retry=await h.recover(id);
 assert.equal(retry.idempotent,true);
 const a=await h.state();
 assert.equal(a.creditWalletRemaining,5);
 assert.equal(a.reserved,0);
 assert.equal((await h.rec(id).get()).data().recoveryReason,'manual_stale_recovery');
 assert.equal((await h.audits()).filter(x=>x.action==='manual_stale_reservation_recovery').length,1);
});
test('completed video can never receive manual stale-recovery refund',async()=>{
 const h=await harness(),id=h.op('completed');
 await h.reserve(id);
 await h.finalize(id,true);
 await assert.rejects(h.recover(id),/already been finalized/);
 assert.equal((await h.state()).creditWalletRemaining,4);
});
test('conflicting finalize outcomes cannot both succeed or double-refund',async()=>{
 const h=await harness(),id=h.op('conflict');
 await h.reserve(id);
 const settled=await Promise.allSettled([h.finalize(id,true),h.finalize(id,false)]);
 assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
 const s=await h.state();
 assert.equal(s.reserved,0);
 const final=(await h.rec(id).get()).data().status;
 assert.ok(['failed','completed'].includes(final));
 assert.equal(s.creditWalletRemaining,final==='failed'?5:4);
 assert.equal((await h.audits()).filter(x=>['failed','completed'].includes(x.action)).length,1);
});
test('concurrent stale recovery attempts produce exactly one refund and audit',async()=>{
 const h=await harness(),id=h.op('recovery_race');
 await h.reserve(id); await age(h,id);
 const results=await Promise.allSettled(Array.from({length:4},()=>h.recover(id)));
 assert.ok(results.some(x=>x.status==='fulfilled'));
 const s=await h.state();
 assert.equal(s.creditWalletRemaining,5);
 assert.equal(s.reserved,0);
 assert.equal((await h.audits()).filter(x=>x.action==='manual_stale_reservation_recovery').length,1);
});
test('corrupt reserved count stops finalization without refund',async()=>{
 const h=await harness(),id=h.op('corrupt');
 await h.reserve(id);
 await h.acc.update({reserved:0});
 await assert.rejects(h.finalize(id,false),/Wallet reservation count mismatch/);
 assert.equal((await h.state()).creditWalletRemaining,4);
 assert.equal((await h.rec(id).get()).data().status,'reserved');
});
