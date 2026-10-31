'use strict';
// IndexedDB video metadata store. Videos themselves always stay in the user-selected folder.
(function(){
 const NAME='packtook-video-history-v1',STORE='videos';
 let dbPromise=null;
 function connect(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   const request=indexedDB.open(NAME,1);
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE)){
     const store=db.createObjectStore(STORE,{keyPath:'filename'});
     store.createIndex('time',['timestamp','filename']);
     store.createIndex('dayTime',['day','timestamp','filename']);
     store.createIndex('month','month');
    }
   };
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();dbPromise=null};resolve(db)};
   request.onerror=()=>{dbPromise=null;reject(request.error)};
   request.onblocked=()=>{dbPromise=null;reject(Error('กรุณาปิด PACKTOOK ในแท็บอื่นเพื่ออัปเดตฐานข้อมูล'))};
  });
  return dbPromise;
 }
 async function transaction(mode,work){
  const db=await connect();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
   let result;
   tx.oncomplete=()=>resolve(result);
   tx.onabort=()=>reject(tx.error||Error('IndexedDB transaction aborted'));
   tx.onerror=()=>{}; // onabort reports the actual transaction error
   try{work(store,value=>{result=value})}catch(e){tx.abort();reject(e)}
  });
 }
 function validate(row){
  if(!row||typeof row.filename!=='string'||!row.filename||!Number.isSafeInteger(row.timestamp))
   throw Error('ข้อมูลประวัติวิดีโอไม่ครบ');
  const dt=new Date(row.timestamp);
  const yyyy=dt.getFullYear(),mm=String(dt.getMonth()+1).padStart(2,'0'),dd=String(dt.getDate()).padStart(2,'0');
  return {...row,day:yyyy+'-'+mm+'-'+dd,month:yyyy+'-'+mm};
 }
 async function put(row){const item=validate(row);return transaction('readwrite',store=>store.put(item))}
 async function putMany(rows){
  const items=rows.filter(r=>r&&!r.deleted).map(validate);
  if(!items.length)return;
  return transaction('readwrite',store=>{for(const item of items)store.put(item)});
 }
 async function remove(filename){
  if(typeof filename!=='string')throw Error('Invalid video filename');
  return transaction('readwrite',store=>store.delete(filename));
 }
 async function get(filename){return transaction('readonly',(store,done)=>{const q=store.get(filename);q.onsuccess=()=>done(q.result||null)})}
 async function counts(month){
  return transaction('readonly',(store,done)=>{
   let total=null,current=null;
   const finish=()=>{if(total!==null&&current!==null)done({total,current})};
   const a=store.count(),b=store.index('month').count(month);
   a.onsuccess=()=>{total=a.result;finish()};
   b.onsuccess=()=>{current=b.result;finish()};
  });
 }
 function validCursor(cursor){return cursor&&Number.isSafeInteger(cursor.timestamp)&&typeof cursor.filename==='string'&&cursor.filename.length>0}
 async function page({day='',barcode='',after=null,limit=50}={}){
  if(after&&!validCursor(after))throw Error('Invalid history cursor');
  limit=Math.min(100,Math.max(1,Number(limit)||50));
  const filter=String(barcode||'').trim().toLowerCase();
  return transaction('readonly',(store,done)=>{
   const index=store.index(day?'dayTime':'time');
   const maxName='\uffff';
   const range=day?
    IDBKeyRange.bound([day,0,''],[day,after?after.timestamp:Number.MAX_SAFE_INTEGER,after?after.filename:maxName],false,!!after):
    after?IDBKeyRange.upperBound([after.timestamp,after.filename],true):null;
   const req=index.openCursor(range,'prev'),items=[];
   let more=false;
   req.onsuccess=()=>{
    const cur=req.result;
    if(!cur){done({items,nextCursor:null});return}
    const entry=cur.value;
    if(!filter||String(entry.barcode||'').toLowerCase().includes(filter)){
     if(items.length<limit)items.push(entry);
     else{more=true;done({items,nextCursor:{timestamp:items[items.length-1].timestamp,filename:items[items.length-1].filename}});return}
    }
    cur.continue();
   };
  });
 }
 async function expired(cutoff,limit=100){
  return transaction('readonly',(store,done)=>{
   const req=store.index('time').openCursor(IDBKeyRange.upperBound([cutoff,'\uffff']),'next');
   const result=[];req.onsuccess=()=>{
    const cursor=req.result;
    if(!cursor||result.length>=limit){done(result);return}
    result.push(cursor.value);cursor.continue();
   };
  });
 }
 window.PACKTOOK_VIDEO_HISTORY={connect,put,putMany,remove,get,counts,page,expired};
})();
