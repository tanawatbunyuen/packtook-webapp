'use strict';
// File System Access streaming writer. Browser holds only a bounded queue of video chunks.
(function(){
 const MAX_QUEUED_BYTES=24*1024*1024;
 async function open(directory,filename){
  const handle=await directory.getFileHandle(filename,{create:true});
  const writable=await handle.createWritable({keepExistingData:false});
  let chain=Promise.resolve(),queued=0,written=0,failed=null,closed=false,started=false;
  function enqueue(blob){
   if(closed||failed)throw failed||Error('Video writer closed');
   if(!blob||blob.size===0)return;
   if(queued+blob.size>MAX_QUEUED_BYTES){
    failed=Error('Disk writer is slower than camera: pending video exceeds 24MB. Stop and inspect the partial file.');
    throw failed;
   }
   started=true;queued+=blob.size;
   chain=chain.then(async()=>{
    await writable.write(blob);
    written+=blob.size;
   }).catch(e=>{failed=e;throw e}).finally(()=>{queued-=blob.size});
   chain.catch(()=>{}); // observed again by finish(), avoids unhandled rejections
  }
  async function finish(){
   if(closed)throw Error('Writer already closed');
   await chain;
   if(failed)throw failed;
   await writable.close();closed=true;
   const file=await handle.getFile();
   if(file.size!==written)throw Error('Recorded file size mismatch');
   return file;
  }
  async function preservePartial(){
   if(closed)return;
   try{await chain}catch{}
   try{await writable.close();closed=true}catch(e){console.warn('Could not close partial video',e)}
  }
  async function cancelUnstarted(){
   if(started)throw Error('Recorded chunks exist; partial file requires review');
   if(!closed){try{await writable.abort();closed=true}catch(e){console.warn('Could not abort empty writer',e)}}
   try{await directory.removeEntry(filename)}catch(e){console.warn('Could not remove empty recording placeholder',e)}
  }
  return {filename,enqueue,finish,preservePartial,cancelUnstarted,get queuedBytes(){return queued},get writtenBytes(){return written},get error(){return failed}};
 }
 window.PACKTOOK_VIDEO_WRITER={open};
})();
