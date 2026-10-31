'use strict';
const $=id=>document.getElementById(id);
const plans=[['Free',0,20,1,'🌱','เริ่มต้น'],['Starter',199,50,1,'🚀','ร้านเริ่มเติบโต'],['Basic',299,300,1,'🛡️','ร้านค้าประจำ'],['Growth',599,1500,3,'📈','ยอดขายเติบโต'],['Business',1290,5000,5,'🏢','ทีมธุรกิจ'],['Pro',1990,Infinity,10,'👑','มืออาชีพ']];
const KEY='packtook-v4-staging-local-files';
let remoteQuota=null,recordingOp=null,remoteUser=null,finalizePending=false,accountRoleInfo=null;
const credit=()=>window.PACKTOOK_FIREBASE;
const pendingKey=()=>remoteUser?.uid?'packtook-pending-'+remoteUser.uid:null;
function pending(){try{return JSON.parse(localStorage.getItem(pendingKey())||'null')}catch{return null}}
function clearPending(){if(pendingKey())localStorage.removeItem(pendingKey())}

async function recoverCredit(){
 const p=pending();
 if(!p)return toast('ไม่พบรายการจองเครดิตค้าง');
 if(activeBarcode||ending)return toast('ต้องหยุดการบันทึกก่อนตรวจรายการ');
 try{
  const state=await credit().recordingStatus(p.operationId);
  if(state.status==='reserved'){
   const ok=confirm('พบเครดิตจองค้างของ '+p.barcode+'\\nตรวจสอบวิดีโอในเครื่องก่อน: หากวิดีโอถูกบันทึกสำเร็จ ห้ามยกเลิกเครดิตเพื่อหลีกเลี่ยงการใช้สิทธิ์โดยไม่หักเครดิต\\nยืนยันยกเลิกการจองและคืนเครดิตหรือไม่?');
   if(!ok)return;
   const result=await credit().finalize(p.operationId,false);
   if(result.status!=='failed')throw Error('Server ยังไม่ยืนยันการคืนเครดิต');
  }else if(state.status!=='completed'&&state.status!=='failed')throw Error('Server ส่งสถานะที่ไม่รู้จัก');
  clearPending();recordingOp=null;showRecovery();await refreshRemoteQuota();
  toast(state.status==='completed'?'ตรวจสอบแล้ว: ระบบหักเครดิตไปก่อนหน้านี้':'ตรวจสอบรายการและคืนเครดิตเรียบร้อย');
 }catch(e){toast('ตรวจสอบเครดิตค้างไม่สำเร็จ: '+e.message)}
}
function showRecovery(){
 let b=$('recoverCreditBtn');
 if(!b){b=document.createElement('button');b.id='recoverCreditBtn';b.type='button';b.className='secondary';b.textContent='⚠ ตรวจสอบเครดิตจองค้าง';b.onclick=recoverCredit;($('packing')||$('appPage')).prepend(b)}
 b.hidden=false;b.textContent=pending()?'⚠ ตรวจสอบเครดิตจองค้าง':'ตรวจสอบสถานะเครดิตจองค้าง';
}
async function renderDeviceManager(){
 let pane=$('deviceManager');
 if(!pane){pane=document.createElement('section');pane.id='deviceManager';pane.className='users-device-list';$('users').append(pane)}
 pane.replaceChildren();
 
 const loading=document.createElement('p');loading.textContent='กำลังโหลดอุปกรณ์...';pane.append(loading);
 try{
  const state=await credit().deviceStatus();loading.textContent='ใช้งาน '+state.devices.length+'/'+state.limit+' เครื่อง • เครื่องนี้: '+(state.registered?'ลงทะเบียนแล้ว':'ยังไม่ลงทะเบียน');
  for(const device of state.devices){
   const line=document.createElement('div');line.style.margin='8px 0';line.style.display='flex';line.style.alignItems='center';line.style.gap='8px';line.style.flexWrap='wrap';
   const label=document.createElement('span');label.textContent=device.name+(device.isCurrent?' (เครื่องนี้)':'')+' • '+(device.addedAt?new Date(device.addedAt).toLocaleDateString('th-TH'):'');
   const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='ถอดเครื่อง';remove.disabled=!!activeBarcode||ending;
   remove.addEventListener('click',async()=>{
    if(activeBarcode||ending)return toast('หยุด REC ก่อนจัดการอุปกรณ์');
    if(!confirm('ยืนยันถอด '+device.name+' ออกจากบัญชี? การถอดเครื่องไม่ลบวิดีโอในเครื่อง'))return;
    remove.disabled=true;
    try{await credit().removeDevice(device.id);await renderDeviceManager();await setupDevice().catch(()=>{});toast('ถอดเครื่องสำเร็จ')}catch(e){toast('ถอดเครื่องไม่สำเร็จ: '+e.message);remove.disabled=false}
   });line.append(label,remove);pane.append(line);
  }
  if(!state.registered){
   const register=document.createElement('button');register.type='button';register.className='secondary';register.textContent='ลงทะเบียน Browser นี้';register.onclick=async()=>{try{await setupDevice();await renderDeviceManager()}catch(e){toast(e.message)}};pane.append(register)
  }
 }catch(e){loading.textContent='โหลดรายชื่อเครื่องไม่ได้: '+e.message}
}
async function setupDevice(){
 const pane=$('deviceControl');
 let status;
 try{status=await credit().deviceStatus()}catch(e){pane.textContent='ตรวจสอบเครื่องไม่สำเร็จ: '+e.message;throw e}
 if(!status.registered){
  const name=(navigator.platform||'Computer')+' / '+(navigator.userAgent.includes('Edg/')?'Edge':'Chrome');
  try{await credit().registerDevice(name);status=await credit().deviceStatus()}catch(e){pane.textContent='ลงทะเบียนเครื่องไม่ได้ (อาจเกินจำนวนที่แพ็กเกจอนุญาต): '+e.message;throw e}
 }
 pane.textContent='เครื่องนี้ลงทะเบียนแล้ว • '+status.devices.length+'/'+status.limit+' เครื่อง';
}
function showDeviceControl(){
 let pane=$('deviceControl');if(!pane){pane=document.createElement('p');pane.id='deviceControl';pane.setAttribute('role','status');pane.style.margin='8px';pane.textContent='กำลังตรวจสอบสิทธิ์เครื่อง';$('users').append(pane)}
}
function updateUsersSummary(){
 if(!$('userPlanName'))return;
 const q=remoteQuota;
 $('userPlanName').textContent=q?.plan||'—';
 const expiry=q?.planExpiresAt;
 $('userPlanExpiry').textContent=expiry?new Date(expiry).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}):'ยังไม่ได้กำหนด';
 const stateText={expired:'แพ็กเกจหมดอายุ — ไม่สามารถจองเครดิตใหม่',active:'แพ็กเกจยังมีผลใช้งาน',invalid:'ข้อมูลวันหมดอายุไม่ถูกต้อง',free:'Free Plan — ไม่มีวันหมดอายุ',unconfigured:'ยังไม่มีข้อมูลวันหมดอายุที่ยืนยันจากระบบ'}; $('userPlanExpiryNote').textContent=stateText[q?.subscriptionStatus]||'ยังไม่ได้ตรวจสอบสถานะสมาชิก';
 $('userQuotaRemaining').textContent=q?(q.limit===null?'ไม่จำกัด':Number(q.remaining||0).toLocaleString('th-TH')):'—';
 $('userQuotaDetail').textContent=q?(q.walletEnabled?'เครดิตคงเหลือสะสมจากแพ็กเกจที่ซื้อ • ใช้แล้วในเดือนนี้ '+(q.used||0)+' • จองอยู่ '+(q.reserved||0):'ใช้แล้ว '+(q.used||0)+' • จองอยู่ '+(q.reserved||0)+' / เดือน '+q.period):'ไม่พบข้อมูลเครดิต';
 const renewal=$('userRenewalNotice');if(renewal){const eligible=q?.subscriptionStatus==='active'&&q?.canBuyMore;renewal.hidden=!eligible;renewal.textContent=eligible?(q.purchaseReason==='exhausted_topup'?'🎥 โควตาวิดีโอหมดแล้ว สามารถซื้อแพ็กเกจเดิมหรือสูงกว่าเพื่อเติมเครดิตผ่าน Packages':'🔔 แพ็กเกจเหลืออายุไม่เกิน 7 วัน สามารถต่ออายุแพ็กเกจเดิมผ่าน Packages'):'';}
}
async function refreshRemoteQuota(){if(!remoteUser)return;remoteQuota=await credit().usage();updateQuota();updateUsersSummary()}

function read(){try{return JSON.parse(localStorage.getItem(KEY))||{plan:'Free',logs:[]}}catch{return {plan:'Free',logs:[]}}}
let store=read(), stream=null,recorder=null,videoWriter=null,folder=null,activeBarcode='',startMs=0,ticker=null,ending=false, reservation=false, recordingFailure='', currentWritable=null, lastVideoUrl=null, healthTimer=null, stopPromise=null, lastFrameTime=0, lastFrameSignature='', recoveryBusy=false;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){toast('บันทึกประวัติ Browser ไม่สำเร็จ: '+e.message)}}

