"use strict";
const assert=require("node:assert/strict");
const d=require("../../functions/operator-domain-v1.cjs");
let pass=0;
function ok(name,fn){fn();pass++;console.log("PASS "+name)}
function rejects(fn,pattern){assert.throws(fn,pattern)}
const alice={uid:"owner001",email:"owner@example.com"};
const bob={uid:"operator002",email:"operator@example.com"};
const eve={uid:"attacker003",email:"attacker@example.com"};
const now=Date.now();
ok("verified Auth and verified email required",()=>{
 assert.deepEqual(d.verifiedPrincipal({auth:{uid:"owner001",token:{email_verified:true,email:"OWNER@example.com"}}}),alice);
 rejects(()=>d.verifiedPrincipal({auth:{uid:"owner001",token:{email_verified:false,email:"owner@example.com"}}}),/EMAIL_NOT_VERIFIED/);
 rejects(()=>d.verifiedPrincipal({auth:null}),/UNAUTHENTICATED/);
});
ok("email normalization, invalid email and stable digest",()=>{
 assert.equal(d.emailAddress(" OPERATOR@EXAMPLE.COM "),"operator@example.com");
 assert.equal(d.emailDigest("OPERATOR@example.com"),d.emailDigest("operator@example.com"));
 rejects(()=>d.emailAddress("invalid"),/Invalid email/);
});
ok("membership must match UID, email and exact tenant",()=>{
 const membership={uid:bob.uid,emailHash:d.emailDigest(bob.email),accountId:alice.uid,role:"operator",status:"active"};
 assert.equal(d.requireMembership(bob,membership,alice.uid),"operator");
 rejects(()=>d.requireMembership(eve,membership,alice.uid),/MEMBERSHIP_NOT_AUTHORIZED/);
 rejects(()=>d.requireMembership(bob,{...membership,status:"revoked"},alice.uid),/MEMBERSHIP_NOT_AUTHORIZED/);
 rejects(()=>d.requireMembership(bob,membership,"otherTenant"),/MEMBERSHIP_NOT_AUTHORIZED/);
 rejects(()=>d.requireMembership({...bob,email:"new@example.com"},membership,alice.uid),/MEMBERSHIP_NOT_AUTHORIZED/);
});
ok("invitation only binds exact verified email and owner",()=>{
 const invite={status:"pending",emailHash:d.emailDigest(bob.email),expiresAtMs:now+10000,accountId:alice.uid,invitedBy:alice.uid};
 assert.equal(d.inviteState(invite,bob,now),true);
 rejects(()=>d.inviteState(invite,eve,now),/INVITE_EMAIL_MISMATCH/);
 rejects(()=>d.inviteState({...invite,status:"accepted"},bob,now),/INVITE_NOT_PENDING/);
 rejects(()=>d.inviteState(invite,bob,now+20000),/INVITE_EXPIRED/);
 rejects(()=>d.inviteState({...invite,invitedBy:eve.uid},bob,now),/INVITE_OWNER_INVALID/);
});
ok("owner-only authorization",()=>{
 assert.equal(d.requireOwner(alice,alice.uid),true);
 rejects(()=>d.requireOwner(bob,alice.uid),/OWNER_ONLY/);
});
ok("barcode/request validation",()=>{
 assert.equal(d.barcodeValue(" ABC "),"ABC");
 assert.equal(d.requestReason("  reason long enough  "),"reason long enough");
 assert.equal(d.requestId("abcdefghijklmnop"),"abcdefghijklmnop");
 rejects(()=>d.requestReason("short"),/Reason/);
 rejects(()=>d.barcodeValue(" "),/Invalid barcode/);
 rejects(()=>d.requestId("123"),/Invalid request ID/);
});
ok("request status tenant isolation",()=>{
 const request={accountId:alice.uid,requestedBy:bob.uid};
 assert.equal(d.canSeeRequest(alice,"admin",request),true);
 assert.equal(d.canSeeRequest(bob,"operator",request),true);
 rejects(()=>d.canSeeRequest(eve,"operator",request),/UNAUTHORIZED_REQUEST/);
 rejects(()=>d.canSeeRequest(bob,"admin",request),/UNAUTHORIZED_REQUEST/);
});
ok("approval needs owner, pending, not self, unexpired and completed lock",()=>{
 const request={accountId:alice.uid,requestedBy:bob.uid,status:"pending",expiresAtMs:now+10000,barcode:"ABC"};
 const lock={status:"completed",barcode:"ABC"};
 assert.equal(d.assertApprover(alice,request,now,lock),true);
 rejects(()=>d.assertApprover(bob,request,now,lock),/OWNER_ONLY/);
 rejects(()=>d.assertApprover(alice,{...request,requestedBy:alice.uid},now,lock),/SELF_APPROVAL_FORBIDDEN/);
 rejects(()=>d.assertApprover(alice,request,now+20000,lock),/REQUEST_EXPIRED/);
 rejects(()=>d.assertApprover(alice,request,now,{...lock,status:"reserved"}),/ORIGINAL_RECORDING_NOT_COMPLETED/);
 rejects(()=>d.assertApprover(alice,{...request,status:"approved"},now,lock),/REQUEST_NOT_PENDING/);
});
ok("approval consumption tied to same operator, request and barcode",()=>{
 const request={id:"requestid0123456789",status:"approved",accountId:alice.uid,requestedBy:bob.uid,barcode:"ABC"};
 const approval={status:"approved",requestId:request.id,requestedBy:bob.uid,barcode:"ABC",expiresAtMs:now+10000};
 assert.equal(d.assertApprovalUse(approval,request,bob,now,"ABC"),true);
 rejects(()=>d.assertApprovalUse(approval,request,eve,now,"ABC"),/APPROVAL_NOT_AUTHORIZED/);
 rejects(()=>d.assertApprovalUse(approval,request,bob,now+20000,"ABC"),/APPROVAL_EXPIRED/);
 rejects(()=>d.assertApprovalUse({...approval,status:"consumed"},request,bob,now,"ABC"),/APPROVAL_NOT_AUTHORIZED/);
 rejects(()=>d.assertApprovalUse(approval,request,bob,now,"OTHER"),/BARCODE_MISMATCH/);
});
assert.equal(pass,9);
console.log("PACKTOOK_OPERATOR_DOMAIN_UNIT_TESTS=9/9_PASS");
console.log("PACKTOOK_OPERATOR_MULTITENANT_INTEGRATION=NOT_IMPLEMENTED");
console.log("PACKTOOK_REAL_FIREBASE_CALLS=0");
console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
