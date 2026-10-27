import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { packtookConfig } from './v4-config.js';
const $=id=>document.getElementById(id);
let client,latest=null,session=null;
function message(s){$('status').textContent=typeof s==='string'?s:JSON.stringify(s,null,2)}
function show(ready){$('auth').style.display=ready?'none':'block';$('app').style.display=ready?'block':'none';$('identity').textContent=ready?session.user.email:''}
async function call(action,params={}){
 const token=(await client.auth.getSession()).data.session?.access_token;
 if(!token)throw Error('Session expired. Please login again.');
 const response=await fetch(packtookConfig.functionUrl,{method:'POST',headers:{'content-type':'application/json','apikey':packtookConfig.publishableKey,authorization:'Bearer '+token},body:JSON.stringify({action,...params})});
 const data=await response.json();if(!response.ok)throw Error(data.error||'API error');return data;
}
async function quota(){const q=await call('status');$('quota').textContent='แพ็กเกจ: '+q.plan+' | ใช้แล้ว: '+q.used+' | คงเหลือ: '+(q.remaining??'ไม่จำกัด');message(q)}
async function setup(){
 try {
  if(!packtookConfig.supabaseUrl||!packtookConfig.publishableKey||!packtookConfig.functionUrl)throw Error('กรอกค่าใน v4-config.js ก่อน');
  client=createClient(packtookConfig.supabaseUrl,packtookConfig.publishableKey,{auth:{flowType:'pkce'}});
  client.auth.onAuthStateChange((event,s)=>{session=s;show(!!s);if(event==='PASSWORD_RECOVERY'){$('recovery').style.display='block';show(false);message('กรุณาตั้งรหัสผ่านใหม่')}else if(s)setTimeout(()=>quota().catch(e=>message(e.message)),0)});
  session=(await client.auth.getSession()).data.session;show(!!session);if(session)await quota();else message('พร้อมรับบัญชีจริงจาก Supabase Auth');
 }catch(e){message('Configuration error: '+e.message)}
}
const run=(id,fn)=>$(id).addEventListener('click',async()=>{try{message('กำลังดำเนินการ…');await fn()}catch(e){message('Error: '+e.message)}});
run('login',async()=>{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;});
run('signup',async()=>{if($('password').value.length<12)throw Error('รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร');const {error}=await client.auth.signUp({email:$('email').value.trim(),password:$('password').value});if(error)throw error;message('สมัครแล้ว โปรดยืนยันอีเมลก่อนเข้าสู่ระบบ')});
run('reset',async()=>{const {error}=await client.auth.resetPasswordForEmail($('email').value.trim(),{redirectTo:location.origin+location.pathname});if(error)throw error;message('หากมีบัญชีนี้ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่าน')});
run('reserve',async()=>{latest=await call('reserve',{barcode:$('barcode').value,operation_id:crypto.randomUUID()});message(latest);await quota()});
run('fail',async()=>{if(!latest?.recording_id)throw Error('ยังไม่มี reservation');await call('fail',{recording_id:latest.recording_id});latest=null;await quota()});
run('refresh',quota);
run('changePassword',async()=>{const pwd=$('newPassword').value;if(pwd.length<12)throw Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร');const {error}=await client.auth.updateUser({password:pwd});if(error)throw error;$('recovery').style.display='none';message('เปลี่ยนรหัสผ่านแล้ว');await client.auth.signOut()});
run('logout',async()=>{const {error}=await client.auth.signOut();if(error)throw error;show(false);message('ออกจากระบบแล้ว')});
setup();