'use strict';
// PACKTOOK V5.7: privacy-preserving, local-only performance observations.
// No barcode, order id, staff identity, filename, payment or account id is collected.
(function(){
 const KEY='packtook-v5.7-local-perf-v1';
 const KEEP_DAYS=30,MAX_ROWS=2500;
 const VALID=new Set(['start','stop','disk','verify','credit','completion','failure']);
 const PHASES={
  start:'สแกน → เริ่ม REC',
  stop:'สแกนหยุด → Encoder หยุด',
  disk:'ปิดไฟล์ลงดิสก์',
  verify:'ตรวจสอบวิดีโอ',
  credit:'ยืนยันเครดิต Firebase',
  completion:'หยุด → พร้อมออเดอร์ถัดไป'
 };
 const STAGES=new Set(['start','stop','disk','verify','credit','unknown']);
 const CATEGORIES=new Set(['network','storage','camera','permission','quota','validation','unknown']);
 let rows=[],storeError=null,writeScheduled=false,renderScheduled=false;
 const $=id=>document.getElementById(id);
 function load(){
  try{
   const raw=JSON.parse(localStorage.getItem(KEY)||'[]');
   if(!Array.isArray(raw))return [];
   const cutoff=Date.now()-KEEP_DAYS*86400000;
   return raw.filter(x=>x&&Number.isFinite(x.t)&&x.t>=cutoff&&VALID.has(x.k)
      &&(x.k==='failure'||Number.isFinite(x.ms)&&x.ms>=0&&x.ms<=3600000)).slice(-MAX_ROWS);
  }catch(e){storeError='ไม่สามารถอ่านสถิติใน Browser ได้';return []}
 }
 rows=load();
 function store(){
  writeScheduled=false;
  try{
   const cutoff=Date.now()-KEEP_DAYS*86400000;
   rows=rows.filter(x=>x.t>=cutoff).slice(-MAX_ROWS);
   localStorage.setItem(KEY,JSON.stringify(rows));storeError=null;
  }catch(e){storeError='พื้นที่ Local Storage ไม่พร้อม — สถิติใหม่อาจไม่ถูกเก็บ';console.warn('PACKTOOK performance local storage unavailable',e)}
  if(!renderScheduled){
   renderScheduled=true;
   setTimeout(()=>{renderScheduled=false;render()},150);
  }
 }
 function schedule(){
  if(writeScheduled)return;
  writeScheduled=true;
  // Do not add synchronous storage writes to the Barcode-to-REC critical path.
  setTimeout(store,0);
 }
 function classify(err){
  const code=String(err?.code||'').toLowerCase(),message=String(err?.message||'').toLowerCase();
  if(/resource-exhausted|quota|limit/.test(code+' '+message))return 'quota';
  if(/network|unavailable|deadline|timeout|offline|failed to fetch|internet|connection/.test(code+' '+message))return 'network';
  if(/disk|folder|file|writ|stream|storage|notfound|quotaexceeded/.test(code+' '+message))return 'storage';
  if(/camera|mediarecorder|webcam|track|video device|stream closed/.test(code+' '+message))return 'camera';
  if(/permission|denied|unauthenticated/.test(code+' '+message))return 'permission';
  if(/invalid|verify|black|blank|corrupt|decode/.test(code+' '+message))return 'validation';
  return 'unknown';
 }
 function record(kind,ms=null,opts={}){
  try{
   if(!VALID.has(kind))return;
   const row={t:Date.now(),k:kind};
   if(kind==='failure'){
    row.stage=STAGES.has(opts.stage)?opts.stage:'unknown';
    row.category=CATEGORIES.has(opts.category)?opts.category:classify(opts.error);
   }else{
    if(!Number.isFinite(ms)||ms<0||ms>3600000)return;
    row.ms=Math.round(ms);
    if(kind==='completion'){
     if(Number.isFinite(opts.bytes))row.mib=Math.round(opts.bytes/1048576*100)/100;
     if(Number.isFinite(opts.seconds))row.seconds=Math.round(opts.seconds);
    }
   }
   rows.push(row);
   if(rows.length>MAX_ROWS)rows.splice(0,rows.length-MAX_ROWS);
   schedule();
  }catch(e){console.warn('PACKTOOK performance sample skipped',e)}
 }
 function percentile(samples,q){
  if(!samples.length)return null;
  const sorted=[...samples].sort((a,b)=>a-b);
  return sorted[Math.max(0,Math.ceil(sorted.length*q)-1)];
 }
 function getStats(days=7){
  const cutoff=Date.now()-Math.max(1,Math.min(30,days))*86400000;
  const filtered=rows.filter(x=>x.t>=cutoff);
  const metrics={};
  for(const kind of Object.keys(PHASES)){
   const sample=filtered.filter(x=>x.k===kind).map(x=>x.ms);
   metrics[kind]={count:sample.length,p50:percentile(sample,.5),p95:percentile(sample,.95),max:sample.length?Math.max(...sample):null};
  }
  const failures=filtered.filter(x=>x.k==='failure');
  const breakdown={};
  for(const x of failures)breakdown[x.category]=(breakdown[x.category]||0)+1;
  return {metrics,failures:failures.length,completed:metrics.completion.count,breakdown,rows:filtered,storeError};
 }
 function td(value){const item=document.createElement('td');item.textContent=value;return item}
 function ms(x){return x===null?'—':x.toLocaleString('th-TH')+' ms'}
 function render(){
  const target=$('perfOverview');
  if(!target)return;
  const select=$('perfRange'),range=Number(select?.value||7),data=getStats(range);
  const main=[
   ['เริ่ม REC P95',data.metrics.start.p95,1500,'warm network / เป้าหมาย ≤ 1,500 ms'],
   ['หยุด REC P95',data.metrics.stop.p95,200,'เป้าหมาย ≤ 200 ms'],
   ['Saving P95',data.metrics.completion.p95,null,'รวมเขียนไฟล์ ตรวจสอบ และ Firebase'],
   ['วิดีโอสำเร็จ',data.completed,null,'รายการที่วัดผลสำเร็จ']
  ];
  target.replaceChildren();
  for(const [label,v,goal,helper] of main){
   const box=document.createElement('div');box.className='perf-stat';
   const small=document.createElement('span');small.textContent=label;
   const big=document.createElement('strong');big.textContent=label==='วิดีโอสำเร็จ'?v.toLocaleString('th-TH'):ms(v);
   const foot=document.createElement('small');foot.textContent=helper;
   if(goal!==null&&v!==null)box.dataset.status=v<=goal?'good':'slow';
   box.append(small,big,foot);target.append(box);
  }
  const body=$('perfPhases');if(body){
   body.replaceChildren();
   for(const [kind,label] of Object.entries(PHASES)){
    const m=data.metrics[kind],tr=document.createElement('tr');
    [label,m.count.toLocaleString('th-TH'),ms(m.p50),ms(m.p95),ms(m.max)].forEach(v=>tr.append(td(v)));
    body.append(tr);
   }
  }
  const count=$('perfCount');if(count)count.textContent='ตัวอย่างสถิติ '+data.rows.length.toLocaleString('th-TH')+' ค่า • บันทึกสำเร็จ '+data.completed.toLocaleString('th-TH')+' ครั้ง';
  const failures=$('perfFailures');if(failures)failures.textContent=data.failures.toLocaleString('th-TH');
  const types=$('perfErrorCategories');
  if(types)types.textContent=data.failures?Object.entries(data.breakdown).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(' • '):'ยังไม่พบเหตุผิดพลาดที่บันทึก';
  const notice=$('perfStorageStatus');
  if(notice){notice.hidden=!data.storeError;notice.textContent=data.storeError||''}
  const newest=$('perfRecent');
  if(newest){
   newest.replaceChildren();
   for(const x of data.rows.slice(-8).reverse()){
    const line=document.createElement('li'),date=new Date(x.t).toLocaleString('th-TH');
    line.textContent=date+' — '+(x.k==='failure'?'ผิดพลาด ('+x.stage+' / '+x.category+')':PHASES[x.k]+' '+ms(x.ms));
    newest.append(line);
   }
   if(!newest.childElementCount){const li=document.createElement('li');li.textContent='ยังไม่มีข้อมูลการใช้งานจริง';newest.append(li)}
  }
 }
 function download(){
  const range=Number($('perfRange')?.value||7),data=getStats(range);
  const lines=['date_time,phase,duration_ms,error_stage,error_category,video_size_mib,video_seconds'];
  for(const x of data.rows){
   lines.push([new Date(x.t).toISOString(),x.k,x.ms??'',x.stage??'',x.category??'',x.mib??'',x.seconds??''].join(','));
  }
  const blob=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='packtook-performance-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function reset(){
  if(!confirm('ล้างสถิติ Performance ของ Browser เครื่องนี้ทั้งหมดหรือไม่? ไม่กระทบเครดิตหรือวิดีโอ'))return;
  rows=[];schedule();render();
 }
 $('perfRange')?.addEventListener('change',render);
 $('perfRefresh')?.addEventListener('click',render);
 $('perfDownload')?.addEventListener('click',download);
 $('perfClear')?.addEventListener('click',reset);
 window.PACKTOOK_PERF={record,render,getStats,classify};
})();
