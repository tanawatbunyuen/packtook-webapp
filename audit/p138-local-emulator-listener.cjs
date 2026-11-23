'use strict';
// P138: GET-only liveness of loopback ports after P137 demo-only env preflight.
// Does NOT prove the listener is Firebase Emulator; never invokes real handlers.
const http=require('node:http');
const cp=require('node:child_process');
const path=require('node:path');
const guard=path.join(__dirname,'p137-emulator-isolation-preflight.cjs');
function preflight(){
 const p=cp.spawnSync(process.execPath,[guard],{env:process.env,encoding:'utf8',timeout:3000});
 return p.status===0&&p.stdout.includes('P137_CHECKS=8/8')&&p.stdout.includes('P137_DECISION=ENV_ISOLATION_PREFLIGHT_PASS_NOT_RUNTIME_PROOF');
}
function ping(port){
 return new Promise(resolve=>{
  let finished=false;
  const done=(label)=>{if(finished)return;finished=true;resolve(label)};
  const req=http.get({host:'127.0.0.1',port,path:'/',timeout:1500,
    agent:false,headers:{'Accept':'text/plain','User-Agent':'packtook-local-emulator-liveness-only'}},
    res=>{res.resume();res.on('end',()=>done('HTTP_RESPONSE'));res.on('error',()=>done('RESPONSE_ERROR'))});
  req.on('timeout',()=>{req.destroy();done('TIMEOUT')});
  req.on('error',()=>done('CONNECTION_FAILED'));
 });
}
async function main(){
 if(!preflight()){console.log('P138_BLOCK=P137_DEMO_ENV_NOT_VERIFIED');process.exitCode=1;return}
 const firestore=await ping(18080),auth=await ping(19099);
 console.log('P138_MODE=LOCAL_LOOPBACK_HTTP_GET_ONLY');
 console.log('P138_FIRESTORE_PORT_18080='+firestore);
 console.log('P138_AUTH_PORT_19099='+auth);
 console.log('P138_LISTENER_IDENTITY=UNVERIFIED');
 console.log('P138_REAL_FIREBASE_EMULATOR_IDENTITY=NOT_ATTESTED');
 console.log('P138_SOURCE_IMPORT=NO P138_HANDLER_INVOCATIONS=0 P138_CLOUD_CALLS=0 P138_DEPLOYS=0');
 const ready=firestore==='HTTP_RESPONSE'&&auth==='HTTP_RESPONSE';
 console.log('P138_DECISION='+(ready?'LOCAL_LISTENERS_RESPOND_NOT_IMPORT_APPROVAL':'BLOCK_LOCAL_LISTENER_UNAVAILABLE'));
 if(!ready)process.exitCode=1;
}
main().catch(()=>{console.log('P138_BLOCK=UNEXPECTED_RUNTIME');process.exitCode=1});
