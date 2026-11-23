'use strict';
// Synthetic loopback listener tests only; no actual Firebase or recovered code.
const http=require('node:http'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const script=path.join(__dirname,'p138-local-emulator-listener.cjs');
const env={
 PATH:process.env.PATH||'/usr/bin:/bin',HOME:'/tmp',NODE_ENV:'test',
 PACKTOOK_EMULATOR_ONLY:'1',GCLOUD_PROJECT:'demo-packtook-owner-security',
 GOOGLE_CLOUD_PROJECT:'demo-packtook-owner-security',FIREBASE_PROJECT_ID:'demo-packtook-owner-security',
 FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099'
};
function start(port){return new Promise((resolve,reject)=>{const server=http.createServer((_req,res)=>{res.statusCode=404;res.end('synthetic listener')});server.on('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server))})}
function stop(server){return new Promise(resolve=>server.close(resolve))}
function run(values=env){return new Promise((resolve,reject)=>{const p=cp.spawn(process.execPath,[script],{env:values});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',reject);p.on('close',status=>resolve({status,output}))})}
(async()=>{
 const one=await start(18080),two=await start(19099);
 try{
  const a=await run();assert.equal(a.status,0,a.output);assert.match(a.output,/P138_DECISION=LOCAL_LISTENERS_RESPOND_NOT_IMPORT_APPROVAL/);
  assert.match(a.output,/P138_REAL_FIREBASE_EMULATOR_IDENTITY=NOT_ATTESTED/);
  console.log('P138_SYNTHETIC_LOOPBACK_LISTENERS=PASS');
  const b=await run({...env,GOOGLE_APPLICATION_CREDENTIALS:'/tmp/placeholder'});
  assert.equal(b.status,1,b.output);assert.match(b.output,/P138_BLOCK=P137_DEMO_ENV_NOT_VERIFIED/);
  console.log('P138_CREDENTIAL_ENV_FAIL_CLOSED=PASS');
 }finally{await stop(two);await stop(one)}
 const c=await run();assert.equal(c.status,1,c.output);assert.match(c.output,/P138_DECISION=BLOCK_LOCAL_LISTENER_UNAVAILABLE/);
 console.log('P138_MISSING_LISTENERS_FAIL_CLOSED=PASS');
 console.log('P138_OFFLINE_FIXTURES=3/3_PASS');
})().catch(e=>{console.error(e.message);process.exitCode=1});
