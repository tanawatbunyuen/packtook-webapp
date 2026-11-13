'use strict';
// RR-03 isolated governance contract. Never authorizes a cloud write or updates Auth claims.
const valid=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{6,128}$/.test(x);
const ROLES=new Set(['maker','finance','technical','owner']);
const ACTIONS=new Set(['GRANT','REVOKE']);
function evaluatePolicyChange(input){
 const x=input&&typeof input==='object'?input:{};
 const fail=[];
 if(!valid(x.accountId)||!valid(x.actorId)||!valid(x.policyId))fail.push('invalid_tenant_subject');
 if(!ROLES.has(x.role)||!ACTIONS.has(x.action))fail.push('invalid_role_or_action');
 if(!valid(x.requesterId)||!valid(x.securityApproverId)||!valid(x.ownerApproverId))
   fail.push('missing_approvers');
 if(new Set([x.actorId,x.requesterId,x.securityApproverId,x.ownerApproverId]).size!==4)
   fail.push('self_or_colluding_identity');
 if(!x.securityApprovalVerified||!x.ownerApprovalVerified)fail.push('approvals_unverified');
 if(x.tenantScopeConfirmed!==true)fail.push('tenant_scope_unverified');
 if(x.principalDisabled!==false||x.principalEmailVerified!==true)fail.push('principal_not_eligible');
 if(!Number.isSafeInteger(x.expectedEpoch)||x.expectedEpoch<1)fail.push('invalid_epoch');
 if(!/^https:\/\/\S+$/.test(x.evidenceRef||''))fail.push('evidence_missing');
 return Object.freeze({gate:fail.length?'HOLD':'REVIEW_ONLY',
   fail,mayWritePolicy:false,maySetCustomClaims:false,releaseAuthorized:false});
}
module.exports={evaluatePolicyChange};
