'use strict';
const $=id=>document.getElementById(id);
const plans=[['Free',0,20,1],['Starter',199,50,1],['Basic',299,300,1],['Growth',599,1500,3],['Business',1290,5000,5],['Pro',1990,Infinity,10]];
const KEY='packtook-demo-v1';
function read(){try{return JSON.parse(localStorage.getItem(KEY))||{plan:'Free',logs:[]}}catch{return {plan:'Free',logs:[]}}}
let store=read(), stream=null,recorder=null,parts=[],folder=null,activeBarcode='',startMs=0,ticker=null,ending=false, reservation=false, recordingFailure='', currentWritable=null, lastVideoUrl=null, healthTimer=null, stopPromise=null, lastFrameTime=0, lastFrameSignature='', recoveryBusy=false;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){toast('บันทึกประวัติ Browser ไม่สำเร็จ: '+e.message)}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3800)}

const DB_NAME='packtook-v34-handles';
function handleDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('settings'))r.result.createObjectStore('settings')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveFolderHandle(h){const db=await handleDb();try{await new Promise((resolve,reject)=>{const t=db.transaction('settings','readwrite');t.objectStore('settings').put(h,'folder');t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}finally{db.close()}}
async function getSavedFolder(){const db=await handleDb();try{return await new Promise((resolve,reject)=>{const r=db.transaction('settings').objectStore('settings').get('folder');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}}
function updateHealth(text,cls=''){$('healthStatus').className='health-pill '+cls;$('healthStatus').textContent=text}
function streamGood(){return !!stream&&stream.getVideoTracks().some(t=>t.readyState==='live'&&t.enabled&&!t.muted)}
function clearHealth(){clearInterval(healthTimer);healthTimer=null}
function watchHealth(){clearHealth();healthTimer=setInterval(()=>{if(!stream)return;const track=stream.getVideoTracks()[0];if(!track||track.readyState!=='live'||track.muted){updateHealth('⚠ สัญญาณกล้องขัดข้อง','danger-health');if(activeBarcode&&!ending)void stopRecording('camera_lost');else if(!activeBarcode)void recoverCamera();return}if(activeBarcode){const delta=Date.now()-startMs;const state=recorder?.state;if(state!=='recording'||delta>0&&$('preview').readyState<2){updateHealth('⚠ ตรวจพบการบันทึกผิดปกติ','danger-health');if(!ending)void stopRecording('camera_lost')}else{updateHealth('● กำลังบันทึก','good-health')}}else{updateHealth('● กล้องพร้อมใช้งาน','good-health')}} ,3500)}
async function recoverCamera(){if(recoveryBusy||activeBarcode||!stream)return;recoveryBusy=true;try{stream.getTracks().forEach(t=>t.stop());stream=null;$('preview').srcObject=null;cameraState(false);clearHealth();updateHealth('กำลังเชื่อมต่อกล้องใหม่…');await openCamera();}finally{recoveryBusy=false}}
async function openCamera(){try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Browser ไม่รองรับกล้อง');const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:({480:854,720:1280,1080:1920}[Number($('videoQuality').value)]||1280)},height:{ideal:Number($('videoQuality').value)||720},frameRate:{ideal:24}},audio:false});stream=s;const settings=s.getVideoTracks()[0]?.getSettings()||{};$('actualQuality').textContent=`กล้องส่งภาพจริง ${settings.width||'?'} × ${settings.height||'?'} px (ขึ้นกับกล้อง)`;$('preview').srcObject=s;await $('preview').play().catch(()=>{});cameraState(true);updateHealth('● กล้องพร้อมใช้งาน','good-health');const track=s.getVideoTracks()[0];track?.addEventListener('ended',()=>{if(stream!==s)return;updateHealth('กล้องถูกตัดการเชื่อมต่อ','danger-health');if(activeBarcode)void stopRecording('camera_lost');else void recoverCamera()});watchHealth();toast('เชื่อมต่อกล้องสำเร็จ')}catch(e){cameraState(false);updateHealth('เปิดกล้องไม่สำเร็จ','danger-health');toast('เปิดกล้องไม่สำเร็จ: '+e.message)}}
async function restoreFolder(prompt=false){try{const h=await getSavedFolder();if(!h)return prompt&&toast('ไม่มีโฟลเดอร์ที่เคยบันทึกไว้');let permission=await h.queryPermission({mode:'readwrite'});if(permission!=='granted'&&prompt)permission=await h.requestPermission({mode:'readwrite'});folder=h;$('folderStatus').textContent=permission==='granted'?'โฟลเดอร์: '+h.name:'โฟลเดอร์เดิม: '+h.name+' (คลิกเชื่อมต่ออีกครั้งเพื่อให้สิทธิ์)';if(permission==='granted')toast('เชื่อมโฟลเดอร์เดิมแล้ว')}catch(e){if(prompt)toast('ไม่สามารถเชื่อมโฟลเดอร์เดิม: '+e.message)}}
function closePlayback(){const v=$('historyVideo');v.pause();v.removeAttribute('src');v.load();if(lastVideoUrl)URL.revokeObjectURL(lastVideoUrl);lastVideoUrl=null;$('videoPanel').hidden=true}
async function playHistory(log){closePlayback();try{if(!folder)await restoreFolder(false);if(!folder)throw Error('กรุณาเลือกโฟลเดอร์ที่มีวิดีโอก่อน');let perm=await folder.queryPermission({mode:'read'});if(perm!=='granted'){perm=await folder.requestPermission({mode:'read'});if(perm!=='granted')throw Error('ไม่ได้รับอนุญาตอ่านวิดีโอ')}const handle=await folder.getFileHandle(log.filename);const file=await handle.getFile();if(file.size<1000)throw Error('ไฟล์วิดีโอไม่มีข้อมูล');lastVideoUrl=URL.createObjectURL(file);$('historyVideo').src=lastVideoUrl;$('videoHeading').textContent='Video — '+log.barcode;$('videoInfo').textContent=log.filename+' • '+Math.round(file.size/1024/1024*100)/100+' MB';$('videoPanel').hidden=false;$('videoPanel').scrollIntoView({behavior:'smooth',block:'nearest'});await $('historyVideo').play().catch(()=>{})}catch(e){toast('เปิดวิดีโอไม่สำเร็จ: '+e.message+' — ตรวจสอบโฟลเดอร์และไฟล์เดิม')}}

function monthKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}
function used(){return store.logs.filter(v=>v.month===monthKey()).length}
function plan(){return plans.find(p=>p[0]===store.plan)||plans[0]}
function updateQuota(){const p=plan(),u=used(),unlimited=!Number.isFinite(p[2]);$('planName').textContent=p[0].toUpperCase();$('usedCount').textContent=u.toLocaleString();$('remainingCount').textContent=unlimited?'∞':Math.max(0,p[2]-u).toLocaleString();$('limitLabel').textContent=unlimited?'ไม่จำกัดวิดีโอ':`จาก ${p[2].toLocaleString()} วิดีโอ`;$('quotaText').textContent=unlimited?`${u.toLocaleString()} / ไม่จำกัด`:`${u.toLocaleString()} / ${p[2].toLocaleString()}`;$('quotaProgress').style.width=unlimited?'0%':`${Math.min(100,u/p[2]*100)}%`}
function showTab(tab){document.querySelectorAll('.tabcontent').forEach(e=>e.hidden=e.id!==tab);document.querySelectorAll('.nav').forEach(e=>e.classList.toggle('active',e.dataset.tab===tab));$('crumb').textContent=tab.toUpperCase();$('pageTitle').textContent={packing:'บันทึกวิดีโอการแพ็กสินค้า',dashboard:'ค้นหาประวัติวิดีโอ',plans:'แพ็กเกจและโควตาวิดีโอ',help:'คู่มือการใช้งาน'}[tab];if(tab==='dashboard'){renderHistory();void runRetention(false)}if(tab==='plans')renderPlans()}
function renderPlans(){ $('planGrid').innerHTML=plans.map(p=>`<article class="plan ${store.plan===p[0]?'selected':''}"><h4>${p[0]}</h4><div class="price">฿${p[1].toLocaleString()}<small style="font-size:12px;font-weight:400">/เดือน</small></div><p>${Number.isFinite(p[2])?p[2].toLocaleString():'ไม่จำกัด'} วิดีโอ / เดือน</p><p>${p[3]} เครื่อง</p><button class="${store.plan===p[0]?'secondary':'primary'}" data-plan="${p[0]}">${store.plan===p[0]?'แพ็กเกจปัจจุบัน':'ทดลองแพ็กเกจนี้'}</button></article>`).join('');document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{if(recorder&&recorder.state!=='inactive')return toast('หยุดการบันทึกก่อนเปลี่ยนแพ็กเกจ');store.plan=b.dataset.plan;persist();updateQuota();renderPlans();toast(`เปลี่ยนแพ็กเกจ Demo เป็น ${store.plan} (ไม่มีการชำระเงินจริง)`)})}
async function deleteRecordedVideo(log,ask=true){
 if(activeBarcode||ending){toast('หยุดการอัดก่อนลบวิดีโอ');return false}
 if(ask&&!confirm('ลบไฟล์ '+log.filename+' ออกจากคอมพิวเตอร์อย่างถาวร? การลบนี้ไม่คืนโควตาที่ใช้ไป'))return false;
 if(!folder)await restoreFolder(false);
 if(!folder){toast('กรุณาเลือกหรือเชื่อมโฟลเดอร์เดิมก่อนลบ');return false}
 let perm=await folder.queryPermission({mode:'readwrite'});
 if(perm!=='granted')perm=await folder.requestPermission({mode:'readwrite'});
 if(perm!=='granted'){toast('ไม่ได้รับสิทธิ์ลบไฟล์');return false}
 try{await folder.removeEntry(log.filename)}
 catch(e){toast('ลบไฟล์ไม่สำเร็จ: '+e.message);return false}
 if(!$('videoPanel').hidden)closePlayback();
 log.deleted=true;log.deletedAt=Date.now();persist();renderHistory();updateQuota();
 toast('ลบไฟล์แล้ว (ไม่คืนโควตา)');return true
}
let cleanupRunning=false;
async function runRetention(force=false){
 if(cleanupRunning||activeBarcode||ending)return;
 const days=Number(store.retentionDays||0);
 $('retentionStatus').textContent=days?('ตั้งค่าลบอัตโนมัติเมื่อเกิน '+days+' วัน; ทำงานเมื่อเปิดหน้า Dashboard และมีสิทธิ์โฟลเดอร์'):'ไม่ลบอัตโนมัติ';
 if(!days)return;
 const cutoff=Date.now()-days*86400000;
 const expired=store.logs.filter(x=>!x.deleted&&Number(x.timestamp)<cutoff);
 if(!expired.length){if(force)toast('ไม่พบวิดีโอหมดอายุ');return}
 if(!folder)await restoreFolder(false);
 if(!folder){toast('ต้องเชื่อมโฟลเดอร์เก็บวิดีโอเพื่อทำความสะอาด');return}
 if(force&&!confirm('ลบวิดีโอหมดอายุ '+expired.length+' ไฟล์อย่างถาวร? ไม่สามารถกู้คืนได้'))return;
 cleanupRunning=true;let removed=0;
 try{let perm=await folder.queryPermission({mode:'readwrite'});if(perm!=='granted'){if(force)perm=await folder.requestPermission({mode:'readwrite'});else{toast('กรุณากดเชื่อมโฟลเดอร์ เพื่ออนุญาตลบอัตโนมัติ');return}}
 if(perm!=='granted')return;
 for(const log of expired){try{await folder.removeEntry(log.filename);log.deleted=true;log.deletedAt=Date.now();removed++}catch(e){console.warn('Cleanup skipped',log.filename,e)}}
 persist();renderHistory();if(removed)toast('ลบวิดีโอหมดอายุแล้ว '+removed+' ไฟล์')
 }finally{cleanupRunning=false}
}
function renderHistory(){const date=$('dateFilter').value;const barcode=($('barcodeFilter').value||'').trim().toLowerCase();$('allVideos').textContent=store.logs.filter(x=>!x.deleted).length.toLocaleString();$('monthVideos').textContent=used().toLocaleString();const rows=store.logs.filter(x=>!x.deleted&&(!date||x.day===date)&&(!barcode||x.barcode.toLowerCase().includes(barcode))).sort((a,b)=>b.timestamp-a.timestamp);$('historyRows').replaceChildren();if(!rows.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent='ยังไม่มีวิดีโอที่ตรงกับเงื่อนไข';tr.append(td);$('historyRows').append(tr);return}rows.forEach(r=>{const tr=document.createElement('tr');[new Date(r.timestamp).toLocaleString('th-TH'),r.barcode,r.worker,`${r.seconds} วินาที`].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.append(td)});const td=document.createElement('td');const b=document.createElement('button');b.className='video-action';b.type='button';b.textContent='▶ เปิดวิดีโอ';b.title=r.filename;b.addEventListener('click',()=>playHistory(r));td.append(b);const del=document.createElement('button');del.type='button';del.className='video-delete';del.textContent='ลบไฟล์';del.addEventListener('click',()=>deleteRecordedVideo(r));td.append(' ',del);tr.append(td);$('historyRows').append(tr)})}
function safeFilename(s){return (s||'order').replace(/[^\w\-ก-๙]/g,'_').slice(0,70)}
function fmtSec(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function cameraState(on){$('noCam').hidden=on;$('cameraBtn').textContent=on?'ปิดกล้อง':'เปิดกล้อง';if(!activeBarcode)$('recBadge').textContent=on?'● CAMERA ON':'● CAMERA OFF'}
async function toggleCamera(){if(stream){if(activeBarcode)return toast('หยุดการบันทึกก่อนปิดกล้อง');clearHealth();stream.getTracks().forEach(t=>t.stop());stream=null;$('preview').srcObject=null;cameraState(false);updateHealth('● ปิดกล้องแล้ว');return}await openCamera()}
async function selectFolder(){try{if(!window.showDirectoryPicker)throw Error('รองรับ Chrome / Edge Desktop เท่านั้น');const h=await window.showDirectoryPicker({mode:'readwrite'});const perm=await h.requestPermission({mode:'readwrite'});if(perm!=='granted')throw Error('ไม่มีสิทธิ์เขียนโฟลเดอร์');folder=h;await saveFolderHandle(h);$('folderStatus').textContent='โฟลเดอร์ที่เลือก: '+h.name;toast('เลือกโฟลเดอร์สำเร็จ')}catch(e){toast('เลือกโฟลเดอร์ไม่สำเร็จ: '+e.message)}}
async function startRecording(barcode){if(ending||activeBarcode)return;if(Number.isFinite(plan()[2])&&used()>=plan()[2])return toast('โควตา Demo ครบแล้ว กรุณาเปลี่ยนแพ็กเกจ');if(!streamGood())return toast('กรุณาเปิดกล้องและตรวจสอบสัญญาณ');if(!folder)return toast('กรุณาเลือกโฟลเดอร์บันทึกก่อน');if(!window.MediaRecorder)return toast('Browser ไม่รองรับ MediaRecorder');try{let perm=await folder.queryPermission({mode:'readwrite'});if(perm!=='granted')return toast('กรุณาเชื่อมต่อโฟลเดอร์เดิมและให้สิทธิ์ก่อน');const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('Browser ไม่รองรับ WebM');parts=[];recordingFailure='';recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:({480:850000,720:1800000,1080:3500000}[Number($('videoQuality').value)]||1800000)});const rec=recorder;rec.ondataavailable=e=>{if(e.data?.size)parts.push(e.data)};rec.onerror=e=>{recordingFailure=e.error?.message||'MediaRecorder error';updateHealth('⚠ กล้องบันทึกผิดพลาด','danger-health');if(activeBarcode&&!ending)void stopRecording('recorder_error')};rec.start(1000);activeBarcode=barcode;startMs=Date.now();$('recordState').textContent='กำลังบันทึก '+barcode+' — สแกน Barcode เดิมเพื่อหยุด';$('recordState').classList.add('active');$('recBadge').textContent='● RECORDING';$('recBadge').classList.add('recording');$('stopBtn').disabled=false;$('recTimer').hidden=false;updateHealth('● กำลังบันทึก','good-health');ticker=setInterval(()=>$('recTimer').textContent='REC '+fmtSec(Math.floor((Date.now()-startMs)/1000)),1000);toast('เริ่มบันทึก '+barcode)}catch(e){activeBarcode='';toast('เริ่มบันทึกไม่สำเร็จ: '+e.message)}}
// Local file verification. A browser cannot prove the camera captured genuine packing;
// only confirm that saved WebM is decodable and sampled frames are not blank.
async function verifySavedVideo(file,expectedSeconds){
 const url=URL.createObjectURL(file),video=document.createElement('video');
 video.muted=true;video.playsInline=true;video.preload='auto';
 const timeout=(event,ms=9000)=>new Promise((resolve,reject)=>{
   let t=setTimeout(()=>{cleanup();reject(Error('ตรวจวิดีโอหมดเวลา: '+event))},ms);
   const ok=()=>{cleanup();resolve()},bad=()=>{cleanup();reject(Error('เปิดวิดีโอไม่ได้'))};
   function cleanup(){clearTimeout(t);video.removeEventListener(event,ok);video.removeEventListener('error',bad)}
   video.addEventListener(event,ok,{once:true});video.addEventListener('error',bad,{once:true})
 });
 const seek=async pos=>{
  if(pos>0&&Number.isFinite(video.duration)&&pos<video.duration){
   const event=timeout('seeked',8000);video.currentTime=pos;await event;
  }
  if(video.readyState<2)await timeout('loadeddata',9000);
  const canvas=document.createElement('canvas');canvas.width=48;canvas.height=27;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('ไม่สามารถตรวจภาพจากวิดีโอ');
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const pix=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let bright=0,max=0;
  for(let i=0;i<pix.length;i+=4){const l=(pix[i]+pix[i+1]+pix[i+2])/3;bright+=l;max=Math.max(max,l)}
  return {mean:bright/(pix.length/4),max};
 };
 try{
  if(file.size<1000)throw Error('ไฟล์วิดีโอมีขนาดเล็กผิดปกติ');
  video.src=url;video.load();
  if(video.readyState<1)await timeout('loadedmetadata');
  if(video.videoWidth===0||video.videoHeight===0)throw Error('วิดีโอไม่มีภาพ');
  if(Number.isFinite(video.duration)&&video.duration>0&&expectedSeconds>=3&&video.duration<Math.min(1,expectedSeconds*.35))throw Error('วิดีโอสั้นผิดปกติ');
  if(video.readyState<2)await timeout('loadeddata');
  const points=[0];
  if(Number.isFinite(video.duration)&&video.duration>1.5)points.push(Math.min(video.duration-.2,Math.max(.5,video.duration*.65)));
  const frames=[];
  for(const point of points)frames.push(await seek(point));
  if(frames.every(x=>x.mean<5&&x.max<16))throw Error('ตรวจพบวิดีโอภาพดำ');
  return {width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:null,frames:frames.length};
 }finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url)}
}
async function stopRecording(reason='manual'){if(!activeBarcode||!recorder||ending)return;ending=true;const rec=recorder;const code=activeBarcode;const begun=startMs;try{if(rec.state==='recording')try{rec.requestData()}catch{};if(rec.state!=='inactive'){await new Promise((resolve,reject)=>{let done=false;const timeout=setTimeout(()=>{if(!done){done=true;reject(Error('กล้องไม่ตอบสนองภายใน 10 วินาที'))}},10000);const settle=()=>{if(!done){done=true;clearTimeout(timeout);resolve()}};rec.addEventListener('stop',settle,{once:true});try{rec.stop()}catch(e){clearTimeout(timeout);reject(e)}})}if(recordingFailure)throw Error(recordingFailure);const blob=new Blob(parts,{type:'video/webm'});if(blob.size<1000)throw Error('ไฟล์วิดีโอว่างหรือข้อมูลไม่สมบูรณ์');const timestamp=Date.now(),seconds=Math.max(1,Math.round((timestamp-begun)/1000));const filename=`${safeFilename(code)}_${new Date(timestamp).toISOString().replace(/[:.]/g,'-')}.webm`;const handle=await folder.getFileHandle(filename,{create:true});currentWritable=await handle.createWritable();await currentWritable.write(blob);await currentWritable.close();currentWritable=null;const saved=await handle.getFile();if(saved.size!==blob.size)throw Error('ขนาดไฟล์ที่บันทึกไม่ตรงกัน');$('recordState').textContent='กำลังตรวจสอบไฟล์วิดีโอ…';const verified=await verifySavedVideo(saved,seconds);store.logs.push({month:monthKey(),day:new Date(timestamp).toLocaleDateString('en-CA'),timestamp,barcode:code,worker:$('worker').value.trim()||'Unknown',seconds,filename,quality:$('actualQuality').textContent,verified});persist();updateQuota();toast('✓ บันทึกสำเร็จ: '+filename+(reason==='camera_lost'?' (กล้องหลุด)': ''));}catch(e){updateHealth('⚠ บันทึกมีปัญหา','danger-health');toast('บันทึก/ตรวจสอบไม่ผ่าน: '+e.message+' — ไม่หักโควตา กรุณาตรวจไฟล์ที่บันทึกไว้ในโฟลเดอร์');if(currentWritable){try{await currentWritable.abort()}catch{}currentWritable=null}}finally{clearInterval(ticker);activeBarcode='';recorder=null;parts=[];ending=false;recordingFailure='';$('stopBtn').disabled=true;$('recTimer').hidden=true;$('recordState').classList.remove('active');$('recordState').textContent='พร้อมสแกน Barcode ถัดไป';$('recBadge').classList.remove('recording');$('recBadge').textContent=streamGood()?'● CAMERA ON':'● CAMERA OFF';if(reason==='camera_lost')void recoverCamera();else updateHealth(streamGood()?'● กล้องพร้อมใช้งาน':'● ยังไม่เปิดกล้อง',streamGood()?'good-health':'');$('barcode').focus()}}
$('loginForm').addEventListener('submit',e=>{e.preventDefault();if($('email').value.trim()==='demo@packtook.test'&&$('password').value==='DemoPacktook2026!'){$('loginPage').hidden=true;$('appPage').hidden=false;sessionStorage.setItem('packtook-demo-session','yes');updateQuota();showTab('packing');$('barcode').focus()}else{$('loginError').hidden=false;$('loginError').textContent='ข้อมูลบัญชี Demo ไม่ถูกต้อง'}});
$('showPassword').onclick=()=>{$('password').type=$('password').type==='password'?'text':'password'};
$('logout').onclick=()=>{if(activeBarcode)return toast('หยุดบันทึกก่อนออกจากระบบ');sessionStorage.removeItem('packtook-demo-session');$('appPage').hidden=true;$('loginPage').hidden=false;stream?.getTracks().forEach(t=>t.stop());stream=null;cameraState(false)};
document.querySelectorAll('[data-tab]').forEach(e=>e.onclick=()=>showTab(e.dataset.tab));$('cameraBtn').onclick=toggleCamera;$('folderBtn').onclick=selectFolder;$('stopBtn').onclick=stopRecording;$('focusScan').onclick=()=>$('barcode').focus();$('refreshHistory').onclick=renderHistory;$('dateFilter').onchange=renderHistory;
$('barcode').addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const code=$('barcode').value.trim();$('barcode').value='';if(!code){toast('กรุณาสแกนหรือพิมพ์ Barcode ก่อนกด Enter');return}if(ending||reservation){toast('ระบบกำลังดำเนินการ กรุณารอสักครู่');return}if(activeBarcode){if(code===activeBarcode)stopRecording();else toast('กำลังอัด '+activeBarcode+' ต้องสแกนรหัสเดิมเพื่อหยุด');return}reservation=true;startRecording(code).catch(e=>toast('เกิดข้อผิดพลาด: '+e.message)).finally(()=>{reservation=false;$('barcode').focus()})});
if(sessionStorage.getItem('packtook-demo-session')==='yes'){$('loginPage').hidden=true;$('appPage').hidden=false;updateQuota();showTab('packing');$('barcode').focus()}

