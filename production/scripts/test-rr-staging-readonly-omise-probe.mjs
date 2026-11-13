import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {buildReadOnlyOmiseTestProbe}=require('../payment-functions/rr-staging-readonly-omise-probe.cjs');
const id='chrg_test_123456789Abc';
const charge={id,livemode:false,currency:'thb',amount:29900,status:'successful',paid:true,
 metadata:{uid:'demo_account',requestId:'demo_request'}};
const key='skey_test_1234567890abcdef';
function create(opts={}){
 const calls=[];
 const probe=buildReadOnlyOmiseTestProbe({
  readTestSecret:async()=>opts.key===undefined?key:opts.key,
  fetchImpl:async(url,options)=>{
   calls.push({url,options});
   if(opts.reject)throw opts.reject;
   return {ok:opts.ok??true,json:async()=>opts.charge??charge};
  },timeoutMs:opts.timeoutMs??500});
 return {probe,calls};
}
test('RR test probe only READ GET and exact Omise endpoint',async()=>{
 const f=create();const result=await f.probe.readCharge(id);
 assert.equal(result.amount,29900);assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].url,'https://api.omise.co/charges/'+id);
 assert.equal(f.calls[0].options.method,'GET');
 assert.equal(f.calls[0].options.redirect,'error');
 assert.equal(f.calls[0].options.body,undefined);
});
test('RR test probe denies live charge id before reading credentials',async()=>{
 const f=create();await assert.rejects(()=>f.probe.readCharge('chrg_live_123456789Abc'),/test_charge_id_only/);
 assert.equal(f.calls.length,0);
});
test('RR test probe denies live or malformed key before network call',async()=>{
 const f=create({key:'skey_live_1234567890abcdef'});
 await assert.rejects(()=>f.probe.readCharge(id),/test_secret_only/);
 assert.equal(f.calls.length,0);
});
test('RR test probe denies livemode true',async()=>{
 const f=create({charge:{...charge,livemode:true}});
 await assert.rejects(()=>f.probe.readCharge(id),/non_test_or_mismatched_charge/);
});
test('RR test probe denies mismatched charge id',async()=>{
 const f=create({charge:{...charge,id:'chrg_test_WRONG1234567'}});
 await assert.rejects(()=>f.probe.readCharge(id),/non_test_or_mismatched_charge/);
});
test('RR test probe denies provider HTTP failures',async()=>{
 const f=create({ok:false});await assert.rejects(()=>f.probe.readCharge(id),/provider_unavailable/);
});
test('RR test probe denies provider timeout',async()=>{
 const f=buildReadOnlyOmiseTestProbe({readTestSecret:async()=>key,
  fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(Object.assign(new Error('timeout'),{name:'AbortError'})),{once:true});
  }),timeoutMs:250});
 await assert.rejects(()=>f.readCharge(id),/provider_timeout/);
});
test('RR test probe refuses implicit global network or secret',()=>{
 assert.throws(()=>buildReadOnlyOmiseTestProbe({}),/explicit_dependencies_required/);
});
test('RR test probe rejects unbounded timeouts',()=>{
 assert.throws(()=>buildReadOnlyOmiseTestProbe({fetchImpl:async()=>{},readTestSecret:async()=>key,timeoutMs:60000}),/invalid_timeout/);
});
