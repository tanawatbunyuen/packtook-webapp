// Supabase Edge Function: packtook-credits (Deno runtime)
// Requires verified user JWT; service role never leaves the server.
// Configure CORS origin for the PACKTOOK frontend.
import { createClient } from 'npm:@supabase/supabase-js@2';
const url=Deno.env.get('SUPABASE_URL')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed=(Deno.env.get('PACKTOOK_WEB_ORIGIN')||'https://tanawatbunyuen.github.io');
function respond(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','access-control-allow-origin':allowed,'vary':'origin'}})}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(origin && origin!==allowed)return respond({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{headers:{'access-control-allow-origin':allowed,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','vary':'origin'}});
 if(req.method!=='POST')return respond({error:'POST required'},405);
 try{
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return respond({error:'Login required'},401);
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await client.auth.getUser(bearer.slice(7));
  if(userError||!user)return respond({error:'Invalid session'},401);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:account,error:accountError}=await admin.from('pt_accounts').select('id,plan,period_start,period_end').eq('owner_id',user.id).maybeSingle();
  if(accountError)throw accountError;
  if(!account)return respond({error:'No organization provisioned'},403);
  const body=await req.json();
  if(!body || typeof body!=='object')return respond({error:'Invalid request'},400);
  const action=body.action;
  if(action==='status'){
    const {data:rows,error}=await admin.from('pt_recordings').select('status,created_at').eq('account_id',account.id).gte('created_at',account.period_start).lt('created_at',account.period_end).in('status',['reserved','completed']);
    if(error)throw error;
    const limits:Record<string,number|null>={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
    const limit=limits[account.plan]??null;
    const used=rows?.length||0;
    return respond({plan:account.plan,limit,used,remaining:limit===null?null:Math.max(0,limit-used),period_end:account.period_end});
  }
  if(action==='reserve'){
    if(typeof body.barcode!=='string'||body.barcode.length>160||!body.barcode.trim())return respond({error:'Invalid barcode'},400);
    if(typeof body.operation_id!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.operation_id))return respond({error:'Invalid operation id'},400);
    const {data,error}=await admin.rpc('pt_reserve',{p_account:account.id,p_user:user.id,p_operation:body.operation_id,p_barcode:body.barcode});
    if(error)return respond({error:error.message},409);
    return respond(data?.[0]||{error:'reservation failed'});
  }
  if(action==='complete'||action==='fail'){
    if(typeof body.recording_id!=='string')return respond({error:'Invalid recording ID'},400);
    const name=action==='complete'?'pt_complete':'pt_fail';
    const args=action==='complete'?{p_recording:body.recording_id,p_user:user.id,p_filename:body.filename,p_bytes:body.bytes}:{p_recording:body.recording_id,p_user:user.id};
    const {data,error}=await admin.rpc(name,args);
    if(error)return respond({error:error.message},409);
    return respond({ok:data===true});
  }
  return respond({error:'Unknown action'},400);
 }catch(e){console.error('packtook-credits error',e);return respond({error:'Request failed'},500)}
});