/* PACKTOOK Owner V5.9 management panel. Uses the EXISTING Firebase app via injected call adapter.
 Usage: import {openCustomerManager} from '/owner-management-v59.js';
 openCustomerManager({customerUid: row.uid, email: row.email,
   call: (name,data)=>httpsCallable(getFunctions(app,'asia-southeast1'),name)(data).then(r=>r.data),
   onSaved: reloadCustomers});
*/
const styles=`
.pt59-overlay{position:fixed;inset:0;background:rgba(11,22,40,.7);z-index:99999;display:grid;place-items:center;padding:16px;font-family:system-ui,Arial,sans-serif;color:#172333}
.pt59-panel{position:relative;background:#fff;width:min(850px,100%);max-height:90vh;overflow:auto;border-radius:16px;padding:24px;box-shadow:0 24px 70px #0005}
.pt59-head{display:flex;align-items:start;justify-content:space-between;gap:16px}.pt59-head h2{margin:0 0 6px}.pt59-muted{font-size:13px;color:#657287;overflow-wrap:anywhere}
.pt59-summary{background:#f1f5f9;border-radius:10px;padding:12px;margin:16px 0;font-weight:600;line-height:1.6}
.pt59-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pt59-form{border:1px solid #dce3ee;border-radius:12px;padding:16px}.pt59-form h3{margin:0 0 12px}
.pt59-form label{display:block;margin-top:12px;font-size:13px;font-weight:600}.pt59-form input,.pt59-form textarea{width:100%;box-sizing:border-box;margin-top:5px;border:1px solid #ccd5e0;border-radius:8px;font:inherit;padding:10px;background:white;color:#172333}
.pt59-form button{margin-top:14px;padding:10px 15px;border:0;border-radius:8px;background:#0c6b77;color:#fff;font-weight:600;cursor:pointer}
.pt59-form button:disabled{opacity:.5;cursor:not-allowed}.pt59-close{border:0;background:none;font:inherit;cursor:pointer;font-size:24px}
.pt59-error{color:#a31232;white-space:pre-wrap;margin-top:12px}.pt59-success{color:#08734b;margin-top:12px}.pt59-history{font-size:13px}.pt59-history div{border-top:1px solid #e2e8f0;padding:10px 0}
@media(max-width:680px){.pt59-grid{grid-template-columns:1fr}.pt59-panel{padding:16px}}`;
if(!document.getElementById('pt59-style')){const s=document.createElement('style');s.id='pt59-style';s.textContent=styles;document.head.append(s);}
const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
const fmt=date=>date?new Date(date).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'—';
export async function openCustomerManager({customerUid,email='',call,onSaved=async()=>{}}){
 if(!customerUid||typeof call!=='function')throw Error('Missing customer UID or Firebase callable adapter');
 const overlay=node('div',undefined,'pt59-overlay');overlay.setAttribute('role','presentation');
 const panel=node('section',undefined,'pt59-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 const head=node('div',undefined,'pt59-head');
 const title=node('div');title.append(node('h2','Manage Customer'),node('div',email||customerUid,'pt59-muted'),node('div',customerUid,'pt59-muted'));
 const close=node('button','×','pt59-close');close.type='button';close.setAttribute('aria-label','Close');head.append(title,close);
 const summary=node('div','Loading…','pt59-summary'),error=node('div','','pt59-error'),success=node('div','','pt59-success');
 error.setAttribute('role','alert');success.setAttribute('role','status');
 const grid=node('div',undefined,'pt59-grid');
 const creditForm=node('form',undefined,'pt59-form'),expiryForm=node('form',undefined,'pt59-form');
 const field=(f,label,input)=>{const l=node('label',label);l.append(input);f.append(l);};
 creditForm.append(node('h3','Add video credits'));
 const amount=node('input');amount.type='number';amount.min='1';amount.max='100000';amount.step='1';amount.required=true;field(creditForm,'Credits to add',amount);
 const whyCredit=node('textarea');whyCredit.required=true;whyCredit.minLength=10;whyCredit.maxLength=300;whyCredit.placeholder='Reason at least 10 characters';field(creditForm,'Reason',whyCredit);
 const creditBtn=node('button','Add credits');creditBtn.type='submit';creditForm.append(creditBtn);
 expiryForm.append(node('h3','Update expiry date'));
 const date=node('input');date.type='date';date.required=true;date.min='2020-01-01';date.max='2100-12-31';field(expiryForm,'Valid through (Bangkok)',date);
 const whyExpiry=node('textarea');whyExpiry.required=true;whyExpiry.minLength=10;whyExpiry.maxLength=300;whyExpiry.placeholder='Reason at least 10 characters';field(expiryForm,'Reason',whyExpiry);
 const expiryBtn=node('button','Update expiry');expiryBtn.type='submit';expiryForm.append(expiryBtn);
 grid.append(creditForm,expiryForm);
 const log=node('div','Loading history…','pt59-history');
 panel.append(head,summary,error,success,grid,node('h3','Recent adjustments'),log);overlay.append(panel);document.body.append(overlay);
 const previousFocus=document.activeElement;close.focus();let busy=false,creditToken,expiryToken,editable=true;
 const remove=()=>{if(busy)return;overlay.remove();document.removeEventListener('keydown',key);previousFocus?.focus?.();};
 const key=e=>{if(e.key==='Escape'){e.preventDefault();remove();}if(e.key==='Tab'){const f=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')];if(f.length&&e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus();}else if(f.length&&!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus();}}};
 document.addEventListener('keydown',key);close.onclick=remove;overlay.onclick=e=>{if(e.target===overlay)remove();};
 const toggle=v=>{busy=v;creditBtn.disabled=v||!editable;expiryBtn.disabled=v;close.disabled=v;};
 async function refresh(){
  const state=await call('ownerGetCustomerManageState',{customerUid});
  editable=state.creditEditable;
  summary.textContent='Plan: '+state.plan+'  |  Remaining: '+(state.unlimited?'Unlimited':state.remainingCredits)+'  |  Expiry: '+fmt(state.expiryAt);
  creditBtn.disabled=!editable;
  if(state.expiryAt&&!date.value){const d=new Date(new Date(state.expiryAt).getTime()-1);date.value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  const hist=await call('ownerGetCustomerAdjustmentHistory',{customerUid,limit:15});
  log.replaceChildren();
  if(!hist.events?.length)log.textContent='No adjustments recorded';
  for(const ev of hist.events||[])log.append(node('div',fmt(ev.createdAt)+' | '+ev.operation+' | '+(ev.amount??ev.after??'')+' | '+(ev.reason||'')));
 }
 async function submit(name,data,reset){
  error.textContent='';success.textContent='';toggle(true);
  try{const out=await call(name,data);success.textContent=out.replayed?'Already applied: no duplicate change.':'Saved and audited successfully';reset();await refresh();await onSaved();}
  catch(e){error.textContent=e?.message||'Update failed. Check history before retrying.';}
  finally{toggle(false);}
 }
 amount.addEventListener('input',()=>creditToken=null);whyCredit.addEventListener('input',()=>creditToken=null);
 date.addEventListener('input',()=>expiryToken=null);whyExpiry.addEventListener('input',()=>expiryToken=null);
 creditForm.onsubmit=e=>{e.preventDefault();if(busy||!creditForm.reportValidity())return;const n=Number(amount.value);if(!Number.isSafeInteger(n)||n<1||n>100000)return;
  const req={customerUid,amount:n,reason:whyCredit.value.trim(),requestId:creditToken||crypto.randomUUID()};
  if(!confirm('Add '+n+' video credits to '+(email||customerUid)+'?'))return;
  creditToken=req.requestId;void submit('ownerGrantVideoCredits',req,()=>{creditToken=null;amount.value='';whyCredit.value='';});
 };
 expiryForm.onsubmit=e=>{e.preventDefault();if(busy||!expiryForm.reportValidity())return;
  const req={customerUid,expiryDate:date.value,reason:whyExpiry.value.trim(),requestId:expiryToken||crypto.randomUUID()};
  if(!confirm('Update expiry for '+(email||customerUid)+' to '+date.value+' Bangkok?'))return;
  expiryToken=req.requestId;void submit('ownerUpdateCustomerExpiry',req,()=>{expiryToken=null;whyExpiry.value='';});
 };
 try{await refresh();}catch(e){error.textContent=e?.message||'Unable to load customer';creditForm.hidden=true;expiryForm.hidden=true;}
 return {close:remove};
}
window.PACKTOOK_OWNER_V59={openCustomerManager};
