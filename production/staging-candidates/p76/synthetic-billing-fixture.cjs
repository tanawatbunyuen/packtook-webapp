"use strict";
/* P76 test-only Omise simulator. Never invoke this from live Functions.
 * A receipt is verified only by a LOCAL TEST PROVIDER result, never client data.
 * No Omise credentials, network calls, or real payments.
 */
const PRICE_SATANG=29900;
const PLAN="Basic";
const CREDITS=300;
function createSyntheticBilling({db,FieldValue,clock=Date.now}){
 if(!db||!FieldValue)throw Error("P76_LOCAL_ONLY");
 const account=id=>db.collection("accounts").doc(id);
 const record=(id,key)=>account(id).collection("p76SyntheticPayments").doc(key);
 const validId=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{16,100}$/.test(x);
 async function createInvoice(id,key){
  if(!validId(id)||!validId(key))throw Error("P76_ID_INVALID");
  const ref=record(id,key);
  return db.runTransaction(async tx=>{
   const [a,p]=await Promise.all([tx.get(account(id)),tx.get(ref)]);
   if(!a.exists)throw Error("P76_ACCOUNT_NOT_ACTIVATED");
   if(p.exists)return {created:false,status:p.data().status};
   tx.create(ref,{status:"awaiting_payment",amountSatang:PRICE_SATANG,
    plan:PLAN,credits:CREDITS,createdAt:FieldValue.serverTimestamp()});
   return {created:true,status:"awaiting_payment"};
  });
 }
 async function applyProviderFixture(id,key,{providerVerified,amountSatang,testOnly=true}){
  if(testOnly!==true)throw Error("P76_REAL_PROVIDER_FORBIDDEN");
  if(!validId(id)||!validId(key))throw Error("P76_ID_INVALID");
  const ref=record(id,key),acc=account(id);
  return db.runTransaction(async tx=>{
   const [p,a]=await Promise.all([tx.get(ref),tx.get(acc)]);
   if(!p.exists||!a.exists)throw Error("P76_MISSING_RECORD");
   const invoice=p.data();
   if(invoice.status==="paid")return {idempotent:true,credited:false};
   if(invoice.status!=="awaiting_payment")throw Error("P76_INVALID_INVOICE_STATE");
   if(providerVerified!==true||amountSatang!==PRICE_SATANG)
    throw Error("P76_PAYMENT_NOT_CONFIRMED");
   const current=a.data();
   if(current.creditWalletV1!==true||!Number.isSafeInteger(current.creditWalletRemaining)||
      current.creditWalletRemaining<0)throw Error("P76_WALLET_INVALID");
   if(current.creditWalletRemaining+CREDITS>Number.MAX_SAFE_INTEGER)
    throw Error("P76_WALLET_OVERFLOW");
   tx.update(ref,{status:"paid",paidAt:FieldValue.serverTimestamp()});
   tx.update(acc,{plan:PLAN,
    planExpiresAt:new Date(clock()+30*86400000).toISOString(),
    creditWalletRemaining:current.creditWalletRemaining+CREDITS,
    updatedAt:FieldValue.serverTimestamp()});
   return {idempotent:false,credited:true};
  });
 }
 return Object.freeze({createInvoice,applyProviderFixture,PRICE_SATANG,CREDITS});
}
module.exports={createSyntheticBilling,PRICE_SATANG,CREDITS};
