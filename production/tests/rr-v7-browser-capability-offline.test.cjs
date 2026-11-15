'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../scripts/rr-v7-browser-capability-console.js'),'utf8');
function run({hostname='packtook-staging.web.app',protocol='https:',camera=true,
 writer=true,history=true,firebase=true,codec=true}={}){
 const logs=[],calls=[];
 const browser={
  location:{hostname,protocol},
  navigator:{mediaDevices:camera?{getUserMedia(){calls.push('getUserMedia')}}:{}},
  window:{
    isSecureContext:true,
    MediaRecorder:class Recorder {
      static isTypeSupported(){calls.push('codecQuery');return codec}
    },
    showDirectoryPicker(){calls.push('directoryPicker')},
    PACKTOOK_VIDEO_WRITER:writer?{open(){calls.push('writerOpen')}}:null,
    PACKTOOK_VIDEO_HISTORY:history?{connect(){calls.push('historyConnect')}}:null,
    PACKTOOK_FIREBASE:firebase?{ready:true,reserve(){calls.push('firebaseReserve')}}:null,
    indexedDB:{open(){calls.push('indexedDBOpen')}}
  },
  console:{table(x){logs.push(x)},log(...x){logs.push(x)}},
  Set
 };
 const result=vm.runInNewContext(src,browser,{filename:'browser-capability.js',timeout:1200});
 return {result,logs,calls};
}
test('supported staging browser passes without opening camera or disk',()=>{
 const h=run();
 assert.ok(Object.values(h.result).every(x=>x==='PASS'));
 assert.deepEqual(h.calls.filter(x=>x!=='codecQuery'),[]);
});
test('wrong host blocks safely',()=>{
 const h=run({hostname:'packtook-prod-01.web.app'});
 assert.equal(h.result.STAGING_ORIGIN,'BLOCKED');
 assert.deepEqual(h.calls.filter(x=>x!=='codecQuery'),[]);
});
test('http staging blocks',()=> assert.equal(run({protocol:'http:'}).result.STAGING_ORIGIN,'BLOCKED'));
test('missing camera API blocks',()=> assert.equal(run({camera:false}).result.CAMERA_API,'BLOCKED'));
test('missing file writer blocks',()=>assert.equal(run({writer:false}).result.VIDEO_WRITER_BRIDGE,'BLOCKED'));
test('missing history bridge blocks',()=>assert.equal(run({history:false}).result.VIDEO_HISTORY_BRIDGE,'BLOCKED'));
test('Firebase bridge missing blocks',()=>assert.equal(run({firebase:false}).result.FIREBASE_BRIDGE_PRESENT,'BLOCKED'));
test('WebM unsupported blocks',()=>assert.equal(run({codec:false}).result.WEBM_SUPPORTED,'BLOCKED'));
test('never call getUserMedia, Firebase or file picker in all scenarios',()=>{
 for(const args of [{},{camera:false},{writer:false},{hostname:'localhost'},{codec:false}]){
  const h=run(args);
  assert.ok(h.calls.every(x=>x==='codecQuery'));
 }
});
