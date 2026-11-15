'use strict';
// V6 offline source contracts for current PACKTOOK staging UI and Firebase bridge.
// Fail on missing critical ordering or API wiring. This is NOT a real browser/camera test.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'firebase-staging/app.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'firebase-staging/firebase-packing-bridge.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
function section(source,a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'source section missing: '+a);return source.slice(start,end)}
const start=section(app,'async function startRecording(barcode){','// Local file verification.');
const stop=section(app,"async function stopRecording(reason='manual'){","$('loginForm').addEventListener");
test('operation intent is persisted before reserve request',()=>{
 assert.ok(start.indexOf('setPendingOperation(op,barcode')<start.indexOf('credit().reserve(barcode,op)'));
});
test('writer opens only after successful Firebase reservation',()=>{
 assert.ok(start.indexOf("granted.status!=='reserved'")<start.indexOf('PACKTOOK_VIDEO_WRITER.open'));
});
test('recording begins only after writer opens and recorder constructed',()=>{
 assert.ok(start.indexOf('PACKTOOK_VIDEO_WRITER.open')<start.indexOf('new MediaRecorder'));
 assert.ok(start.indexOf('new MediaRecorder')<start.indexOf('rec.start(1000)'));
});
test('uncertain reserve outcome keeps operation intent',()=>{
 assert.match(start,/recordingStatus\(attemptedOperationId\)/);
 assert.match(start,/Deterministic server rejections/);
 assert.match(start,/keep operation intent for explicit recovery/);
});
test('never automatically refund once recording started',()=>{
 assert.match(stop,/NEVER finalize\(false\) automatically after REC has started/);
 assert.doesNotMatch(stop,/credit\(\)\.finalize\([^,]+,false/);
});
test('file finish and video verification precede successful Firebase finalize',()=>{
 const steps=['videoWriter.finish()','verifySavedVideo(saved,seconds)','credit().finalize(op,true'];
 let prior=-1;
 for(const step of steps){const at=stop.indexOf(step);assert.ok(at>prior,step);prior=at}
});
test('local pending intent clears only after server completion and history write',()=>{
 assert.ok(stop.indexOf("finalResult.status!=='completed'")<stop.indexOf('saveVideoHistory({'));
 assert.ok(stop.indexOf('saveVideoHistory({')<stop.indexOf('clearPending();showRecovery();'));
});
test('failed stop preserves partial evidence and recovery intent',()=>{
 assert.match(stop,/videoWriter\.preservePartial\(\)/);
 assert.match(stop,/updatePendingOperation\(\{phase:'needs_review'/);
});
test('barcode scanner starts and stops on same code and rejects different code',()=>{
 const key=section(app,"$('barcode').addEventListener('keydown'","function connectFirebaseUI()");
 assert.match(key,/code===activeBarcode\)stopRecording\(\)/);
 assert.match(key,/startRecording\(code\)/);
 assert.match(key,/if\(ending\|\|reservation\)/);
});
test('Firebase bridge binds reserve, finalize and status to callable endpoint',()=>{
 for(const functionName of ['reserveCredit','finalizeCredit','recordingStatus'])
  assert.ok(bridge.includes('api("'+functionName+'")'),functionName);
});
test('recover credit requires a readable original folder',()=>{
 const rec=section(app,'async function recoverCredit(){','function showRecovery(){');
 assert.match(rec,/folder\.queryPermission\(\{mode:'read'\}\)/);
 assert.match(rec,/folder\.name!==p\.folderName/);
});
test('backend finalize guards reserved and wallet reservation count',()=>{
 const handler=section(backend,'exports.finalizeCredit=onCall','// V5.2.1:');
 assert.match(handler,/r\.status!=="reserved"/);
 assert.match(handler,/a\.reserved<1/);
 assert.match(handler,/FieldValue\.increment\(1\)/);
});
