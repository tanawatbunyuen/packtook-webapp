'use strict';
const roles=['Security','Finance','Engineering','LegalOps','Owner'];
function assessApprovals(input){
 const approvals=input&&typeof input==='object'?input:{};
 const actors=new Set();
 const details=roles.map(role=>{
  const p=approvals[role];
  const ok=!!p&&p.decision==='APPROVE'&&typeof p.actorId==='string'
    &&p.actorId.length>=6&&typeof p.evidenceRef==='string'
    &&/^https:\/\/[^\s]+$/.test(p.evidenceRef)
    &&p.scope==='recovery-controlled-pilot'&&p.independent===true;
  if(ok)actors.add(p.actorId);
  return {role,submitted:ok};
 });
 const all=details.every(d=>d.submitted)&&actors.size===roles.length;
 return Object.freeze({status:all?'AWAIT_EXTERNAL_VERIFICATION':'HOLD',
   missing:details.filter(d=>!d.submitted).map(d=>d.role),
   distinctActors:actors.size,releaseAuthorized:false});
}
module.exports={assessApprovals,roles};
