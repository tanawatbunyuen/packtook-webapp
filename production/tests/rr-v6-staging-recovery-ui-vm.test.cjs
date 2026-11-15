'use strict';
// V6: exercise the actual firebase-staging/app.js recoverCredit() in a headless
// browser-like VM. All Firebase, filesystem, MediaRecorder, and dialogs are MOCKS.
// No camera, production, Omise, Staging account or persistent storage accessed.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../firebase-staging/app.js'),'utf8');
function between(a,b){
 const start=source.indexOf(a),end=source.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'Staging app section not found: '+a);
 return source.slice(start,end);
}
const recoverySource=between('async function recoverCredit(){','function showRecovery(){');
function run({server={status:'reserved'},file=null,confirmAnswer=false,
 folderName='packing',pendingFolder='packing',folderGranted=true,
 verified=true,serverError=null,localCreatedAt=Date.now()-40000}={}){
 const calls=[],logs=[],p={
  operationId:'mock_operation_0000000001',barcode:'MOCK-BC',
  folderName:pendingFolder,filename:'mock.webm',createdAt:localCreatedAt,
  seconds:10,timestamp:Date.now()-12000
 };
 const fakeFolder={
  name:folderName,
  async queryPermission(){return folderGranted?'granted':'prompt'},
  async getFileHandle(name){
   calls.push('fileLookup');
   if(!file){const e=Error('not found');e.name='NotFoundError';throw e}
   assert.equal(name,p.filename);
   return {async getFile(){return {size:file.size,lastModified:Date.now()}}};
  }
 };
 const api={
  async recordingStatus(op){calls.push('recordingStatus');assert.equal(op,p.operationId);
   if(serverError)throw serverError;
   return server},
  async finalize(op,success,detail){calls.push(success?'finalizeSuccess':'finalizeFailure');
   assert.equal(op,p.operationId);
   if(success){assert.equal(detail.filename,p.filename);assert.ok(detail.bytes>=1000)}
   return {status:success?'completed':'failed'};
  }
 };
 let currentPending=p;
 const globals={
  activeBarcode:'',ending:false,reservation:false,recordingOp:p.operationId,
  folder:fakeFolder,Date,Promise,
  pending:()=>currentPending,
  clearPending(){calls.push('clearPending');currentPending=null},
  credit:()=>api,
  async restoreFolder(){calls.push('restoreFolder')},
  toast(message){logs.push(message)},
  confirm(message){calls.push('confirmation');return confirmAnswer},
  async verifySavedVideo(){calls.push('verifyVideo');
    if(!verified)throw Error('Video decode failed');
    return {width:1280,height:720,frames:2}},
  async saveVideoHistory(){calls.push('saveHistory')},
  showRecovery(){calls.push('showRecovery')},
  async refreshRemoteQuota(){calls.push('refreshQuota')},
  updatePendingOperation(data){calls.push('phase:'+data.phase)},
  monthKey:()=> '2026-11',
  console:{error(){},warn(){},log(){}}
 };
 const ctx=vm.createContext(globals);
 vm.runInContext(recoverySource,ctx,{filename:'firebase-staging/app.js:recoverCredit',timeout:1000});
 return {run:()=>ctx.recoverCredit(),calls,logs,pending:()=>currentPending};
}
test('reserved with verified video: user approval finalizes success, never refunds',async()=>{
 const h=run({file:{size:4096},confirmAnswer:true});
 await h.run();
 assert.ok(h.calls.includes('verifyVideo'));
 assert.ok(h.calls.includes('finalizeSuccess'));
 assert.ok(!h.calls.includes('finalizeFailure'));
 assert.ok(h.calls.includes('saveHistory'));
 assert.equal(h.pending(),null);
});
test('reserved with unreadable video: never finalize or refund',async()=>{
 const h=run({file:{size:4096},verified:false,confirmAnswer:true});
 await h.run();
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
 assert.ok(h.pending());
});
test('reserved no file + user denies no-video confirmation: no refund',async()=>{
 const h=run({confirmAnswer:false});
 await h.run();
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
 assert.ok(h.pending());
});
test('reserved no file + user explicitly confirms: finalize false exactly once',async()=>{
 const h=run({confirmAnswer:true});
 await h.run();
 assert.deepEqual(h.calls.filter(x=>x==='finalizeFailure'),['finalizeFailure']);
 assert.ok(!h.calls.includes('finalizeSuccess'));
 assert.equal(h.pending(),null);
});
test('completed server record, missing file: preserve pending review',async()=>{
 const h=run({server:{status:'completed',file:{filename:'mock.webm'}}});
 await h.run();
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
 assert.ok(h.pending());
});
test('failed server with video evidence: do not silently erase pending',async()=>{
 const h=run({server:{status:'failed'},file:{size:4096}});
 await h.run();
 assert.ok(!h.calls.includes('clearPending'));
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
});
test('wrong folder denies recovery without server writes',async()=>{
 const h=run({pendingFolder:'original-folder',folderName:'other-folder',confirmAnswer:true});
 await h.run();
 assert.ok(!h.calls.includes('recordingStatus'));
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
});
test('missing folder read permission denies credit changes',async()=>{
 const h=run({folderGranted:false,confirmAnswer:true});
 await h.run();
 assert.ok(!h.calls.includes('recordingStatus'));
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
});
test('unknown server operation with no file: do not clear without explicit confirmation',async()=>{
 const h=run({serverError:{code:'functions/not-found'},confirmAnswer:false});
 await h.run();
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
 assert.ok(h.pending());
});
test('unknown server operation with no file: explicit confirmation clears local intent only',async()=>{
 const h=run({serverError:{code:'functions/not-found'},confirmAnswer:true});
 await h.run();
 assert.ok(h.calls.includes('clearPending'));
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
});
test('unknown server operation and a saved file: keep evidence',async()=>{
 const h=run({serverError:{code:'functions/not-found'},file:{size:4096},confirmAnswer:true});
 await h.run();
 assert.ok(h.pending());
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
});
test('transient server error: preserve pending and never refund',async()=>{
 const h=run({serverError:{code:'functions/unavailable',message:'network down'},confirmAnswer:true});
 await h.run();
 assert.ok(h.pending());
 assert.ok(!h.calls.some(x=>x.startsWith('finalize')));
});
