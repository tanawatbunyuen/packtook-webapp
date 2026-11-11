// PACKTOOK V7.3 P1B — REAL handlers against isolated Auth + Firestore emulator.
// Source-adjacent execution only: save to production/scripts/packtook_v73_p1b_stress.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const PROJECT='demo-packtook-v72';
const fail=s=>{throw Error('SAFETY_BLOCK: '+s)};
if(process.argv.length!==2)fail('no CLI arguments');
for(const k of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','GCP_PROJECT']){
 if(process.env[k]!==PROJECT)fail(k+' must be exact demo project');
}
if(process.env.GOOGLE_APPLICATION_CREDENTIALS)fail('credential file forbidden');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099')fail('loopback emulator addresses required');
if(process.env.FIREBASE_CONFIG){let c;try{c=JSON.parse(process.env.FIREBASE_CONFIG)}catch{fail('FIREBASE_CONFIG is not demo JSON')};if(c.projectId!==PROJECT)fail('FIREBASE_CONFIG project mismatch')}
const root=new URL('../',import.meta.url),paths=['functions/index.js','functions/package.json','scripts/v72-isolated-emulators.firebase.json'];
for(const path of paths)if(!fs.existsSync(new URL(path,root)))fail('missing '+path);
const config=JSON.parse(fs.readFileSync(new URL(paths[2],root),'utf8'));
const e=config.emulators||{};
if(Object.keys(config).join(',')!=='emulators'||e.auth?.host!=='127.0.0.1'||e.auth?.port!==19099||e.firestore?.host!=='127.0.0.1'||e.firestore?.port!==18080||e.ui?.enabled!==false||e.functions||e.storage||e.database)fail('invalid isolated emulator config');
for(const port of [19099,18080]){const r=await fetch('http://127.0.0.1:'+port+'/',{signal:AbortSignal.timeout(5000)}).catch(()=>null);if(!r||![200,400,404].includes(r.status))fail('emulator not ready at '+port)}
const rq=createRequire(new URL(paths[1],root));
const admin=rq('firebase-admin');
admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),auth=admin.auth();
const bridge={collection:(...a)=>db.collection(...a),runTransaction:(cb,...a)=>db.runTransaction(async tx=>await cb(tx),{maxAttempts:15})};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const mocks={
 'firebase-functions/v2/https':{HttpsError,onCall:(_opts,handler)=>async req=>handler(req)},
 'firebase-functions/params':{defineSecret:()=>({value:()=>('a'.repeat(64))})},
 'firebase-functions/logger':{info(){}},
 'firebase-admin':{initializeApp:()=>admin.app(),firestore:Object.assign(()=>bridge,{FieldValue:admin.firestore.FieldValue}),auth:()=>auth},
 'node:crypto':crypto
};
const module={exports:{}};
const source=fs.readFileSync(new URL(paths[0],root),'utf8');
vm.runInNewContext(source,{module,exports:module.exports,Date,Buffer,console,process:{env:{
 PACKTOOK_PRODUCTION_PROJECT_ID:'packtook-prod-01',GCLOUD_PROJECT:'packtook-prod-01',GCP_PROJECT:'packtook-prod-01',
 PACKTOOK_V72_PILOT_ENABLED:'false',PACKTOOK_PUBLIC_SIGNUP_ENABLED:'false',PACKTOOK_PUBLIC_ACCESS_ENABLED:'false',
 PACKTOOK_PUBLIC_POLICIES_APPROVED:'false',PACKTOOK_V7_QA_ENABLED:'false'
}},require:(name)=>{if(!Object.hasOwn(mocks,name))fail('mock missing: '+name);return mocks[name]}},{filename:'production/functions/index.js',timeout:4000});
const fn=module.exports;
for(const n of ['reserveCredit','finalizeCredit','recoverStaleVideoReservation','usageStatus'])if(typeof fn[n]!=='function')fail('missing handler '+n);
const DEVICE='v73device_00000001',runTag=crypto.randomBytes(5).toString('hex');
let passes=0;
const op=(prefix)=>('v73_'+prefix+'_'+crypto.randomBytes(12).toString('hex'));
const request=(uid,data={})=>({auth:{uid,token:{email_verified:true,packtookProductionBeta:true}},data});
async function seed(label,{wallet=false}={}){
 const uid='v73_'+label+'_'+runTag;
 await auth.createUser({uid,email:`${uid}@example.invalid`,emailVerified:true});
 const ref=db.collection('accounts').doc(uid);
 const state={ownerUid:uid,plan:'Free',period:new Date().toISOString().slice(0,7),used:0,reserved:0,devices:[{id:DEVICE,name:'QA Device'}],creditWalletV1:wallet};
 if(wallet)Object.assign(state,{creditWalletRemaining:20,walletStartingCredits:20});
 await ref.set(state);return {uid,ref};
}
const reserve=(u,id,barcode)=>fn.reserveCredit({...request(u),data:{operationId:id,barcode,deviceId:DEVICE}});
const finalize=(u,id,success)=>fn.finalizeCredit({...request(u),data:{operationId:id,success,...(success?{filename:'verified-local.webm',bytes:5000}:{})}});
const recover=(u,id)=>fn.recoverStaleVideoReservation({...request(u),data:{operationId:id,confirmNoVideo:true}});
const usage=u=>fn.usageStatus(request(u));
const read=ref=>ref.get().then(s=>s.data());
async function check(name,run){await run();passes++;console.log('PASS '+name)}
async function settled(calls){return Promise.allSettled(calls.map(f=>f()))}
const success=x=>x.status==='fulfilled';
const errorCode=x=>x.status==='rejected'?(x.reason?.code||x.reason?.message):null;
const transient=x=>['aborted','deadline-exceeded','unavailable'].includes(x?.code);
async function settleWithRetry(calls){
 const res=await settled(calls);
 for(let i=0;i<res.length;i++)if(res[i].status==='rejected'&&transient(res[i].reason)){
  try{res[i]={status:'fulfilled',value:await calls[i]()}}
  catch(reason){res[i]={status:'rejected',reason}}
 }
 return res;
}
async function forceStale(ref,id){await ref.collection('recordings').doc(id).update({createdAt:admin.firestore.Timestamp.fromMillis(Date.now()-31*60*1000)})}
async function auditCount(ref,action){const docs=await ref.collection('audit').get();return docs.docs.filter(d=>d.data().action===action).length}
try{
 // A. Concurrent identical request: one real reservation, rest idempotent.
 const a=await seed('same');const id=op('same'),barcode='B-SAME-'+runTag;
 await check('A1 same operation x8: exactly one credit reserved',async()=>{
  const res=await settleWithRetry(Array.from({length:8},()=>()=>reserve(a.uid,id,barcode)));
  assert.equal(res.filter(success).length,8,JSON.stringify(res.map(errorCode)));
  assert.equal((await read(a.ref)).reserved,1);
  assert.equal(await auditCount(a.ref,'reserve'),1);
  assert.equal((await usage(a.uid)).remaining,19);
 });
 await check('A2 same-operation concurrent finalize x8: exactly one used',async()=>{
  const res=await settleWithRetry(Array.from({length:8},()=>()=>finalize(a.uid,id,true)));
  assert.equal(res.filter(success).length,8,JSON.stringify(res.map(errorCode)));
  const st=await read(a.ref);assert.equal(st.used,1);assert.equal(st.reserved,0);
  assert.equal(await auditCount(a.ref,'completed'),1);
  assert.equal((await usage(a.uid)).remaining,19);
 });
 // B. Quota pressure with unique operations; retries on transient contention are recorded.
 const b=await seed('quota');const ids=Array.from({length:24},(_,i)=>op('q'+i));let attempts=0;
 await check('B1 unique concurrent reserves: quota never exceeds 20',async()=>{
  const res=await settled(ids.map((id,i)=>()=>reserve(b.uid,id,'B-Q-'+i+'-'+runTag)));
  attempts=res.length;
  const st=await read(b.ref),docs=await b.ref.collection('recordings').get();
  assert.equal(st.used,0);assert.ok(st.reserved<=20&&st.reserved>=0);
  assert.equal(st.reserved,docs.size);assert.equal((await usage(b.uid)).remaining,20-st.reserved);
  assert.equal(await auditCount(b.ref,'reserve'),st.reserved);
  assert.ok(res.filter(success).length<=20);
  console.log('OBSERVE quota immediate successes='+res.filter(success).length+' transient/errors='+res.filter(x=>!success(x)).length);
 });
 await check('B2 retry remaining unique operations: bound by quota',async()=>{
  for(let i=0;i<ids.length;i++){
   try{await reserve(b.uid,ids[i],'B-Q-'+i+'-'+runTag)}
   catch(ex){assert.ok(['resource-exhausted','aborted','deadline-exceeded','unavailable'].includes(ex.code),String(ex?.code||ex));}
  }
  const st=await read(b.ref);assert.equal(st.reserved,20);
  assert.equal((await usage(b.uid)).remaining,0);
  assert.equal(await auditCount(b.ref,'reserve'),20);
 });
 // C. Duplicate recover of stale reservation. One refund only.
 const c=await seed('recover');const ci=op('recover');await reserve(c.uid,ci,'B-R-'+runTag);await forceStale(c.ref,ci);
 await check('C1 stale recovery x8: one terminal failure and one refund',async()=>{
  const res=await settleWithRetry(Array.from({length:8},()=>()=>recover(c.uid,ci)));
  assert.equal(res.filter(success).length,8,JSON.stringify(res.map(errorCode)));
  const st=await read(c.ref),record=(await c.ref.collection('recordings').doc(ci).get()).data();
  assert.equal(record.status,'failed');assert.equal(st.reserved,0);assert.equal(st.used,0);
  assert.equal((await usage(c.uid)).remaining,20);assert.equal(await auditCount(c.ref,'manual_stale_reservation_recovery'),1);
 });
 // D. Recover vs finalize on stale reservation: one terminal transition, never both.
 const d=await seed('race');const di=op('race');await reserve(d.uid,di,'B-F-'+runTag);await forceStale(d.ref,di);
 await check('D1 recover vs successful finalize: exactly one terminal outcome',async()=>{
  const res=await settled([()=>recover(d.uid,di),()=>finalize(d.uid,di,true)]);
  assert.ok(res.some(success),JSON.stringify(res.map(errorCode)));
  const st=await read(d.ref),rec=(await d.ref.collection('recordings').doc(di).get()).data();
  assert.ok(['completed','failed'].includes(rec.status));assert.equal(st.reserved,0);
  assert.equal(st.used,rec.status==='completed'?1:0);
  assert.equal((await usage(d.uid)).remaining,rec.status==='completed'?19:20);
  const audits=(await auditCount(d.ref,'manual_stale_reservation_recovery'))+(await auditCount(d.ref,'completed'));
  assert.equal(audits,1);
  console.log('OBSERVE race winner='+rec.status+', calls='+res.map(x=>x.status).join(','));
 });
 // E. Failed finalize and repeat retry cannot return credits twice.
 const e=await seed('failure');const ei=op('failure');await reserve(e.uid,ei,'B-E-'+runTag);
 await check('E1 failure finalize x8 and retry: credit returned once',async()=>{
  const res=await settleWithRetry(Array.from({length:8},()=>()=>finalize(e.uid,ei,false)));
  assert.equal(res.filter(success).length,8,JSON.stringify(res.map(errorCode)));
  const st=await read(e.ref);assert.equal(st.reserved,0);assert.equal(st.used,0);
  assert.equal((await usage(e.uid)).remaining,20);assert.equal(await auditCount(e.ref,'failed'),1);
  await assert.rejects(()=>finalize(e.uid,ei,true),x=>x.code==='failed-precondition');
 });
 // F. Wallet path validates explicit refund and no double wallet credit.
 const f=await seed('wallet',{wallet:true});const fi=op('wallet');await reserve(f.uid,fi,'B-W-'+runTag);await forceStale(f.ref,fi);
 await check('F1 wallet duplicate recover returns exactly one credit',async()=>{
  const results=await settleWithRetry(Array.from({length:5},()=>()=>recover(f.uid,fi)));
  assert.equal(results.filter(success).length,5,JSON.stringify(results.map(errorCode)));
  const st=await read(f.ref);assert.equal(st.reserved,0);assert.equal(st.creditWalletRemaining,20);
  assert.equal(await auditCount(f.ref,'manual_stale_reservation_recovery'),1);
 });

 const max=Number.MAX_SAFE_INTEGER;

 const g1=await seed('p10e_walletmax',{wallet:true});
 await g1.ref.update({reserved:max});
 await check('E1 wallet reserved overflow',async()=>{
  await assert.rejects(
   ()=>reserve(g1.uid,op('walletmax'),'E1-MAX'),
   x=>x.code==='failed-precondition');
  assert.equal((await g1.ref.collection('recordings').get()).size,0);
 });

 const g2=await seed('p10e_promax');
 await g2.ref.update({
  plan:'Pro',
  planExpiresAt:'2099-12-31T23:59:59Z',
  reserved:max
 });
 await check('E2 Pro reserved overflow',async()=>{
  await assert.rejects(
   ()=>reserve(g2.uid,op('promax'),'E2-MAX'),
   x=>x.code==='failed-precondition');
  assert.equal((await g2.ref.collection('recordings').get()).size,0);
 });

 const g3=await seed('p10e_legacyzero');
 const i3=op('legacyzero');
 await reserve(g3.uid,i3,'E3-LEGACY');
 await g3.ref.update({reserved:0});
 await check('E3 legacy finalize zero guard',async()=>{
  await assert.rejects(
   ()=>finalize(g3.uid,i3,true),
   x=>x.code==='failed-precondition');
  assert.equal((await read(g3.ref)).reserved,0);
  assert.equal(
   (await g3.ref.collection('recordings')
    .doc(i3).get()).data().status,'reserved');
  assert.equal(await auditCount(g3.ref,'completed'),0);
 });

 const g4=await seed('p10e_usedmax',{wallet:true});
 const i4=op('usedmax');
 await reserve(g4.uid,i4,'E4-USED');
 await g4.ref.update({used:max});
 await check('E4 wallet used overflow',async()=>{
  await assert.rejects(
   ()=>finalize(g4.uid,i4,true),
   x=>x.code==='failed-precondition');
  assert.equal(
   (await g4.ref.collection('recordings')
    .doc(i4).get()).data().status,'reserved');
 });

 const g5=await seed('p10e_refundmax',{wallet:true});
 const i5=op('refundmax');
 await reserve(g5.uid,i5,'E5-REFUND');
 await g5.ref.update({creditWalletRemaining:max});
 await check('E5 wallet refund overflow',async()=>{
  await assert.rejects(
   ()=>finalize(g5.uid,i5,false),
   x=>x.code==='failed-precondition');
  assert.equal(
   (await read(g5.ref)).creditWalletRemaining,max);
  assert.equal(
   (await g5.ref.collection('recordings')
    .doc(i5).get()).data().status,'reserved');
 });

 const g6=await seed('p10e_recovermax',{wallet:true});
 const i6=op('recovermax');
 await reserve(g6.uid,i6,'E6-RECOVER');
 await forceStale(g6.ref,i6);
 await g6.ref.update({creditWalletRemaining:max});
 await check('E6 stale recovery overflow',async()=>{
  await assert.rejects(
   ()=>recover(g6.uid,i6),
   x=>x.code==='failed-precondition');
  assert.equal(
   (await read(g6.ref)).creditWalletRemaining,max);
  assert.equal(
   (await g6.ref.collection('recordings')
    .doc(i6).get()).data().status,'reserved');
 });

 const g7=await seed('p10e_usedmaxreserve',{wallet:true});
 await g7.ref.update({used:max});
 await check('E7 reserve used overflow',async()=>{
  await assert.rejects(
   ()=>reserve(g7.uid,op('usedmax'),'E7-MAX'),
   x=>x.code==='failed-precondition');
  assert.equal(
   (await g7.ref.collection('recordings').get()).size,0);
 });

 const g8=await seed('p10e_nearmax',{wallet:true});
 const i8=op('nearmax');
 await reserve(g8.uid,i8,'E8-NEAR');
 await g8.ref.update({creditWalletRemaining:max-1});
 await check('E8 refund to maximum allowed',async()=>{
  const result=await finalize(g8.uid,i8,false);
  assert.equal(result.status,'failed');
  assert.equal(
   (await read(g8.ref)).creditWalletRemaining,max);
  assert.equal((await read(g8.ref)).reserved,0);
  assert.equal(await auditCount(g8.ref,'failed'),1);
 });

 console.log("P10E_RECORDING_BOUNDARY_CASES: 8/8 PASS");
 const result={mode:'V73_P1B_TRANSACTION_STRESS',project:PROJECT,passed:passes,quotaConcurrentRequests:attempts,realHandlers:true,firestoreEmulator:true,productionWrites:0,callableTransportMocked:true,appCheckVerified:false,liveTransactionVerified:false,decision:'NO_GO_CONTROLLED_PILOT'};
 console.log('=== P1B SUMMARY ===');console.log(JSON.stringify(result,null,2));
}catch(err){console.error('P1B FAIL',err.stack||err);process.exitCode=2}
finally{await admin.app().delete()}