$('barcodeFilter').addEventListener('input',renderHistory);
$('trialBtn').addEventListener('click',()=>{ $('email').value='demo@packtook.test';$('password').value='DemoPacktook2026!';$('loginForm').requestSubmit(); });

$('restoreFolder').addEventListener('click',()=>restoreFolder(true));
$('closeVideo').addEventListener('click',closePlayback);
window.addEventListener('pagehide',()=>{closePlayback();clearHealth();if(activeBarcode)console.warn('PACKTOOK: Browser page closed during recording; recording may not be saved')});
window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&stream&&!streamGood()){updateHealth('⚠ กรุณาตรวจสอบกล้อง','danger-health')}});
restoreFolder(false).catch(()=>{});

$('videoQuality').value=String(store.videoQuality||720);
$('videoQuality').addEventListener('change',async()=>{if(activeBarcode||ending){toast('เปลี่ยนความละเอียดระหว่างบันทึกไม่ได้');$('videoQuality').value=String(store.videoQuality||720);return}store.videoQuality=Number($('videoQuality').value);persist();if(stream){clearHealth();stream.getTracks().forEach(t=>t.stop());stream=null;$('preview').srcObject=null;cameraState(false);await openCamera()}});
$('retentionDays').value=String(store.retentionDays||0);
$('retentionDays').addEventListener('change',()=>{const v=Number($('retentionDays').value);if(v!==0&&!confirm('เปิดลบวิดีโออัตโนมัติเมื่อเกิน '+v+' วัน? ไฟล์จะถูกลบถาวรเมื่อเปิดหน้า Dashboard และ Browser ได้รับสิทธิ์โฟลเดอร์')){$('retentionDays').value=String(store.retentionDays||0);return}store.retentionDays=v;persist();void runRetention(false)});
$('runCleanup').addEventListener('click',()=>runRetention(true));

// Cleanup is best-effort while this web page is open; browsers cannot run local folder deletion while closed.
setInterval(()=>{if(sessionStorage.getItem('packtook-demo-session')==='yes'&&!document.hidden)void runRetention(false)},60*60*1000);