let historyReady=null,historyCursor=null,historyQueryId=0,historyLoading=false;
async function ensureVideoHistory(){
 if(!historyReady){
  historyReady=(async()=>{
   await window.PACKTOOK_VIDEO_HISTORY.connect();
   // Keep the legacy data untouched until the whole IndexedDB transaction commits.
   const previous=Array.isArray(store.logs)?store.logs:[];
   if(previous.length){await window.PACKTOOK_VIDEO_HISTORY.putMany(previous);store.logs=[];persist()}
  })().catch(e=>{historyReady=null;throw e});
 }
 return historyReady;
}
async function saveVideoHistory(row){
 try{await ensureVideoHistory();await window.PACKTOOK_VIDEO_HISTORY.put(row)}
 catch(e){
  console.error('IndexedDB history failure',e);
  // Emergency metadata fallback; never lose the file reference after credit finalization.
  store.logs=Array.isArray(store.logs)?store.logs:[];
  if(!store.logs.some(x=>x.filename===row.filename))store.logs.push(row);
  persist();
  toast('⚠ บันทึกประวัติ IndexedDB ไม่สำเร็จ: เก็บข้อมูลสำรองใน Browser แล้ว');
 }
}
function setPendingOperation(operationId,barcode,phase,filename){
 const key=pendingKey();if(!key)throw Error('ไม่พบบัญชีผู้ใช้สำหรับบันทึกสถานะ');
 localStorage.setItem(key,JSON.stringify({operationId,barcode,phase,filename,createdAt:Date.now()}));
}
function updatePendingOperation(patch){
 const p=pending(),key=pendingKey();
 if(p&&key)localStorage.setItem(key,JSON.stringify({...p,...patch}));
}

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3800)}

