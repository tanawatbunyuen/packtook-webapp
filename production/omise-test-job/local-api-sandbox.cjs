'use strict';
// Local-only disposable Omise Test API simulator. NEVER deploy or reuse as payment authority.
// API shape matches only what PACKTOOK's GET /charges/:id verifier needs.
const http=require('node:http');
const AUTH='Basic '+Buffer.from('skey_test_LOCAL_MOCK_ONLY:').toString('base64');
const ID='chrg_test_LOCALMOCK0001';
const ACCOUNT='local_test_account_001';
const REQUEST='local_test_request_001';
const MODES=new Set(['paid','pending','not_found','bad_key','bad_metadata','bad_amount','live_charge','bad_currency','provider_error']);
function fixture(mode){
 return {object:'charge',id:ID,amount:mode==='bad_amount'?19900:29900,
 currency:mode==='bad_currency'?'usd':'thb',
 livemode:mode==='live_charge',paid:mode!=='pending',status:mode==='pending'?'pending':'successful',
 metadata:{uid:mode==='bad_metadata'?'mismatched_account':ACCOUNT,requestId:REQUEST}};
}
function createLocalOmiseSandbox(mode='paid'){
 if(!MODES.has(mode))throw new Error('UNSUPPORTED_LOCAL_MOCK_MODE');
 const counts={requests:0,authorizedGets:0};
 const server=http.createServer((req,res)=>{
  counts.requests++;
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  function send(status,data){res.writeHead(status);res.end(JSON.stringify(data));}
  if(req.method!=='GET')return send(405,{object:'error',code:'method_not_allowed'});
  if(req.url!=='/charges/'+ID)return send(404,{object:'error',code:'not_found'});
  if(mode==='bad_key'||req.headers.authorization!==AUTH)return send(401,{object:'error',code:'authentication_failure'});
  counts.authorizedGets++;
  if(mode==='not_found')return send(404,{object:'error',code:'not_found'});
  if(mode==='provider_error')return send(500,{object:'error',code:'internal_error'});
  return send(200,fixture(mode));
 });
 return Object.freeze({server,counts,mode});
}
module.exports={createLocalOmiseSandbox,AUTH,ID,ACCOUNT,REQUEST,MODES};
