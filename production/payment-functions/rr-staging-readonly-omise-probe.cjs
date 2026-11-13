'use strict';
// Opt-in READ-ONLY Omise TEST-only candidate. No default network client,
// no production bindings, no credential discovery, no Firebase mutations.
const chargePattern=/^chrg_test_[A-Za-z0-9]{8,128}$/;
function reject(code){const error=new Error('RR_STAGING_DENIED:'+code);error.code=code;throw error}
function buildReadOnlyOmiseTestProbe({fetchImpl,readTestSecret,timeoutMs=3500}={}){
 if(typeof fetchImpl!=='function'||typeof readTestSecret!=='function')
  reject('explicit_dependencies_required');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<250||timeoutMs>10000)
  reject('invalid_timeout');
 return Object.freeze({async readCharge(chargeId){
  if(typeof chargeId!=='string'||!chargePattern.test(chargeId))
   reject('test_charge_id_only');
  const key=await readTestSecret();
  if(typeof key!=='string'||!/^skey_test_[A-Za-z0-9_]+$/.test(key))
   reject('test_secret_only');
  const url='https://api.omise.co/charges/'+chargeId;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(url,{
     method:'GET',redirect:'error',signal:controller.signal,
     headers:{Authorization:'Basic '+Buffer.from(key+':').toString('base64'),
       Accept:'application/json'}
   });
   if(!response||response.ok!==true||typeof response.json!=='function')
    reject('provider_unavailable');
   const charge=await response.json();
   if(!charge||charge.id!==chargeId||charge.livemode!==false
     ||String(charge.currency||'').toLowerCase()!=='thb')
    reject('non_test_or_mismatched_charge');
   return Object.freeze({id:charge.id,livemode:false,amount:charge.amount,
    currency:'thb',status:charge.status,paid:charge.paid,
    uid:charge.metadata?.uid??null,requestId:charge.metadata?.requestId??null});
  } catch(error){
   if(error?.name==='AbortError')reject('provider_timeout');
   throw error;
  } finally{clearTimeout(timeout)}
 }});
}
module.exports={buildReadOnlyOmiseTestProbe};