const DB_NAME='packtook-v34-handles';
function handleDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('settings'))r.result.createObjectStore('settings')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveFolderHandle(h){const db=await handleDb();try{await new Promise((resolve,reject)=>{const t=db.transaction('settings','readwrite');t.objectStore('settings').put(h,'folder');t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}finally{db.close()}}
async function getSavedFolder(){const db=await handleDb();try{return await new Promise((resolve,reject)=>{const r=db.transaction('settings').objectStore('settings').get('folder');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}}
function updateHealth(text,cls=''){$('healthStatus').className='health-pill '+cls;$('healthStatus').textContent=text}
function streamGood(){return !!stream&&stream.getVideoTracks().some(t=>t.readyState==='live'&&t.enabled&&!t.muted)}
function clearHealth(){clearInterval(healthTimer);healthTimer=null}
function watchHealth(){clearHealth();healthTimer=setInterval(()=>{if(!stream)return;if(ending){updateHealth('⏳ หยุด REC แล้ว • กำลังตรวจสอบไฟล์');return}const track=stream.getVideoTracks()[0];if(!track||track.readyState!=='live'||track.muted){updateHealth('⚠ สัญญาณกล้องขัดข้อง','danger-health');if(activeBarcode&&!ending)void stopRecording('camera_lost');else if(!activeBarcode)void recoverCamera();return}if(activeBarcode){const delta=Date.now()-startMs;const state=recorder?.state;if(state!=='recording'||delta>0&&$('preview').readyState<2){updateHealth('⚠ ตรวจพบการบันทึกผิดปกติ','danger-health');if(!ending)void stopRecording('camera_lost')}else{updateHealth('● กำลังบันทึก','good-health')}}else{updateHealth('● กล้องพร้อมใช้งาน','good-health')}} ,3500)}
async function recoverCamera(){if(recoveryBusy||activeBarcode||!stream)return;recoveryBusy=true;try{stream.getTracks().forEach(t=>t.stop());stream=null;$('preview').srcObject=null;cameraState(false);clearHealth();updateHealth('กำลังเชื่อมต่อกล้องใหม่…');await openCamera();}finally{recoveryBusy=false}}
async function openCamera(){try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Browser ไม่รองรับกล้อง');const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:({480:854,720:1280,1080:1920}[Number($('videoQuality').value)]||1280)},height:{ideal:Number($('videoQuality').value)||720},frameRate:{ideal:24}},audio:false});stream=s;const settings=s.getVideoTracks()[0]?.getSettings()||{};$('actualQuality').textContent=`กล้องส่งภาพจริง ${settings.width||'?'} × ${settings.height||'?'} px (ขึ้นกับกล้อง)`;$('preview').srcObject=s;await $('preview').play().catch(()=>{});cameraState(true);updateHealth('● กล้องพร้อมใช้งาน','good-health');const track=s.getVideoTracks()[0];track?.addEventListener('ended',()=>{if(stream!==s)return;updateHealth('กล้องถูกตัดการเชื่อมต่อ','danger-health');if(activeBarcode)void stopRecording('camera_lost');else void recoverCamera()});watchHealth();toast('เชื่อมต่อกล้องสำเร็จ')}catch(e){cameraState(false);updateHealth('เปิดกล้องไม่สำเร็จ','danger-health');toast('เปิดกล้องไม่สำเร็จ: '+e.message)}}
async function restoreFolder(prompt=false){try{const h=await getSavedFolder();if(!h)return prompt&&toast('ไม่มีโฟลเดอร์ที่เคยบันทึกไว้');let permission=await h.queryPermission({mode:'readwrite'});if(permission!=='granted'&&prompt)permission=await h.requestPermission({mode:'readwrite'});folder=h;$('folderStatus').textContent=permission==='granted'?'โฟลเดอร์: '+h.name:'โฟลเดอร์เดิม: '+h.name+' (คลิกเชื่อมต่ออีกครั้งเพื่อให้สิทธิ์)';if(permission==='granted')toast('เชื่อมโฟลเดอร์เดิมแล้ว')}catch(e){if(prompt)toast('ไม่สามารถเชื่อมโฟลเดอร์เดิม: '+e.message)}}
function closePlayback(){const v=$('historyVideo');v.pause();v.removeAttribute('src');v.load();if(lastVideoUrl)URL.revokeObjectURL(lastVideoUrl);lastVideoUrl=null;$('videoPanel').hidden=true}
async function playHistory(log){closePlayback();try{if(!folder)await restoreFolder(false);if(!folder)throw Error('กรุณาเลือกโฟลเดอร์ที่มีวิดีโอก่อน');let perm=await folder.queryPermission({mode:'read'});if(perm!=='granted'){perm=await folder.requestPermission({mode:'read'});if(perm!=='granted')throw Error('ไม่ได้รับอนุญาตอ่านวิดีโอ')}const handle=await folder.getFileHandle(log.filename);const file=await handle.getFile();if(file.size<1000)throw Error('ไฟล์วิดีโอไม่มีข้อมูล');lastVideoUrl=URL.createObjectURL(file);$('historyVideo').src=lastVideoUrl;$('videoHeading').textContent='Video — '+log.barcode;$('videoInfo').textContent=log.filename+' • '+Math.round(file.size/1024/1024*100)/100+' MB';$('videoPanel').hidden=false;$('videoPanel').scrollIntoView({behavior:'smooth',block:'nearest'});await $('historyVideo').play().catch(()=>{})}catch(e){toast('เปิดวิดีโอไม่สำเร็จ: '+e.message+' — ตรวจสอบโฟลเดอร์และไฟล์เดิม')}}

function monthKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}
function plan(){return plans.find(p=>p[0]===store.plan)||plans[0]}
function updateQuota(){const q=remoteQuota;const p=q?plans.find(x=>x[0]===q.plan)||plans[0]:plans[0];const u=q?.used??0,unlimited=q?.limit===null;const left=q?.remaining??0;$('planName').textContent=p[0].toUpperCase();$('usedCount').textContent=u.toLocaleString();$('remainingCount').textContent=unlimited?'∞':left.toLocaleString();$('limitLabel').textContent=unlimited?'ไม่จำกัดวิดีโอ':q?.walletEnabled?'เครดิตสะสมที่ใช้ได้':'เครดิตคงเหลือในเดือนนี้';$('quotaText').textContent=unlimited?'เครดิตไม่จำกัด':q?.walletEnabled?`เครดิตสะสมคงเหลือ ${left.toLocaleString('th-TH')} วิดีโอ จาก ${Number(q.walletStartingCredits||left).toLocaleString('th-TH')} เครดิตหลังซื้อล่าสุด`:`ใช้แล้ว ${u.toLocaleString('th-TH')} / ${(q?.limit??20).toLocaleString('th-TH')}`;$('quotaProgress').style.width=unlimited?'0%':q?.walletEnabled?`${Math.min(100,100*left/Math.max(1,q.walletStartingCredits||left||1))}%`:`${Math.min(100,u/(q?.limit||20)*100)}%`}

function showTab(tab){document.querySelectorAll('.tabcontent').forEach(e=>e.hidden=e.id!==tab);document.querySelectorAll('.nav').forEach(e=>e.classList.toggle('active',e.dataset.tab===tab));$('crumb').textContent=tab.toUpperCase();$('pageTitle').textContent={packing:'บันทึกวิดีโอการแพ็กสินค้า',dashboard:'ค้นหาประวัติวิดีโอ',plans:'แพ็กเกจและโควตาวิดีโอ',help:'คู่มือการใช้งาน',users:'จัดการผู้ใช้และอุปกรณ์'}[tab];if(tab==='dashboard'){renderHistory();void runRetention(false)}if(tab==='plans')renderPlans();if(tab==='users'){updateUsersSummary();void refreshRemoteQuota().catch(e=>toast(e.message));void renderDeviceManager()}}
async function verifyAfterPaymentReturn(){
 if(new URLSearchParams(location.search).get('payment')!=='return')return;
 showTab('plans');
 const container=$('paymentQrResult');container.replaceChildren();
 const status=document.createElement('p');status.textContent='กลับจากหน้าชำระเงินแล้ว กำลังตรวจสอบสถานะจาก Omise (Test Mode) — การกลับหน้าเว็บไม่ได้หมายความว่าชำระสำเร็จ';container.append(status);
 try{
  const overview=await credit().subscriptionOverview();
  const pending=overview.requests.filter(x=>['payment_pending','creating_charge'].includes(x.status));
  for(const item of pending){
   try{const result=await credit().omisePaymentStatus(item.id);if(result.status==='paid')status.textContent='ยืนยันการชำระเงินแล้ว แพ็กเกจอัปเดตจาก Firebase';else status.textContent='สถานะการชำระเงิน: '+result.status+' — ยังไม่มีการยืนยันชำระสำเร็จ'}catch(e){status.textContent='ยังตรวจสอบการชำระเงินไม่ได้: '+e.message}
  }
  if(!pending.length)status.textContent='ไม่พบรายการค้างตรวจสอบ กรุณาตรวจประวัติชำระเงินใน Packages';
  await refreshRemoteQuota();await renderSubscriptionRequests();
 }catch(e){status.textContent='การตรวจสถานะมีปัญหา: '+e.message}
 history.replaceState(null,'',location.pathname);
}
function displayOmiseQR(uri){
 const url=new URL(uri);
 if(url.protocol!=="https:"||!(url.hostname==="api.omise.co"||url.hostname.endsWith(".omise.co")))throw Error("URL รูป QR ไม่ปลอดภัย");
 const container=$('paymentQrResult');container.replaceChildren();
 const label=document.createElement('p');label.textContent='PromptPay QR จาก Omise (Test Mode)';
 const img=document.createElement('img');img.src=url.href;img.alt='PromptPay QR (Test)';img.style.maxWidth='280px';
 container.append(label,img);container.scrollIntoView({behavior:'smooth',block:'center'});
}
async function startOmiseUI(id,method,amountTHB){
 if(method!=='promptpay'){toast('ขณะนี้รองรับเฉพาะการชำระผ่าน PromptPay QR Code');return}
 if(!confirm('สร้าง QR Code ผ่าน Omise TEST MODE สำหรับแพ็กเกจราคา ฿'+Number(amountTHB).toLocaleString('th-TH')+'? ยังไม่มีการเก็บเงินจริง'))return;
 try{
  const result=await credit().startOmisePayment(id,'promptpay');
  if(result.qrImage){if(subscriptionHistoryDialog()?.open)subscriptionHistoryDialog().close();displayOmiseQR(result.qrImage)}
  toast('สถานะ Omise: '+result.status);
  await renderSubscriptionRequests();
 }catch(e){toast('Omise: '+e.message)}
}
async function testPaidRecheck(requestId,button){
 button.disabled=true;button.textContent='กำลังทดสอบ 3 ครั้ง…';
 try{
  const before=await credit().subscriptionOverview();
  const results=[];
  for(let i=0;i<3;i++){
   const response=await credit().omisePaymentStatus(requestId);
   results.push(response.status);
  }
  const after=await credit().subscriptionOverview();
  const unchanged=before.plan===after.plan&&before.expiresAt===after.expiresAt&&before.remaining===after.remaining;
  const allPaid=results.every(v=>v==='paid');
  const passed=allPaid&&unchanged;
  const text='Payment Recheck: '+(passed?'PASS':'FAIL')+'\\n3 calls: '+results.join(', ')+'\\nExpiry before: '+(before.expiresAt||'none')+'\\nExpiry after: '+(after.expiresAt||'none')+'\\nPlan before/after: '+before.plan+' / '+after.plan+'\\nCredits before/after: '+before.remaining+' / '+after.remaining;
  alert(text);
  if(!passed)toast('ตรวจสอบซ้ำไม่ผ่าน กรุณาส่งผลให้ตรวจโค้ด');
  await refreshRemoteQuota();
  await renderSubscriptionRequests();
 }catch(e){alert('ทดสอบไม่สำเร็จ: '+e.message)}
 finally{button.disabled=false;button.textContent='ทดสอบตรวจซ้ำ 3 ครั้ง'}
}

const subscriptionLabels={
 free:'Free Plan',active:'ใช้งานอยู่',expired:'หมดอายุ',
 unconfigured:'ยังไม่ได้กำหนดวันหมดอายุ',invalid:'ตรวจสอบข้อมูลบัญชี'
};
const subscriptionRequestNames={new:'สมัคร',renewal:'ต่ออายุ',upgrade:'อัปเกรด',exhausted_topup:'เติมเครดิต'};
const subscriptionRequestStates={
 pending_payment_setup:['รอสร้าง QR','pending'],creating_charge:['กำลังสร้างรายการ','pending'],
 payment_pending:['รอชำระเงิน','pending'],payment_review:['รอตรวจสอบ','review'],
 paid:['ชำระแล้ว','paid'],failed:['ชำระเงินไม่สำเร็จ','muted'],
 expired:['รายการชำระหมดอายุ','muted'],cancelled:['ยกเลิกแล้ว','muted']
};
let subscriptionDashboardData=null;
let billingHistoryCursor=null,billingHistoryBusy=false;
function subscriptionNode(tag,className,value){
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(value!==undefined&&value!==null)el.textContent=String(value);
 return el;
}
function subscriptionButton(label,fn,extraClass='secondary'){
 const b=subscriptionNode('button',extraClass,label);b.type='button';b.addEventListener('click',fn);return b;
}
function subscriptionDate(value){
 if(!value)return 'ไม่ระบุ';
 const parsed=new Date(value);
 return Number.isFinite(parsed.getTime())?parsed.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'ไม่ระบุ';
}
function subscriptionStatusBadge(status){
 const state=subscriptionRequestStates[status]||[status||'ไม่ทราบสถานะ','muted'];
 return subscriptionNode('span','sub-state-chip sub-state-'+state[1],state[0]);
}
function subscriptionAudit(id,button){
 button.disabled=true;
 return credit().paymentAudit(id).then(a=>{
  const ok=a.status==='paid'&&a.providerStatus==='successful'&&a.providerPaid&&a.providerTest&&a.amountMatches;
  const msg=[
   'PAYMENT AUDIT: '+(ok?'PASS':'REVIEW'),
   'แพ็กเกจ: '+(a.plan||'—'),
   'สถานะ Omise: '+(a.providerStatus||'—'),
   'ยอดเงินตรงกัน: '+a.amountMatches,
   'ชำระเมื่อ: '+(a.paidAt||'ไม่ทราบ'),
   'เครดิตใหม่: '+(a.creditsPurchased??'ไม่มีข้อมูล'),
   'เครดิตเดิมที่โอนมา: '+(a.transferredCredits??'ไม่มีข้อมูล'),
   'เครดิตรวมหลังซื้อ: '+(a.balanceAfter??'ไม่มีข้อมูล'),
   'วันหมดอายุก่อนซื้อ: '+(a.expiryBefore||'ไม่มีข้อมูล'),
   'วันหมดอายุหลังซื้อ: '+(a.activationExpiresAt||'ไม่มี Snapshot ธุรกรรมเก่า'),
   'แพ็กเกจปัจจุบัน: '+(a.currentPlan||'—'),
   'วันหมดอายุปัจจุบัน: '+(a.currentExpiresAt||'—')
  ];
  alert(msg.join('\n'));
 }).catch(e=>toast('Payment Audit: '+e.message)).finally(()=>{button.disabled=false});
}
async function subscriptionRefreshAfterAction(){
 await refreshRemoteQuota();
 renderPlans();
}
function subscriptionRequestActions(x,details){
 const wrap=subscriptionNode('div','sub-entry-actions');
 if(x.status==='paid'){
  const audit=subscriptionButton('ตรวจ Payment Audit',()=>subscriptionAudit(x.id,audit));
  const test=subscriptionButton('ตรวจซ้ำ 3 ครั้ง',()=>testPaidRecheck(x.id,test));
  wrap.append(audit,test);
 }
 if(x.status==='payment_review'){
  wrap.append(subscriptionNode('p','sub-review-note','Omise ยืนยันการชำระแล้ว แต่ยังไม่ได้เปิดสิทธิ์ กรุณาติดต่อผู้ดูแลเพื่อตรวจสอบรายการนี้และการคืนเงิน'));
 }
 if(x.status==='pending_payment_setup'){
  const qr=subscriptionButton('PromptPay QR (Test)',()=>startOmiseUI(x.id,'promptpay',x.amountTHB),'sub-primary-action');
  const allowed=details?.openBillingRequestId===x.id&&(details.status!=='active'||!!details.purchaseWindow?.allowed||x.purchaseKind==='upgrade');
  qr.disabled=!allowed;
  if(!allowed)qr.title='คำขอนี้ยังไม่ผ่านเงื่อนไขการซื้อ โปรดตรวจสอบสถานะสมาชิก';
  const cancel=subscriptionButton('ยกเลิกคำขอ',async()=>{
   if(!confirm('ยืนยันยกเลิกคำขอ '+x.plan+' ที่ยังไม่สร้าง QR?'))return;
   cancel.disabled=true;
   try{await credit().cancelUnpaidPlanRequest(x.id);await subscriptionRefreshAfterAction();if($('subscriptionHistoryDialog')?.open)await subscriptionReloadHistory();toast('ยกเลิกคำขอเรียบร้อย')}
   catch(e){toast('ยกเลิกไม่ได้: '+e.message);cancel.disabled=false}
  });
  wrap.append(qr,cancel);
 }
 if(x.status==='creating_charge'){
  const recover=subscriptionButton('กู้คืน Charge',async()=>{
   recover.disabled=true;
   try{
    const response=await credit().recoverOmiseCharge(x.id);
    if(response.qrImage){if(subscriptionHistoryDialog()?.open)subscriptionHistoryDialog().close();displayOmiseQR(response.qrImage)}
    if(!response.found)alert(response.matchCount>1?'พบหลาย Charge กรุณาตรวจสอบกับผู้ดูแล':'ไม่พบ Charge กรุณาตรวจ Omise Test Dashboard ก่อนสร้างคำขอใหม่');
    else toast('สถานะรายการ: '+response.status);
    await subscriptionRefreshAfterAction();
    if($('subscriptionHistoryDialog')?.open)await subscriptionReloadHistory();
   }catch(e){toast('กู้คืน Charge ไม่สำเร็จ: '+e.message)}finally{recover.disabled=false}
  });
  wrap.append(recover);
 }
 if(x.status==='creating_charge'||x.status==='payment_pending'){
  const check=subscriptionButton('ตรวจสถานะ Omise',async()=>{
   check.disabled=true;
   try{
    const result=await credit().omisePaymentStatus(x.id);
    if(result.qrImage){if(subscriptionHistoryDialog()?.open)subscriptionHistoryDialog().close();displayOmiseQR(result.qrImage)}
    if(result.needsReconciliation)toast('กรุณากู้คืน Charge เพื่อค้นหารายการ');
    else toast('สถานะ Omise: '+result.status);
    await subscriptionRefreshAfterAction();
    if($('subscriptionHistoryDialog')?.open)await subscriptionReloadHistory();
   }catch(e){toast('ตรวจสถานะไม่ได้: '+e.message)}finally{check.disabled=false}
  });
  wrap.append(check);
 }
 return wrap;
}
function subscriptionRequestRow(x,details,compact=false){
 const row=subscriptionNode('article','sub-entry'+(compact?' sub-entry-compact':''));
 const header=subscriptionNode('div','sub-entry-top');
 const title=subscriptionNode('div','sub-entry-title',(subscriptionRequestNames[x.purchaseKind]||'สมัคร')+' '+(x.plan||'—'));
 const info=subscriptionNode('div','sub-entry-info');
 info.append(subscriptionNode('span','',subscriptionDate(x.createdAt)));
 if(x.amountTHB!==null&&x.amountTHB!==undefined)info.append(subscriptionNode('span','',Number(x.amountTHB).toLocaleString('th-TH')+' บาท'));
 const labels=subscriptionNode('div','sub-entry-labels');labels.append(title,info);
 header.append(labels,subscriptionStatusBadge(x.status));row.append(header);
 if(x.status==='paid'&&x.creditsPurchased!==null&&x.creditsPurchased!==undefined){
  const credits=subscriptionNode('div','sub-entry-credits');
  credits.textContent='เครดิตใหม่ '+Number(x.creditsPurchased).toLocaleString('th-TH')+' + เดิม '+Number(x.transferredCredits||0).toLocaleString('th-TH')+' = '+Number(x.balanceAfter||0).toLocaleString('th-TH')+' วิดีโอ';
  row.append(credits);
 }else if(x.status==='paid'&&x.balanceAfter===null){
  row.append(subscriptionNode('div','sub-entry-credits','รายละเอียดเครดิตของรายการเก่าอาจไม่ครบ'));
 }
 if(x.status==='paid'&&x.activationExpiresAt)row.append(subscriptionNode('div','sub-entry-expiry','สิทธิ์ถึง '+subscriptionDate(x.activationExpiresAt)));
 if(['failed','expired'].includes(x.status))row.append(subscriptionNode('p','sub-entry-muted','รายการนี้ไม่เปลี่ยนแพ็กเกจหรือเครดิต'));
 if(compact){
  const detailsBlock=subscriptionNode('div','sub-entry-expanded');
  detailsBlock.hidden=true;detailsBlock.append(subscriptionRequestActions(x,details));
  const toggle=subscriptionButton('ดูรายละเอียด',()=>{
   detailsBlock.hidden=!detailsBlock.hidden;
   toggle.textContent=detailsBlock.hidden?'ดูรายละเอียด':'ซ่อนรายละเอียด';
   toggle.setAttribute('aria-expanded',String(!detailsBlock.hidden));
  },'sub-expand-btn');
  toggle.setAttribute('aria-expanded','false');
  row.append(toggle,detailsBlock);
 }else row.append(subscriptionRequestActions(x,details));
 return row;
}
function subscriptionHero(details){
 const hero=subscriptionNode('section','sub-summary-card');
 const top=subscriptionNode('div','sub-summary-head');
 const heading=subscriptionNode('div','sub-summary-title');
 const planDef=plans.find(p=>p[0]===details.plan);
 heading.append(subscriptionNode('div','sub-summary-eyebrow','สมาชิกปัจจุบัน'));
 const name=subscriptionNode('div','sub-summary-plan');
 name.append(subscriptionNode('span','sub-summary-icon',planDef?.[4]||'🎥'),subscriptionNode('strong','',details.plan||'—'));
 heading.append(name);
 const status=subscriptionNode('span','sub-state-chip sub-state-'+(details.status==='active'?'paid':'pending'),subscriptionLabels[details.status]||details.status);
 const action=subscriptionButton('ดูแพ็กเกจทั้งหมด',()=>{
  ($('availablePlans')||$('planGrid'))?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 top.append(heading,status,action);hero.append(top);
 const metrics=subscriptionNode('div','sub-summary-metrics');
 const days=details.expiresAt&&Number.isFinite(Date.parse(details.expiresAt))?Math.max(0,Math.ceil((Date.parse(details.expiresAt)-Date.now())/86400000)):null;
 const metricValues=[
  ['เครดิตพร้อมใช้',details.remaining===null?'∞':Number(details.remaining||0).toLocaleString('th-TH'),'วิดีโอที่ยังใช้ได้'],
  ['วันหมดอายุ',details.expiresAt?subscriptionDate(details.expiresAt):'ไม่กำหนด',days===null?'':days+' วันคงเหลือ'],
  ['ใช้แล้วเดือนนี้',Number(details.used||0).toLocaleString('th-TH'),'จองอยู่ '+Number(details.reserved||0).toLocaleString('th-TH')]
 ];
 for(const m of metricValues){
  const card=subscriptionNode('div','sub-summary-metric');
  card.append(subscriptionNode('small','',m[0]),subscriptionNode('strong','',m[1]),subscriptionNode('span','',m[2]));metrics.append(card);
 }
 hero.append(metrics);
 hero.append(subscriptionNode('p','sub-summary-foot','ชำระผ่าน PromptPay QR (Omise Test Mode) • อัปเกรดแล้วโอนเครดิตที่เหลือและวันหมดอายุเดิมต่อเนื่อง'));
 return hero;
}
function subscriptionNotice(details){
 if(details.openBillingRequestId)return subscriptionNode('div','sub-notice sub-notice-attention','มีคำขอชำระเงินที่ต้องจัดการก่อนซื้อแพ็กเกจใหม่ กรุณาดูรายการด้านล่าง');
 if(details.status!=='active'||details.plan==='Free')return null;
 if(details.reserved>0)return subscriptionNode('div','sub-notice sub-notice-attention','มีวิดีโอจองเครดิตค้างอยู่ โปรดตรวจสอบส่วนรายการจองค้างก่อนอัปเกรดแพ็กเกจ');
 if(details.purchaseWindow?.kind==='exhausted_topup')return subscriptionNode('div','sub-notice sub-notice-attention','เครดิตหมดแล้ว สามารถซื้อแพ็กเกจเดิมหรืออัปเกรดเป็นระดับสูงกว่าได้');
 if(details.purchaseWindow?.kind==='renewal')return subscriptionNode('div','sub-notice','แพ็กเกจใกล้หมดอายุ สามารถต่ออายุหรืออัปเกรดได้ โดยเครดิตเดิมไม่สูญหาย');
 return null;
}
function subscriptionSection(title,subtitle){
 const section=subscriptionNode('section','sub-content-card');
 const head=subscriptionNode('div','sub-content-head');
 const labels=subscriptionNode('div','');
 labels.append(subscriptionNode('h3','',title),subscriptionNode('p','',subtitle));
 head.append(labels);section.append(head);
 return {section,head};
}
async function renderSubscriptionRequests(){
 const host=$('subscriptionRequests');if(!host)return;
 host.replaceChildren();
 host.append(subscriptionNode('p','sub-loading','กำลังโหลดสถานะสมาชิก…'));
 try{
  const details=await credit().subscriptionOverview();
  subscriptionDashboardData=details;
  host.replaceChildren();
  const page=subscriptionNode('div','subscription-dashboard');
  page.append(subscriptionHero(details));
  const notice=subscriptionNotice(details);if(notice)page.append(notice);
  const actionStates=new Set(['pending_payment_setup','creating_charge','payment_pending','payment_review']);
  const actions=details.requests.filter(x=>actionStates.has(x.status));
  const recent=details.requests.filter(x=>x.status==='paid').slice(0,3);
  const lower=subscriptionNode('div','sub-content-grid'+(actions.length?'':' sub-grid-single'));
  if(actions.length){
   const actionSection=subscriptionSection('ต้องดำเนินการ','รายการที่ยังไม่เสร็จสิ้น');
   actionSection.section.classList.add('sub-attention-card');
   for(const x of actions)actionSection.section.append(subscriptionRequestRow(x,details));
   lower.append(actionSection.section);
  }
  const historySection=subscriptionSection('ประวัติแพ็กเกจล่าสุด','แสดงรายการชำระสำเร็จ 3 รายการล่าสุด');
  for(const x of recent)historySection.section.append(subscriptionRequestRow(x,details,true));
  if(!recent.length)historySection.section.append(subscriptionNode('p','sub-empty','ยังไม่มีรายการชำระเงินสำเร็จ'));
  const more=subscriptionButton('ดูประวัติทั้งหมด',()=>subscriptionOpenHistory(),'sub-history-more');
  historySection.section.append(more);lower.append(historySection.section);
  page.append(lower);host.append(page);
 }catch(e){host.replaceChildren(subscriptionNode('p','sub-error','โหลดข้อมูลสมาชิกไม่สำเร็จ: '+e.message))}
}
function subscriptionHistoryDialog(){return $('subscriptionHistoryDialog')}
async function subscriptionOpenHistory(){
 const dlg=subscriptionHistoryDialog();if(!dlg||dlg.open)return;
 billingHistoryCursor=null;
 $('subscriptionHistoryRows').replaceChildren();
 $('subscriptionHistoryMore').hidden=true;
 dlg.showModal();
 await subscriptionLoadHistory();
}
async function subscriptionReloadHistory(){
 const dlg=subscriptionHistoryDialog();if(!dlg||!dlg.open)return;
 billingHistoryCursor=null;
 $('subscriptionHistoryRows').replaceChildren();
 await subscriptionLoadHistory();
}
async function subscriptionLoadHistory(){
 if(billingHistoryBusy)return;
 const rows=$('subscriptionHistoryRows'),more=$('subscriptionHistoryMore'),dlg=subscriptionHistoryDialog();
 if(!rows||!dlg?.open)return;
 billingHistoryBusy=true;more.disabled=true;
 rows.querySelectorAll('.sub-error').forEach(node=>node.remove());
 const loading=subscriptionNode('p','sub-loading','กำลังโหลดประวัติการชำระ…');rows.append(loading);
 try{
  const result=await credit().billingHistory(billingHistoryCursor);
  loading.remove();
  if(!dlg.open)return;
  for(const x of result.items)rows.append(subscriptionRequestRow(x,subscriptionDashboardData));
  if(rows.childElementCount===0)rows.append(subscriptionNode('p','sub-empty','ยังไม่มีประวัติแพ็กเกจ'));
  billingHistoryCursor=result.nextCursor||null;
  more.hidden=!billingHistoryCursor;
 }catch(e){
  loading.remove();
  rows.querySelectorAll('.sub-error').forEach(node=>node.remove());rows.append(subscriptionNode('p','sub-error','โหลดประวัติไม่ได้: '+e.message));
  more.hidden=false;more.textContent='ลองโหลดอีกครั้ง';
 }finally{
  more.disabled=false;billingHistoryBusy=false;
  if(more.textContent!=='โหลดประวัติเพิ่ม'&&more.hidden)more.textContent='โหลดประวัติเพิ่ม';
 }
}

async function renderPendingReservationReview(){
 const page=$('plans');if(!page||page.hidden)return;
 let pane=$('pendingReservationReview');
 if(!pane){pane=document.createElement('section');pane.id='pendingReservationReview';pane.className='panel';pane.style.marginTop='18px';const plansSection=$('availablePlans');if(plansSection)page.insertBefore(pane,plansSection);else page.append(pane)}
 pane.replaceChildren();
 if(!remoteQuota||(remoteQuota.reserved||0)<1){pane.hidden=true;return}
 pane.hidden=false;
 const heading=document.createElement('h3');heading.textContent='⚠ ตรวจสอบวิดีโอที่จองเครดิตค้าง ('+remoteQuota.reserved+' รายการ)';pane.append(heading);
 const desc=document.createElement('p');desc.textContent='ระบบไม่อนุญาตซื้อแพ็กเกจขณะมีเครดิตจองค้าง โปรดตรวจสอบว่าไม่มีเครื่องใดกำลัง REC และไม่มีไฟล์วิดีโอที่บันทึกสำเร็จ ก่อนคืนเครดิต';pane.append(desc);
 const loading=document.createElement('p');loading.textContent='กำลังตรวจสอบรายการจองเครดิตจาก Firebase…';pane.append(loading);
 try{
  const result=await credit().pendingVideoReservations();loading.remove();
  if(!result.items.length){
   const notice=document.createElement('p');notice.textContent='ไม่พบรายการบันทึกสถานะ Reserved ใน Firebase แต่ตัวนับยังค้างอยู่ กรุณาติดต่อผู้ดูแลเพื่อตรวจสอบบัญชี อย่าปรับตัวเลขใน Firestore เอง';pane.append(notice);return;
  }
  if(result.truncated){const limit=document.createElement('p');limit.textContent='มีรายการจองค้างจำนวนมาก ระบบแสดงได้เพียง 100 รายการแรก';pane.append(limit)}
  for(const item of result.items){
   const line=document.createElement('div');line.className='pending-reservation-line';
   const name=document.createElement('div');name.className='pending-reservation-name';name.textContent='Barcode: '+item.barcode+' • '+(item.createdAt?new Date(item.createdAt).toLocaleString('th-TH'):'ไม่ทราบเวลา');
   const detail=document.createElement('p');detail.textContent=item.canRecover?'รายการนี้ค้างเกิน 30 นาที ตรวจสอบไฟล์ก่อนยกเลิก':'อายุรายการ '+(item.ageMinutes??'ไม่ทราบ')+' นาที • เพื่อความปลอดภัยต้องค้างเกิน 30 นาทีก่อนยกเลิกจากหน้า Packages';
   line.append(name,detail);
   const action=document.createElement('button');action.type='button';action.className='secondary';action.textContent='ตรวจสอบแล้ว — ยกเลิกการจองและคืนเครดิต';action.disabled=!item.canRecover;
   action.onclick=async()=>{
    if(activeBarcode||ending){toast('ยังมี REC ทำงานบนเครื่องนี้ กรุณาหยุดบันทึกก่อน');return}
    const ok=confirm('ตรวจสอบ Barcode '+item.barcode+' แล้วหรือไม่?\\n1. ไม่มีเครื่องใดกำลังบันทึกวิดีโอรายการนี้\\n2. ไม่มีไฟล์วิดีโอที่บันทึกสำเร็จ\\nหากมีไฟล์อยู่ ห้ามคืนเครดิต เพราะจะทำให้การนับเครดิตผิด\\nยืนยันคืนเครดิตจองค้างหรือไม่?');
    if(!ok)return;
    action.disabled=true;
    try{
     const recovered=await credit().recoverStaleVideoReservation(item.id);
     if(recovered.status!=='failed')throw Error('Server ไม่ยืนยันการยกเลิกเครดิต');
     if(pending()?.operationId===item.id){clearPending();recordingOp=null;showRecovery()}
     await refreshRemoteQuota();renderPlans();
     toast('ตรวจสอบรายการจองค้างแล้ว'+(recovered.creditReturned?' และคืนเครดิต 1 รายการ':' (รายการนี้ไม่อยู่ในรอบเครดิตปัจจุบัน)'));
    }catch(e){toast('คืนเครดิตไม่สำเร็จ: '+e.message);action.disabled=false}
   };
   line.append(action);pane.append(line);
  }
  const link=document.createElement('button');link.type='button';link.className='secondary';link.textContent='ตรวจสอบรายการจากเครื่องนี้ในหน้า Packing';
  link.onclick=()=>showTab('packing');pane.append(link);
 }catch(e){loading.textContent='โหลดเครดิตจองค้างไม่สำเร็จ: '+e.message}
}
function planBuyStatus(plan){
 if(!remoteQuota||plan==='Free')return {allowed:false,label:plan==='Free'?'แผนใช้ฟรี':'กำลังโหลด'};
 const current=remoteQuota.plan===plan,active=remoteQuota.subscriptionStatus==='active'&&remoteQuota.plan!=='Free';
 const open=remoteQuota.openBillingRequestId;
 if(open)return {allowed:false,label:'มีคำขอชำระค้าง'};
 if((remoteQuota.reserved||0)>0)return {allowed:false,label:'ตรวจสอบเครดิตจองค้างด้านล่าง'};
 if(!active)return {allowed:true,label:'สมัครแพ็กเกจ'};
 const index=plans.findIndex(x=>x[0]===plan),currentIndex=plans.findIndex(x=>x[0]===remoteQuota.plan);
 if(index>currentIndex)return {allowed:true,label:'อัปเกรดแพ็กเกจ'};
 if(remoteQuota.purchaseReason==='exhausted_topup'&&current)return {allowed:true,label:'เติมเครดิต + ต่ออายุ'};
 if(remoteQuota.purchaseReason==='renewal'&&current)return {allowed:true,label:'ต่ออายุล่วงหน้า'};
 return {allowed:false,label:current?'แพ็กเกจปัจจุบัน':'ยังไม่สามารถซื้อ'};
}
function renderPlans(){
 const cards=plans.map(p=>{
  const current=remoteQuota?.plan===p[0],buy=planBuyStatus(p[0]);
  return `<article class="plan ${current?'selected':''}">
   <div class="plan-heading"><span class="plan-icon" role="img" aria-label="${p[5]}">${p[4]}</span><span class="plan-name"><h4>${p[0]}</h4><small>${p[5]}</small></span>${current?'<span class="plan-current">ใช้งานอยู่</span>':''}</div>
   <div class="price">฿${p[1].toLocaleString('th-TH')}<small>/30 วัน</small></div>
   <p class="plan-feature">🎥 ${Number.isFinite(p[2])?p[2].toLocaleString('th-TH'):'ไม่จำกัด'} วิดีโอ / แพ็กเกจ 30 วัน</p>
   <p class="plan-feature">🖥️ ${p[3]} เครื่อง</p>
   <button type="button" class="secondary" data-plan-request="${p[0]}" ${buy.allowed?'':'disabled'}>${buy.label}</button>
  </article>`;
 });
 $('planGrid').innerHTML=cards.join('');
 document.querySelectorAll('[data-plan-request]').forEach(button=>button.addEventListener('click',async()=>{
  const p=button.dataset.planRequest;
  try{await refreshRemoteQuota()}catch(e){toast('ตรวจสอบสิทธิ์ไม่สำเร็จ: '+e.message);return}
  const buy=planBuyStatus(p);
  if(!buy.allowed){toast('ไม่สามารถซื้อได้ในขณะนี้: '+buy.label);renderPlans();return}
  const upgrading=remoteQuota?.subscriptionStatus==='active'&&remoteQuota.plan!=='Free'&&plans.findIndex(x=>x[0]===p)>plans.findIndex(x=>x[0]===remoteQuota.plan);
  const kind=upgrading?'upgrade':remoteQuota.purchaseReason;
  const note=kind==='upgrade'?'อัปเกรด '+remoteQuota.plan+' เป็น '+p+' โดยชำระราคาแพ็กเกจใหม่เต็มจำนวน เครดิตเดิมที่เหลือจะโอนมารวมกับเครดิต '+(plans.find(x=>x[0]===p)?.[2]===Infinity?'ไม่จำกัด':plans.find(x=>x[0]===p)?.[2])+' ของแพ็กเกจใหม่ และวันหมดอายุเดิมบวกเพิ่มอีก 30 วัน':kind==='exhausted_topup'?'หลังชำระสำเร็จ จะเพิ่มเครดิตแพ็กเกจใหม่ให้ยอดสะสม และเพิ่มวันหมดอายุจากวันเดิมอีก 30 วัน':kind==='renewal'?'เครดิตที่ยังเหลือจะโอนมารวมกับเครดิตใหม่ และวันหมดอายุจะเพิ่มจากวันเดิมอีก 30 วัน':'หลังชำระสำเร็จ จะเปิดแพ็กเกจ 30 วัน โดยโอนเครดิต Free ที่ยังเหลือ (ถ้ามี) มารวมกับเครดิตใหม่';
  if(!confirm('สร้างคำขอ '+p+' ผ่าน Omise Test Mode?\\n'+note))return;
  button.disabled=true;
  try{const result=await credit().requestPlanChange(p);toast('บันทึกคำขอ '+result.plan+' แล้ว โปรดชำระในประวัติคำขอ');await refreshRemoteQuota();renderPlans()}catch(e){toast('ส่งคำขอไม่สำเร็จ: '+e.message);renderPlans()}
 }));
 void renderSubscriptionRequests();
 void renderPendingReservationReview();
}

async function deleteRecordedVideo(log,ask=true){
 if(activeBarcode||ending){toast('หยุดการอัดก่อนลบวิดีโอ');return false}
 if(ask&&!confirm('ลบไฟล์ '+log.filename+' ออกจากคอมพิวเตอร์อย่างถาวร? การลบนี้ไม่คืนโควตาที่ใช้ไป'))return false;
 if(!folder)await restoreFolder(false);
 if(!folder){toast('กรุณาเลือกหรือเชื่อมโฟลเดอร์เดิมก่อนลบ');return false}
 let perm=await folder.queryPermission({mode:'readwrite'});
 if(perm!=='granted')perm=await folder.requestPermission({mode:'readwrite'});
 if(perm!=='granted'){toast('ไม่ได้รับสิทธิ์ลบไฟล์');return false}
 try{await folder.removeEntry(log.filename)}catch(e){toast('ลบไฟล์ไม่สำเร็จ: '+e.message);return false}
 if(!$('videoPanel').hidden)closePlayback();
 try{await ensureVideoHistory();await window.PACKTOOK_VIDEO_HISTORY.remove(log.filename)}
 catch(e){console.error('Failed to remove video metadata',e);store.logs=Array.isArray(store.logs)?store.logs:[];const old=store.logs.find(x=>x.filename===log.filename);if(old)old.deleted=true;persist();toast('ไฟล์ถูกลบแล้ว แต่ IndexedDB มีปัญหา กรุณาตรวจสอบประวัติอีกครั้ง')}
 await renderHistory();toast('ลบไฟล์แล้ว (ไม่คืนโควตา)');return true
}
let cleanupRunning=false;
async function runRetention(force=false){
 if(cleanupRunning||activeBarcode||ending)return;
 const days=Number(store.retentionDays||0);
 $('retentionStatus').textContent=days?'ลบไฟล์ที่เกิน '+days+' วัน เฉพาะเมื่อเปิดเว็บและให้สิทธิ์โฟลเดอร์':'ไม่ลบอัตโนมัติ';
 if(!days)return;
 let expired;
 try{await ensureVideoHistory();expired=await window.PACKTOOK_VIDEO_HISTORY.expired(Date.now()-days*86400000,100)}
 catch(e){toast('อ่านประวัติลบไฟล์ไม่ได้: '+e.message);return}
 if(!expired.length){if(force)toast('ไม่พบวิดีโอหมดอายุ');return}
 if(!folder)await restoreFolder(false);
 if(!folder){toast('ต้องเชื่อมโฟลเดอร์เก็บวิดีโอเพื่อทำความสะอาด');return}
 if(force&&!confirm('ลบวิดีโอหมดอายุ '+expired.length+' รายการอย่างถาวร? (สูงสุด 100 รายการต่อครั้ง)'))return;
 cleanupRunning=true;let removed=0;
 try{
  let perm=await folder.queryPermission({mode:'readwrite'});
  if(perm!=='granted'){
   if(force)perm=await folder.requestPermission({mode:'readwrite'});
   else{toast('กรุณากดเชื่อมโฟลเดอร์ เพื่ออนุญาตลบอัตโนมัติ');return}
  }
  if(perm!=='granted')return;
  for(const log of expired){
   try{
    await folder.removeEntry(log.filename);
    await window.PACKTOOK_VIDEO_HISTORY.remove(log.filename);
    removed++;
   }catch(e){console.warn('Cleanup skipped',log.filename,e)}
  }
  await renderHistory();
  if(removed)toast('ลบวิดีโอหมดอายุแล้ว '+removed+' ไฟล์');
 }finally{cleanupRunning=false}
}
async function renderHistory(next=false){
 const rows=$('historyRows'),button=$('historyNext');
 if(historyLoading)return;
 const queryId=next?historyQueryId:++historyQueryId;
 if(!next){historyCursor=null;rows.replaceChildren()}
 historyLoading=true;if(button){button.disabled=true;button.hidden=true}
 try{
  await ensureVideoHistory();
  const date=$('dateFilter').value,barcode=($('barcodeFilter').value||'').trim().toLowerCase();
  const [counts,page]=await Promise.all([
   next?Promise.resolve(null):window.PACKTOOK_VIDEO_HISTORY.counts(monthKey()),
   window.PACKTOOK_VIDEO_HISTORY.page({day:date,barcode,after:next?historyCursor:null,limit:50})
  ]);
  if(queryId!==historyQueryId)return;
  if(counts){$('allVideos').textContent=counts.total.toLocaleString('th-TH');$('monthVideos').textContent=counts.current.toLocaleString('th-TH')}
  for(const r of page.items){
   const tr=document.createElement('tr');
   [new Date(r.timestamp).toLocaleString('th-TH'),r.barcode,r.worker,`${r.seconds} วินาที`].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.append(td)});
   const td=document.createElement('td'),play=document.createElement('button');play.className='video-action';play.type='button';play.textContent='▶ เปิดวิดีโอ';play.title=r.filename;play.addEventListener('click',()=>playHistory(r));td.append(play);
   const del=document.createElement('button');del.type='button';del.className='video-delete';del.textContent='ลบไฟล์';del.addEventListener('click',()=>deleteRecordedVideo(r));td.append(' ',del);tr.append(td);rows.append(tr);
  }
  if(!rows.childElementCount){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='ยังไม่มีวิดีโอที่ตรงกับเงื่อนไข';tr.append(td);rows.append(tr)}
  historyCursor=page.nextCursor;
  if(button){button.hidden=!historyCursor;button.disabled=false}
 }catch(e){console.error('Video history failed',e);toast('โหลดประวัติวิดีโอไม่ได้: '+e.message);if(button)button.hidden=true}
 finally{historyLoading=false}
}
function safeFilename(s){return (s||'order').replace(/[^\w\-ก-๙]/g,'_').slice(0,70)}
function fmtSec(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function cameraState(on){$('noCam').hidden=on;$('cameraBtn').textContent=on?'ปิดกล้อง':'เปิดกล้อง';if(!activeBarcode)$('recBadge').textContent=on?'● CAMERA ON':'● CAMERA OFF'}
async function toggleCamera(){if(stream){if(activeBarcode)return toast('หยุดการบันทึกก่อนปิดกล้อง');clearHealth();stream.getTracks().forEach(t=>t.stop());stream=null;$('preview').srcObject=null;cameraState(false);updateHealth('● ปิดกล้องแล้ว');return}await openCamera()}
async function selectFolder(){try{if(!window.showDirectoryPicker)throw Error('รองรับ Chrome / Edge Desktop เท่านั้น');const h=await window.showDirectoryPicker({mode:'readwrite'});const perm=await h.requestPermission({mode:'readwrite'});if(perm!=='granted')throw Error('ไม่มีสิทธิ์เขียนโฟลเดอร์');folder=h;await saveFolderHandle(h);$('folderStatus').textContent='โฟลเดอร์ที่เลือก: '+h.name;toast('เลือกโฟลเดอร์สำเร็จ')}catch(e){toast('เลือกโฟลเดอร์ไม่สำเร็จ: '+e.message)}}
async function startRecording(barcode){
 const scanRequestedAt=performance.now();
 if(recordingOp||pending())return toast('มีรายการจองเครดิตที่ยังไม่ยืนยัน กรุณากดตรวจสอบเครดิตจองค้าง');
 if(ending||activeBarcode)return;
 if(!remoteUser||!credit())return toast('กรุณาเข้าสู่ระบบ Firebase ก่อน');
 if(!streamGood())return toast('กรุณาเปิดกล้องและตรวจสอบสัญญาณ');
 if(!folder)return toast('กรุณาเลือกโฟลเดอร์บันทึกก่อน');
 if(!window.MediaRecorder||!window.PACKTOOK_VIDEO_WRITER)return toast('Browser ไม่รองรับระบบ Streaming Video');
 let attemptedOperationId=null,started=false,writer=null;
 try{
  const perm=await folder.queryPermission({mode:'readwrite'});
  if(perm!=='granted')return toast('กรุณาเชื่อมต่อโฟลเดอร์และให้สิทธิ์ก่อน');
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime)throw Error('Browser ไม่รองรับ WebM');
  const op=crypto.randomUUID();attemptedOperationId=op;
  const filename=safeFilename(barcode)+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+op.slice(0,8)+'.webm';
  // Operation intent must be durable BEFORE the network request. A timeout may still
  // mean that the server committed the reservation, so the ID can be reconciled.
  setPendingOperation(op,barcode,'reserving',filename);
  updatePendingOperation({worker:$('worker').value.trim()||'Unknown'});
  showRecovery();
  $('recordState').textContent='⏳ สแกน '+barcode+' แล้ว • กำลังตรวจสอบเครดิตกับ Firebase…';
  updateHealth('กำลังตรวจสอบสิทธิ์การบันทึก…');
  let granted;
  try{granted=await credit().reserve(barcode,op)}
  catch(err){
   const unregistered=err.code==='functions/permission-denied'&&/Device not registered|Device registration required/i.test(String(err.message));
   if(unregistered){
    await setupDevice();
    granted=await credit().reserve(barcode,op);
   }else{
    const duplicate=err.code==='functions/already-exists'||String(err.message).includes('Barcode already scanned');
    if(!duplicate)throw err;
    if(!confirm('พบ Barcode '+barcode+' ที่บันทึกแล้ว\\nต้องการขออนุญาตบันทึกซ้ำหรือไม่?')){clearPending();showRecovery();return}
    const reason=prompt('เหตุผลในการบันทึก Barcode ซ้ำ (อย่างน้อย 10 ตัวอักษร):');
    if(reason===null){clearPending();showRecovery();return}
    if(reason.trim().length<10||reason.trim().length>500){clearPending();showRecovery();return toast('โปรดระบุเหตุผลระหว่าง 10–500 ตัวอักษร')}
    const approval=await credit().authorizeDuplicate(barcode,reason.trim());
    granted=await credit().reserve(barcode,op,approval.approvalId);
   }
  }
  if(granted.status!=='reserved')throw Error('Server ไม่ยืนยันการจองเครดิต: '+granted.status);
  recordingOp=op;updatePendingOperation({phase:'reserved'});
  // File is opened only after credit authorization. Every emitted chunk is written
  // incrementally; a 30-minute video is never accumulated in a single JS array.
  writer=await window.PACKTOOK_VIDEO_WRITER.open(folder,filename);
  videoWriter=writer;
  recordingFailure='';
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:({480:850000,720:1800000,1080:3500000}[Number($('videoQuality').value)]||1800000)});
  const rec=recorder;
  rec.ondataavailable=e=>{
   try{if(e.data?.size)writer.enqueue(e.data)}
   catch(err){
    recordingFailure=err.message||'Video stream write error';
    updateHealth('⚠ เขียนไฟล์ไม่ทันหรือดิสก์ผิดพลาด','danger-health');
    if(activeBarcode&&!ending)void stopRecording('disk_error');
   }
  };
  rec.onerror=e=>{
   recordingFailure=e.error?.message||'MediaRecorder error';
   updateHealth('⚠ กล้องบันทึกผิดพลาด','danger-health');
   if(activeBarcode&&!ending)void stopRecording('recorder_error');
  };
  rec.start(1000);started=true;activeBarcode=barcode;startMs=Date.now();
  updatePendingOperation({phase:'recording',startedAt:startMs});
  console.info('[PACKTOOK] Barcode → REC start:',Math.round(performance.now()-scanRequestedAt),'ms');
  $('recordState').textContent='กำลังบันทึก '+barcode+' — สแกน Barcode เดิมเพื่อหยุด';
  $('recordState').classList.add('active');
  $('recBadge').textContent='● RECORDING';$('recBadge').classList.add('recording');
  $('stopBtn').disabled=false;$('recTimer').hidden=false;
  updateHealth('● กำลังบันทึก','good-health');
  ticker=setInterval(()=>$('recTimer').textContent='REC '+fmtSec(Math.floor((Date.now()-startMs)/1000)),1000);
  toast('เริ่มบันทึก '+barcode);
 }catch(e){
  if(writer&&!started){try{await writer.cancelUnstarted()}catch(x){console.warn('Empty writer cleanup',x)}videoWriter=null}
  if(recordingOp&&!started){
   try{
    const out=await credit().finalize(recordingOp,false);
    if(out.status==='failed'){recordingOp=null;clearPending()}
   }catch(err){console.warn('Start reservation needs manual recovery',err)}
  }else if(!recordingOp&&attemptedOperationId&&pending()?.operationId===attemptedOperationId){
   // A rejected/timeout callable is ambiguous. Check by operation ID, never
   // issue a second reservation or silently return a possibly-used credit.
   try{
    const check=await credit().recordingStatus(attemptedOperationId);
    if(check.status==='reserved')recordingOp=attemptedOperationId;
    if(check.status==='failed')clearPending();
   }catch(err){
    if(err.code==='functions/not-found')clearPending();
    else console.warn('Reservation response uncertain; keep operation intent',err.code);
   }
  }
  if(started){updatePendingOperation({phase:'needs_review'});toast('พบข้อผิดพลาดหลังเริ่มอัด กรุณาตรวจไฟล์และเครดิต')}
  else toast('เริ่มบันทึกไม่สำเร็จ: '+e.message+(pending()?' • กรุณาตรวจเครดิตจองค้าง':''));
  showRecovery();void refreshRemoteQuota().catch(()=>{});
 }finally{
  if(!activeBarcode&&!ending){
   $('recordState').classList.remove('active');
   $('recordState').textContent=pending()?'⚠ มีรายการเครดิตรอตรวจสอบก่อนเริ่มออเดอร์ถัดไป':'พร้อมสแกน Barcode เพื่อเริ่มบันทึก';
   updateHealth(streamGood()?'● กล้องพร้อมใช้งาน':'● กรุณาตรวจสอบกล้อง',streamGood()?'good-health':'danger-health');
  }
 }
}
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
async function stopRecording(reason='manual'){if(!activeBarcode||!recorder||ending)return;ending=true;const rec=recorder;const code=activeBarcode;const begun=startMs;const stopRequestedAt=performance.now();
 // Stop the encoder synchronously before disk I/O, verification or Firebase finalization.
 // MediaRecorder.stop() automatically emits its final dataavailable chunk.
 let stopped=Promise.resolve();
 try{
  if(rec.state!=='inactive')stopped=new Promise((resolve,reject)=>{
   let done=false;
   const timeout=setTimeout(()=>{if(!done){done=true;reject(Error('กล้องไม่ตอบสนองภายใน 10 วินาที'))}},10000);
   const settle=()=>{if(!done){done=true;clearTimeout(timeout);resolve()}};
   rec.addEventListener('stop',settle,{once:true});
   try{rec.stop()}catch(e){clearTimeout(timeout);reject(e)}
  });
  clearInterval(ticker);ticker=null;
  $('recordState').textContent='⏹ รับคำสั่งหยุดแล้ว • กำลังสร้างและตรวจสอบไฟล์วิดีโอ…';
  $('recordState').classList.remove('active');$('recordState').classList.add('saving');
  $('recBadge').textContent='■ STOPPED • SAVING';$('recBadge').classList.remove('recording');$('recBadge').classList.add('saving');
  $('stopBtn').disabled=true;
  $('recTimer').textContent='⏹ SAVING';
  updateHealth('กำลังบันทึกไฟล์ • กรุณารอระบบยืนยันสำเร็จ');
  console.info('[PACKTOOK] Barcode → recorder.stop() requested:',Math.round(performance.now()-stopRequestedAt),'ms');
  await stopped;
  console.info('[PACKTOOK] Barcode → MediaRecorder stop event:',Math.round(performance.now()-stopRequestedAt),'ms');
  if(recordingFailure)throw Error(recordingFailure);
  const blob=new Blob(parts,{type:'video/webm'});if(blob.size<1000)throw Error('ไฟล์วิดีโอว่างหรือข้อมูลไม่สมบูรณ์');const timestamp=Date.now(),seconds=Math.max(1,Math.round((timestamp-begun)/1000));const filename=`${safeFilename(code)}_${new Date(timestamp).toISOString().replace(/[:.]/g,'-')}.webm`;const handle=await folder.getFileHandle(filename,{create:true});currentWritable=await handle.createWritable();await currentWritable.write(blob);await currentWritable.close();currentWritable=null;const saved=await handle.getFile();if(saved.size!==blob.size)throw Error('ขนาดไฟล์ที่บันทึกไม่ตรงกัน');$('recordState').textContent='กำลังตรวจสอบไฟล์วิดีโอ…';const verified=await verifySavedVideo(saved,seconds);if(!recordingOp)throw Error('ไม่พบการจองเครดิตบน Server');finalizePending=true;await credit().finalize(recordingOp,true,{filename,bytes:saved.size});finalizePending=false;recordingOp=null;clearPending();showRecovery();await refreshRemoteQuota();store.logs.push({month:monthKey(),day:new Date(timestamp).toLocaleDateString('en-CA'),timestamp,barcode:code,worker:$('worker').value.trim()||'Unknown',seconds,filename,quality:$('actualQuality').textContent,verified});persist();updateQuota();console.info('[PACKTOOK] Barcode stop → file saved, verified and credited:',Math.round(performance.now()-stopRequestedAt),'ms');toast('✓ บันทึกสำเร็จ: '+filename+(reason==='camera_lost'?' (กล้องหลุด)': ''));}catch(e){updateHealth('⚠ บันทึกมีปัญหา','danger-health');toast('บันทึก/ตรวจสอบมีปัญหา: '+e.message+' กรุณาตรวจเครดิตและไฟล์ในโฟลเดอร์');if(recordingOp&&!finalizePending){const op=recordingOp;recordingOp=null;try{await credit().finalize(op,false);clearPending();await refreshRemoteQuota()}catch(err){toast('คืนเครดิตไม่สำเร็จ: '+err.message)}}else if(finalizePending){toast('ไม่ทราบผลยืนยันเครดิต ห้ามอัดซ้ำจนกว่าจะตรวจสอบ');}if(currentWritable){try{await currentWritable.abort()}catch{}currentWritable=null}}finally{clearInterval(ticker);finalizePending=false;activeBarcode='';recorder=null;parts=[];ending=false;recordingFailure='';$('stopBtn').disabled=true;$('recTimer').hidden=true;$('recordState').classList.remove('active','saving');$('recordState').textContent=recordingOp||pending()?'⚠ ตรวจสอบเครดิตจองค้างก่อนสแกนถัดไป':'พร้อมสแกน Barcode ถัดไป';$('recBadge').classList.remove('recording','saving');$('recBadge').textContent=streamGood()?'● CAMERA ON':'● CAMERA OFF';if(reason==='camera_lost')void recoverCamera();else updateHealth(streamGood()?'● กล้องพร้อมใช้งาน':'● ยังไม่เปิดกล้อง',streamGood()?'good-health':'');$('barcode').focus()}}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').hidden=true;try{await credit().login($('email').value.trim(),$('password').value);remoteUser=true;$('loginPage').hidden=true;$('appPage').hidden=false;await refreshRemoteQuota();showTab('packing');$('barcode').focus()}catch(err){$('loginError').hidden=false;$('loginError').textContent=err.message}});
$('showPassword').onclick=()=>{$('password').type=$('password').type==='password'?'text':'password'};
$('logout').onclick=async()=>{if(activeBarcode||recordingOp)return toast('กรุณาหยุดการบันทึกและตรวจเครดิตก่อนออกจากระบบ');await credit().logout();remoteUser=null;remoteQuota=null;$('appPage').hidden=true;$('loginPage').hidden=false;stream?.getTracks().forEach(t=>t.stop());stream=null;cameraState(false)};
document.querySelectorAll('[data-tab]').forEach(e=>e.onclick=()=>showTab(e.dataset.tab));$('refreshUserDevices').onclick=()=>{void renderDeviceManager();void refreshRemoteQuota().catch(e=>toast(e.message))};$('cameraBtn').onclick=toggleCamera;$('folderBtn').onclick=selectFolder;$('stopBtn').onclick=stopRecording;$('focusScan').onclick=()=>$('barcode').focus();$('refreshHistory').onclick=renderHistory;$('dateFilter').onchange=renderHistory;
$('barcode').addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const code=$('barcode').value.trim();$('barcode').value='';if(!code){toast('กรุณาสแกนหรือพิมพ์ Barcode ก่อนกด Enter');return}if(ending||reservation){toast('ระบบกำลังดำเนินการ กรุณารอสักครู่');return}if(activeBarcode){if(code===activeBarcode)stopRecording();else toast('กำลังอัด '+activeBarcode+' ต้องสแกนรหัสเดิมเพื่อหยุด');return}reservation=true;startRecording(code).catch(e=>toast('เกิดข้อผิดพลาด: '+e.message)).finally(()=>{reservation=false;$('barcode').focus()})});
function connectFirebaseUI(){if(!credit()?.ready)return;credit().onUser(u=>{remoteUser=u;if(u){void credit().accountRole().then(info=>{accountRoleInfo=info;const role=$('userRoleInfo');if(role)role.textContent=info.role==='admin'?'Admin — อนุมัติการบันทึกซ้ำได้':'Operator — ต้องขออนุมัติจาก Admin';}).catch(e=>toast('Role: '+e.message));showRecovery();showDeviceControl();const details=$('userAccountDetails');if(details)details.textContent='ยืนยันอีเมลแล้ว • Firebase Authentication';const em=$('userAccountEmail');if(em)em.textContent=u.email||'—';void setupDevice().catch(e=>toast('Device Management: '+e.message)).finally(()=>void renderDeviceManager());$('loginPage').hidden=true;$('appPage').hidden=false;void refreshRemoteQuota().then(()=>{showTab('packing');void verifyAfterPaymentReturn()}).catch(e=>{showTab('packing');toast('เชื่อมโควตาไม่สำเร็จ: '+e.message);void verifyAfterPaymentReturn()})}else{$('appPage').hidden=true;$('loginPage').hidden=false}});const msg=$('firebaseConnectStatus');if(msg)msg.textContent='เชื่อมต่อ Firebase แล้ว — เข้าสู่ระบบเพื่อเปิด Packing / Dashboard / Packages / Help'}
if(credit()?.ready)connectFirebaseUI();else window.addEventListener('packtook-firebase-ready',connectFirebaseUI,{once:true});
$('subscriptionHistoryClose')?.addEventListener('click',()=>subscriptionHistoryDialog()?.close());
$('subscriptionHistoryMore')?.addEventListener('click',()=>{ $('subscriptionHistoryMore').textContent='โหลดประวัติเพิ่ม';void subscriptionLoadHistory() });
$('subscriptionHistoryDialog')?.addEventListener('close',()=>{billingHistoryCursor=null;$('subscriptionHistoryRows').replaceChildren()});

