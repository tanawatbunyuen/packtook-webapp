'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
const crypto=require('node:crypto');
if(!admin.apps.length)admin.initializeApp();
const db=admin.firestore();
const region='asia-southeast1';
const error=(code,message)=>{throw new HttpsError(code,message);};
const checkOwner=r=>{
  if(!r.auth?.uid)error('unauthenticated','Please sign in');
  if(r.auth.token?.packtookPlatformOwner!==true)error('permission-denied','Platform Owner required');
  return r.auth.uid;
};
const validUid=uid=>{
  if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))error('invalid-argument','Invalid customer UID');
  return uid;
};
const validReason=value=>{
  if(typeof value!=='string'||value.trim().length<10||value.trim().length>300)error('invalid-argument','Reason must be 10-300 characters');
  return value.trim();
};
const validId=id=>{
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))error('invalid-argument','requestId must be UUID');
  return id.toLowerCase();
};
const cfg=()=>{
  const v={creditDoc:process.env.PACKTOOK_CREDIT_DOC,remainingField:process.env.PACKTOOK_REMAINING_FIELD,expiryDoc:process.env.PACKTOOK_EXPIRY_DOC,expiryField:process.env.PACKTOOK_EXPIRY_FIELD,planDoc:process.env.PACKTOOK_PLAN_DOC,planField:process.env.PACKTOOK_PLAN_FIELD,expiryStorage:process.env.PACKTOOK_EXPIRY_STORAGE||'timestamp'};
  for(const k of ['creditDoc','remainingField','expiryDoc','expiryField','planDoc','planField'])if(!v[k])error('failed-precondition','Missing Firestore mapping '+k);
  for(const k of ['creditDoc','expiryDoc','planDoc'])if(!v[k].includes('{uid}')||v[k].replace('{uid}','testuid').split('/').length%2!==0)error('failed-precondition','Invalid Firestore document mapping '+k);
  for(const k of ['remainingField','expiryField','planField'])if(!/^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$/.test(v[k]))error('failed-precondition','Invalid field mapping '+k);
  if(!['timestamp','iso','milliseconds'].includes(v.expiryStorage))error('failed-precondition','Invalid expiry storage');
  return v;
};
const get=(o,path)=>path.split('.').reduce((p,k)=>p?.[k],o);
const doc=(template,uid)=>db.doc(template.replaceAll('{uid}',uid));
const unlimited=plan=>['pro','pro_unlimited'].includes(String(plan||'').toLowerCase().trim());
const iso=value=>value?.toDate?.()?.toISOString?.()||(typeof value==='number'?new Date(value).toISOString():(typeof value==='string'?new Date(value).toISOString():null));
const asDate=s=>{
  if(typeof s!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s))error('invalid-argument','Use YYYY-MM-DD');
  const [y,m,d]=s.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d));
  if(y<2020||y>2100||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)error('invalid-argument','Invalid expiry date');
  return new Date(Date.UTC(y,m-1,d+1)-7*3600*1000);
};
const toStored=(date,v)=>v.expiryStorage==='timestamp'?admin.firestore.Timestamp.fromDate(date):v.expiryStorage==='iso'?date.toISOString():date.getTime();
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function wrap(fn){return onCall({region,maxInstances:10,timeoutSeconds:30,memory:'256MiB'},async req=>{
  try{return await fn(req);}catch(e){if(e instanceof HttpsError)throw e;console.error('owner-v59',e);error('internal','Unable to manage customer');}
});}
exports.ownerGetCustomerManageState=wrap(async r=>{
  checkOwner(r);const uid=validUid(r.data?.customerUid),v=cfg();
  const [c,e,p]=await Promise.all([doc(v.creditDoc,uid).get(),doc(v.expiryDoc,uid).get(),doc(v.planDoc,uid).get()]);
  if(!e.exists||!p.exists)error('not-found','Customer subscription not found');
  const plan=get(p.data(),v.planField);
  if(plan==null)error('failed-precondition','Plan field not found');
  const isPro=unlimited(plan),walletActive=c.exists&&c.data()?.creditWalletV1===true,balance=c.exists?get(c.data(),v.remainingField):null;
  if(walletActive&&!isPro&&(!Number.isSafeInteger(balance)||balance<0))error('failed-precondition','Remaining credits field mismatch');
  const expiryAt=iso(get(e.data(),v.expiryField));
  const email=(await admin.auth().getUser(uid).catch(()=>null))?.email||null;
  return {customerUid:uid,email,remainingCredits:isPro||!walletActive?null:balance,plan,expiryAt,unlimited:isPro,creditEditable:walletActive&&!isPro,active:!!expiryAt&&Date.parse(expiryAt)>Date.now()};
});
exports.ownerGrantVideoCredits=wrap(async r=>{
  const ownerUid=checkOwner(r),v=cfg(),uid=validUid(r.data?.customerUid),amount=r.data?.amount,reason=validReason(r.data?.reason),requestId=validId(r.data?.requestId);
  if(uid===ownerUid)error('permission-denied','Cannot adjust owner account');
  if(!Number.isSafeInteger(amount)||amount<1||amount>100000)error('invalid-argument','Amount must be an integer 1..100000');
  const fp=hash(['credit',uid,amount,reason]);
  return db.runTransaction(async tx=>{
    const balanceRef=doc(v.creditDoc,uid),planRef=doc(v.planDoc,uid),action=db.doc('ownerCustomerActions/'+requestId),history=db.doc('ownerCustomerActionsByUser/'+uid+'/events/'+requestId);
    const [previous,credit,plan]=await Promise.all([tx.get(action),tx.get(balanceRef),tx.get(planRef)]);
    if(previous.exists){const prev=previous.data();if(prev.ownerUid!==ownerUid||prev.fingerprint!==fp)error('already-exists','Request ID reused');return {...prev.result,replayed:true};}
    if(!credit.exists||!plan.exists)error('not-found','Customer balance or plan not found');
    const before=get(credit.data(),v.remainingField),p=get(plan.data(),v.planField);
    if(credit.data()?.creditWalletV1!==true)error('failed-precondition','Account wallet is inactive');
    if(credit.data()?.openBillingRequestId)error('failed-precondition','Pending billing request');
    if(!Number.isSafeInteger(before)||before<0||p==null)error('failed-precondition','Credit/plan field mismatch');
    if(unlimited(p))error('failed-precondition','Pro plan has unlimited videos');
    const after=before+amount;if(!Number.isSafeInteger(after))error('out-of-range','Balance overflow');
    const result={customerUid:uid,before,after,added:amount,requestId};
    const audit={customerUid:uid,ownerUid,operation:'grantCredits',amount,before,after,reason,requestId,fingerprint:fp,result,createdAt:admin.firestore.FieldValue.serverTimestamp()};
    tx.update(balanceRef,{[v.remainingField]:after});
    tx.create(action,audit);tx.create(history,audit);
    return result;
  });
});
exports.ownerUpdateCustomerExpiry=wrap(async r=>{
  const ownerUid=checkOwner(r),v=cfg(),uid=validUid(r.data?.customerUid),expiryDate=r.data?.expiryDate,reason=validReason(r.data?.reason),requestId=validId(r.data?.requestId),date=asDate(expiryDate);
  if(uid===ownerUid)error('permission-denied','Cannot adjust owner account');
  const fp=hash(['expiry',uid,expiryDate,reason]);
  return db.runTransaction(async tx=>{
    const ref=doc(v.expiryDoc,uid),action=db.doc('ownerCustomerActions/'+requestId),history=db.doc('ownerCustomerActionsByUser/'+uid+'/events/'+requestId);
    const [prev,docSnap]=await Promise.all([tx.get(action),tx.get(ref)]);
    if(prev.exists){const a=prev.data();if(a.ownerUid!==ownerUid||a.fingerprint!==fp)error('already-exists','Request ID reused');return {...a.result,replayed:true};}
    if(!docSnap.exists||get(docSnap.data(),v.expiryField)===undefined)error('failed-precondition','Expiry field not found');
    if(docSnap.data()?.openBillingRequestId)error('failed-precondition','Pending billing request');
    const before=iso(get(docSnap.data(),v.expiryField)),after=date.toISOString();
    const result={customerUid:uid,previousExpiryAt:before,expiryAt:after,requestId};
    const audit={customerUid:uid,ownerUid,operation:'setExpiry',before,after,reason,expiryDate,requestId,fingerprint:fp,result,createdAt:admin.firestore.FieldValue.serverTimestamp()};
    tx.update(ref,{[v.expiryField]:toStored(date,v)});
    tx.create(action,audit);tx.create(history,audit);
    return result;
  });
});
exports.ownerGetCustomerAdjustmentHistory=wrap(async r=>{
  checkOwner(r);const uid=validUid(r.data?.customerUid);
  const n=Math.max(1,Math.min(30,Math.floor(Number(r.data?.limit)||15)));
  const q=await db.collection('ownerCustomerActionsByUser/'+uid+'/events').orderBy('createdAt','desc').limit(n).get();
  return {events:q.docs.map(d=>{const o=d.data();return {requestId:d.id,operation:o.operation,amount:o.amount??null,before:o.before??null,after:o.after??null,reason:o.reason,createdAt:iso(o.createdAt),ownerUid:o.ownerUid};})};
});