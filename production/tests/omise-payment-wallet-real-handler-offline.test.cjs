'use strict';
// Offline test of the ACTUAL PACKTOOK reconcileCharge via omisePaymentStatus.
// Emulates Firestore transaction semantics in memory; never connects to any service.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
const UID='mock_customer_0000001',REQ='mock_billing_request0001',CHARGE='chrg_test_1234567890abcdef';
const deepcopy=x=>structuredClone(x);
function setup({chargeStatus='successful',paid=true,livemode=false,amount=29900,
 metadata=true,accountChange=null,plan='Basic',purchaseKind='new',pending=0,
 startingCredits=20,priorPaid=false}={}){
 const account={plan:'Free',period:'2026-11',used:0,reserved:pending,creditWalletV1:true,
  creditWalletRemaining:startingCredits,openBillingRequestId:REQ,billingVersion:0};
 if(accountChange)Object.assign(account,accountChange);
 const ticket={status:priorPaid?'paid':'payment_pending',omiseChargeId:CHARGE,
  requestedBy:UID,plan,amountTHB:299,purchaseKind,basePlan:'Free',baseBillingVersion:0,
  baseExpiresAt:null};
 const store=new Map([['accounts/'+UID,account],['accounts/'+UID+'/billingRequests/'+REQ,ticket]]);
 let providerGets=0,commits=0,audits=0;
 const field={
  serverTimestamp:()=>({__op:'timestamp'}),
  increment:n=>({__op:'increment',n}),
  delete:()=>({__op:'delete'})
 };
 function doc(key){
  return {id:key.split('/').at(-1),key,
   collection(name){return {doc(id){return doc(key+'/'+name+'/'+id)}}},
   async get(){return snap(key)},
   async update(patch){apply(key,patch)}
  };
 }
 function snap(key){return {exists:store.has(key),data:()=>deepcopy(store.get(key))}}
 function apply(key,patch){
  const old=store.get(key)||{},next=deepcopy(old);
  for(const [k,v] of Object.entries(patch)){
   if(v&&typeof v==='object'&&v.__op==='delete')delete next[k];
   else if(v&&typeof v==='object'&&v.__op==='increment')next[k]=(next[k]||0)+v.n;
   else next[k]=v;
  }
  store.set(key,next);
 }
 const db={
  collection(name){assert.equal(name,'accounts');return {doc(id){return doc(name+'/'+id)}}},
  async runTransaction(work){
   const ops=[];
   const tx={
    get:async ref=>snap(ref.key),
    update:(ref,patch)=>ops.push(()=>apply(ref.key,patch)),
    set:(ref,value)=>ops.push(()=>store.set(ref.key,deepcopy(value))),
    create:(ref,value)=>ops.push(()=>{store.set(ref.key,deepcopy(value));audits++;}),
    delete:ref=>ops.push(()=>store.delete(ref.key))
   };
   const result=await work(tx);
   for(const op of ops)op();
   commits++;
   return result;
  }
 };
 let auditSeq=0;
 const originalDoc=doc;
 // Audits use collection.doc() without an ID; derive deterministic generated IDs.
 const collectionFactory=key=>({doc(id){return originalDoc(key+'/'+(id||'AUTO_AUDIT_'+(++auditSeq)))}});
 function ref(key){const d=originalDoc(key);d.collection=name=>collectionFactory(key+'/'+name);return d}
 db.collection=name=>({doc:id=>ref(name+'/'+id)});
 const admin={initializeApp(){},firestore(){return db}};
 admin.firestore.FieldValue=field;
 class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details}}
 const sandbox={
  exports:{},Buffer,URLSearchParams,Date,Promise,console:{error(){},warn(){},log(){}},
  require:name=>{
   if(name==='firebase-functions/v2/https')return {onCall:(_o,cb)=>cb,onRequest:(_o,cb)=>cb,HttpsError};
   if(name==='firebase-functions/params')return {defineSecret:name=>({value:()=>name==='OMISE_SECRET_KEY'?'skey_test_MOCKONLY':''})};
   if(name==='firebase-admin')return admin;
   if(name==='node:crypto')return crypto;
   throw Error('UNEXPECTED_MODULE_'+name);
  },
  fetch:async(url,opts)=>{
   providerGets++;
   assert.equal(url,'https://api.omise.co/charges/'+CHARGE);
   assert.equal(opts.method,'GET');
   return {ok:true,json:async()=>({
    id:CHARGE,livemode,currency:'thb',amount,status:chargeStatus,paid,
    metadata:metadata?{uid:UID,requestId:REQ}:{uid:'wrong',requestId:'wrong'}
   })};
  }
 };
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../functions/index.js'),'utf8'),
  sandbox,{filename:'functions/index.js',timeout:3000});
 const req={auth:{uid:UID,token:{email_verified:true}},data:{requestId:REQ}};
 return {handler:sandbox.exports.omisePaymentStatus,req,
  account:()=>deepcopy(store.get('accounts/'+UID)),
  ticket:()=>deepcopy(store.get('accounts/'+UID+'/billingRequests/'+REQ)),
  counts:()=>({providerGets,commits,audits})};
}
test('paid synthetic charge upgrades Free to Basic and transfers unspent credits exactly once',async()=>{
 const h=setup();
 const first=await h.handler(h.req);
 assert.equal(first.status,'paid');
 assert.equal(first.creditsPurchased,300);
 assert.equal(first.transferredCredits,20);
 assert.equal(first.balanceAfter,320);
 assert.equal(h.account().creditWalletRemaining,320);
 assert.equal(h.account().plan,'Basic');
 assert.equal(h.account().billingVersion,1);
 assert.equal(h.ticket().status,'paid');
 assert.equal(h.counts().audits,1);
 const replay=await h.handler(h.req);
 assert.equal(replay.alreadyApplied,true);
 assert.equal(h.account().creditWalletRemaining,320);
 assert.equal(h.account().billingVersion,1);
 assert.equal(h.counts().audits,1);
});
test('provider pending must not activate or add credit',async()=>{
 const h=setup({chargeStatus:'pending',paid:false});
 const result=await h.handler(h.req);
 assert.equal(result.status,'pending');
 assert.equal(h.account().creditWalletRemaining,20);
 assert.equal(h.ticket().status,'payment_pending');
 assert.equal(h.counts().audits,0);
});
test('provider paid=false despite successful status must not activate',async()=>{
 const h=setup({chargeStatus:'successful',paid:false});
 const result=await h.handler(h.req);
 assert.equal(result.status,'successful');
 assert.equal(h.account().creditWalletRemaining,20);
 assert.equal(h.counts().audits,0);
});
test('provider amount mismatch blocks Firestore transaction',async()=>{
 const h=setup({amount:19900});
 await assert.rejects(h.handler(h.req),/Charge mismatch/);
 assert.equal(h.counts().commits,0); // provider mismatch rejects before transaction
 assert.equal(h.account().creditWalletRemaining,20);
 assert.equal(h.counts().audits,0);
});
test('provider metadata mismatch blocks activation',async()=>{
 const h=setup({metadata:false});
 await assert.rejects(h.handler(h.req),/Charge mismatch/);
 assert.equal(h.account().creditWalletRemaining,20);
});
test('live-mode response blocks activation',async()=>{
 const h=setup({livemode:true});
 await assert.rejects(h.handler(h.req),/Charge mismatch/);
 assert.equal(h.account().creditWalletRemaining,20);
});
test('billing revision changed: paid charge is sent to manual review, not credited',async()=>{
 const h=setup({accountChange:{billingVersion:1}});
 const result=await h.handler(h.req);
 assert.equal(result.status,'payment_review');
 assert.equal(h.ticket().status,'payment_review');
 assert.equal(h.account().creditWalletRemaining,20);
 assert.equal(h.counts().audits,1);
 const second=await h.handler(h.req);
 assert.equal(second.status,'payment_review');
 assert.equal(h.counts().audits,1);
});
test('outstanding reservation prevents credit transfer, requires review',async()=>{
 const h=setup({pending:1});
 const result=await h.handler(h.req);
 assert.equal(result.status,'payment_review');
 assert.equal(h.account().creditWalletRemaining,20);
 assert.equal(h.ticket().status,'payment_review');
});