$('barcodeFilter').addEventListener('input',renderHistory);
$('trialBtn').addEventListener('click',()=>toast('สมัครบัญชีทดสอบได้ที่ /firebase-v4.html หรือผ่าน Firebase Staging'));

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
setInterval(()=>{if(!!remoteUser&&!document.hidden)void runRetention(false)},60*60*1000);

// Live camera display preferences do not change the recording resolution.
const cameraWrap=$('cameraPreviewWrap');
const cameraSize=$('cameraViewSize');
cameraSize.value=['normal','large','xlarge'].includes(store.cameraViewSize)?store.cameraViewSize:'normal';
function applyCameraViewSize(){cameraWrap.classList.toggle('camera-large',cameraSize.value==='large');cameraWrap.classList.toggle('camera-xlarge',cameraSize.value==='xlarge');store.cameraViewSize=cameraSize.value;persist()}
cameraSize.addEventListener('change',applyCameraViewSize);applyCameraViewSize();
$('cameraFullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement===cameraWrap)await document.exitFullscreen();else await cameraWrap.requestFullscreen()}catch(e){toast('เปิดเต็มหน้าจอไม่สำเร็จ: '+e.message)}});
document.addEventListener('fullscreenchange',()=>{$('cameraFullscreen').textContent=document.fullscreenElement===cameraWrap?'⤡ ออกจากเต็มหน้าจอ':'⛶ เต็มหน้าจอ'});
