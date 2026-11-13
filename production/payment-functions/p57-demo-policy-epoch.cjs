'use strict';
// P57: isolated DEMO policy-epoch serialization prototype. NOT wired to P54.
const {assertDemoOnly}=require('./p54-recovery-backend-candidate.cjs');
const ROLE_KEYS=new Set(['finance','technical','owner']);
const valid=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{6,128}$/.test(x);
const deny=(reason)=>{throw Error('P57_DENIED:'+reason)};
function buildDemoPolicyEpoch({db,env=process.env}={}){
 assertDemoOnly(env);
 if(!db?.runTransaction||!db?.collection)deny('db_required');
 function policyRef(accountId,actorId,role){
  if(!valid(accountId)||!valid(actorId)||!ROLE_KEYS.has(role))deny('invalid_scope');
  return db.collection('accounts').doc(accountId)
    .collection('p57DemoRolePolicies').doc(role+'_'+actorId);
 }
 async function seed({accountId,actorId,role,active=true}){
  const ref=policyRef(accountId,actorId,role);
  await ref.create({accountId,actorId,role,active,epoch:1});
  return ref;
 }
 async function revoke({accountId,actorId,role,beforeCommit}){
  const ref=policyRef(accountId,actorId,role);
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)deny('policy_not_found');
   const p=snap.data();
   if(p.accountId!==accountId||p.actorId!==actorId||p.role!==role||
      !Number.isSafeInteger(p.epoch)||p.epoch<1)deny('policy_corrupt');
   if(beforeCommit)await beforeCommit();
   tx.update(ref,{active:false,epoch:p.epoch+1});
   return p.epoch+1;
  });
 }
 async function decision({accountId,actorId,role,requestId,expectedEpoch=1,beforeCommit}){
  if(!valid(requestId)||!Number.isSafeInteger(expectedEpoch)||expectedEpoch<1)
   deny('invalid_request');
  const ref=policyRef(accountId,actorId,role);
  const audit=db.collection('accounts').doc(accountId)
   .collection('p57DemoPolicyDecisions').doc(role+'_'+requestId);
  return db.runTransaction(async tx=>{
   const [snapshot,prior]=await Promise.all([tx.get(ref),tx.get(audit)]);
   if(!snapshot.exists)deny('policy_not_found');
   const p=snapshot.data();
   if(!p.active||p.epoch!==expectedEpoch||
      p.accountId!==accountId||p.actorId!==actorId||p.role!==role)
    deny('revoked_or_stale_epoch');
   if(prior.exists)return {outcome:'ALREADY_RECORDED'};
   // Only test synchronization. All policy reads are transaction reads.
   if(beforeCommit)await beforeCommit();
   tx.create(audit,{actorId,role,requestId,epoch:p.epoch,outcome:'DEMO_RECORDED_ONLY'});
   return {outcome:'DEMO_RECORDED_ONLY'};
  });
 }
 return Object.freeze({seed,revoke,decision});
}
module.exports={buildDemoPolicyEpoch};
