"use strict";
// PACKTOOK V6.2 Production Owner Analytics (read only).
// Dedicated Owner codebase. V6.2.3 adds separately gated, audited customer adjustments (no payments).
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
admin.initializeApp();
const db=admin.firestore();
const PROJECT="packtook-prod-01";
const REGION="asia-southeast1";
const options={region:REGION,maxInstances:2,timeoutSeconds:90,memory:"256MiB"};
const plans=["Free","Starter","Basic","Growth","Business","Pro"];
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const BATCH=100,MAX_ACCOUNTS=1200,PER_PAGE=25;

async function requireOwner(req){
 if(process.env.PACKTOOK_PRODUCTION_PROJECT_ID!==PROJECT||
    (process.env.GCLOUD_PROJECT&&process.env.GCLOUD_PROJECT!==PROJECT)||
    (process.env.GCP_PROJECT&&process.env.GCP_PROJECT!==PROJECT)){
   throw new HttpsError("failed-precondition","Production Owner project guard failed");
 }
 if(!req.auth?.uid)throw new HttpsError("unauthenticated","Sign in with Production Owner account");
 if(req.auth.token?.email_verified!==true)throw new HttpsError("permission-denied","Verify your email first");
 // A customer's admin role and Production Beta permission are NOT Owner rights.
 if(req.auth.token?.packtookPlatformOwner!==true)throw new HttpsError("permission-denied","Platform Owner claim required");
 // Check the canonical Production Auth record on every privileged request.
 // This makes a revoked or disabled Owner ineligible without waiting for ID-token expiry.
 let liveUser;
 try{liveUser=await admin.auth().getUser(req.auth.uid)}
 catch(e){
  if(e.code==="auth/user-not-found")throw new HttpsError("permission-denied","Owner account no longer exists");
  console.error("Owner authorization directory lookup failed",{code:e.code||"unknown"});
  throw new HttpsError("unavailable","Cannot verify current Owner permission");
 }
 if(liveUser.disabled||!liveUser.emailVerified||liveUser.customClaims?.packtookPlatformOwner!==true)
  throw new HttpsError("permission-denied","Owner permission disabled or revoked");
 return req.auth.uid;
}
function monthTH(ms){return new Date(ms+7*3600000).toISOString().slice(0,7)}
function millis(v){
 if(!v)return null;
 if(typeof v.toMillis==="function")return v.toMillis();
 if(typeof v==="number"&&Number.isFinite(v))return v;
 if(typeof v==="string"){const x=Date.parse(v);return Number.isFinite(x)?x:null}
 return null;
}
function monthId(ms=Date.now()){return new Date(ms).toISOString().slice(0,7)}
function state(a){
 if(a.plan==="Free")return "free";
 if(typeof a.plan!=="string"||!Object.hasOwn(limits,a.plan))return "invalid";
 if(!a.planExpiresAt)return "unconfigured";
 const exp=Date.parse(a.planExpiresAt);
 if(!Number.isFinite(exp))return "invalid";
 return exp<=Date.now()?"expired":"active";
}
function credits(a){
 if(!Object.hasOwn(limits,a.plan))return {balance:null,status:"review"};
 if(state(a)==="expired")return {balance:0,status:"expired"};
 if(!["active","free"].includes(state(a)))return {balance:null,status:"inactive"};
 if(limits[a.plan]===null)return {balance:null,status:"unlimited"};
 if(a.creditWalletV1===true){
  const v=a.creditWalletRemaining;
  return Number.isSafeInteger(v)&&v>=0?{balance:v,status:"available"}:{balance:null,status:"review"};
 }
 const current=monthId(),same=a.period===current;
 const used=same?(a.used||0):0,reserved=same?(a.reserved||0):0;
 if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(reserved)||reserved<0)return {balance:null,status:"review"};
 return {balance:Math.max(0,limits[a.plan]-used-reserved),status:"available"};
}
function expiryDetails(a){
 if(a.plan==="Free")return {expiresAt:null,expiryState:"no_expiry",daysRemaining:null};
 if(!a.planExpiresAt)return {expiresAt:null,expiryState:"not_set",daysRemaining:null};
 if(typeof a.planExpiresAt!=="string")return {expiresAt:null,expiryState:"invalid",daysRemaining:null};
 const at=Date.parse(a.planExpiresAt);
 if(!Number.isFinite(at))return {expiresAt:null,expiryState:"invalid",daysRemaining:null};
 const now=Date.now();
 return {expiresAt:new Date(at).toISOString(),expiryState:at<=now?"expired":"active",
   daysRemaining:at<=now?0:Math.ceil((at-now)/86400000)};
}
function baseAccount(a){
 return {plan:typeof a.plan==="string"?a.plan:"Unknown",status:state(a),
  joinedAt:millis(a.createdAt),...expiryDetails(a),
  reservedCredits:Number.isSafeInteger(a.reserved)&&a.reserved>=0?a.reserved:0};
}
function assertCursor(cursor){
 if(cursor===null||cursor===undefined)return null;
 if(typeof cursor!=="string"||cursor.length===0||cursor.length>128||!(/^[A-Za-z0-9_-]+$/.test(cursor)))
  throw new HttpsError("invalid-argument","Invalid account pagination cursor");
 return cursor;
}
exports.ownerAnalyticsSummary=onCall(options,async req=>{
 await requireOwner(req);
 const now=Date.now(),localMonth=monthTH(now);
 const [year,month]=localMonth.split("-").map(Number);
 const months=Array.from({length:12},(_,i)=>new Date(Date.UTC(year,month-1-(11-i),1)).toISOString().slice(0,7));
 const byMonth=new Map(months.map(month=>[month,{month,newCustomers:0}]));
 const byPlan=new Map(plans.map(plan=>[plan,{plan,customers:0,active:0,expired:0}]));
 const totals={customers:0,free:0,activePaid:0,expiredPaid:0,otherPaid:0};
 let cursor=null,scanned=0,truncated=false;
 while(scanned<MAX_ACCOUNTS){
  let q=db.collection("accounts").orderBy(admin.firestore.FieldPath.documentId()).limit(Math.min(BATCH,MAX_ACCOUNTS-scanned));
  if(cursor)q=q.startAfter(cursor);
  const snap=await q.get();
  if(snap.empty)break;
  for(const doc of snap.docs){
   const a=doc.data(),p=a.plan,status=state(a),tier=byPlan.get(p);
   totals.customers++;
   if(tier)tier.customers++;
   if(status==="free")totals.free++;
   else if(status==="active"){totals.activePaid++;if(tier)tier.active++}
   else if(status==="expired"){totals.expiredPaid++;if(tier)tier.expired++}
   else totals.otherPaid++;
   const joined=millis(a.createdAt),record=joined===null?null:byMonth.get(monthTH(joined));
   if(record)record.newCustomers++;
  }
  scanned+=snap.size;
  cursor=snap.docs[snap.docs.length-1];
  if(snap.size<BATCH)break;
 }
 if(scanned>=MAX_ACCOUNTS){
  const more=await db.collection("accounts").orderBy(admin.firestore.FieldPath.documentId()).startAfter(cursor).limit(1).get();
  truncated=!more.empty;
 }
 return {asOf:new Date(now).toISOString(),mode:"production-beta",billingEnabled:false,
  scannedAccounts:scanned,maxScannedAccounts:MAX_ACCOUNTS,truncated,
  totals,plans:[...byPlan.values()],months:[...byMonth.values()],
  caveat:"รายงานแสดงบัญชีที่มีเอกสาร accounts ใน Production เท่านั้น ไม่รวมบัญชี Firebase Auth ที่ยังไม่เคยเริ่มใช้งาน"};
});
exports.ownerAnalyticsCustomers=onCall(options,async req=>{
 await requireOwner(req);
 const afterId=assertCursor(req.data?.afterId);
 let q=db.collection("accounts").orderBy(admin.firestore.FieldPath.documentId()).limit(PER_PAGE+1);
 if(afterId)q=q.startAfter(afterId);
 const snap=await q.get(),docs=snap.docs.slice(0,PER_PAGE);
 let names=new Map();
 if(docs.length){
  try{
   const accounts=await admin.auth().getUsers(docs.map(doc=>({uid:doc.id})));
   names=new Map(accounts.users.map(user=>[user.uid,user.email||null]));
  }catch(e){
   console.error("Production Owner Firebase directory lookup unavailable",{code:e.code||"unknown"});
   throw new HttpsError("unavailable","Cannot read Production customer emails");
  }
 }
 const customers=docs.map(doc=>{
  const a=doc.data(),basic=baseAccount(a),c=credits(a);
  return {accountId:doc.id,email:names.get(doc.id)||null,plan:basic.plan,status:basic.status,
   joinedAt:basic.joinedAt===null?null:new Date(basic.joinedAt).toISOString(),
   expiresAt:basic.expiresAt,expiryState:basic.expiryState,daysRemaining:basic.daysRemaining,
   creditsRemaining:c.balance,
   creditsUnlimited:c.status==="unlimited",creditsStatus:c.status,walletEnabled:a.creditWalletV1===true,reservedCredits:basic.reservedCredits,
   hasBilling:false};
 });
 return {customers,nextCursor:snap.docs.length>PER_PAGE&&docs.length?docs[docs.length-1].id:null};
});

/**
 * PACKTOOK V6.2.1 - read-only sales ledger, never a payment endpoint.
 * Source: Production accounts/{uid}/billingRequests where status == "paid".
 * These are database records, NOT real-time Omise reconciliation or net receipts.
 * Missing or conflicting mode metadata is counted separately as unclassified.
 */
const BILLING_SCAN_LIMIT=100;
const BILLING_WORKERS=8;
function classifyPaidBilling(p){
 if(p?.status!=="paid")return null;
 const amount=p.amountTHB;
 if(!Number.isSafeInteger(amount)||amount<0)
  return {mode:"unclassified",amount:0,invalidAmount:true};
 const id=typeof p.omiseChargeId==="string"?p.omiseChargeId:"";
 const provider=p.paymentProvider==="omise";
 if(provider&&p.omiseLivemode!==true&&id.startsWith("chrg_test_"))return {mode:"test",amount};
 if(provider&&p.omiseLivemode===true&&/^chrg_[A-Za-z0-9]+$/.test(id)&&!id.startsWith("chrg_test_"))
  return {mode:"live",amount};
 return {mode:"unclassified",amount,invalidAmount:false};
}
exports.ownerAnalyticsRevenue=onCall(options,async req=>{
 await requireOwner(req);
 const now=Date.now(),currentMonth=monthTH(now);
 const [year,month]=currentMonth.split("-").map(Number);
 const months=Array.from({length:12},(_,i)=>new Date(Date.UTC(year,month-1-(11-i),1)).toISOString().slice(0,7));
 const monthly=new Map(months.map(m=>[m,{month:m,liveSalesTHB:0,livePayments:0,testSalesTHB:0,testPayments:0,
   unclassifiedSalesTHB:0,unclassifiedPayments:0}]));
 const byPlan=new Map(plans.map(p=>[p,{plan:p,liveSalesTHB:0,livePayments:0,testSalesTHB:0,testPayments:0,
   unclassifiedPayments:0}]));
 const total={liveSalesTHB:0,livePayments:0,testSalesTHB:0,testPayments:0,
   unclassifiedSalesTHB:0,unclassifiedPayments:0,invalidAmountRecords:0};
 let cursor=null,scanned=0,truncated=false,limitedBillingAccounts=0;
 while(scanned<MAX_ACCOUNTS){
  let q=db.collection("accounts").orderBy(admin.firestore.FieldPath.documentId())
   .limit(Math.min(BATCH,MAX_ACCOUNTS-scanned));
  if(cursor)q=q.startAfter(cursor);
  const snap=await q.get();
  if(snap.empty)break;
  for(let i=0;i<snap.docs.length;i+=BILLING_WORKERS){
   const group=snap.docs.slice(i,i+BILLING_WORKERS);
   // Per-account bounded scan. Do not query other accounts from client code.
   const pages=await Promise.all(group.map(async doc=>{
    try{
     const paid=await doc.ref.collection("billingRequests").where("status","==","paid")
      .limit(BILLING_SCAN_LIMIT+1).get();
     return {docs:paid.docs,accountId:doc.id};
    }catch(e){
     console.error("Owner billing read failed",{code:e.code||"unknown"});
     throw new HttpsError("unavailable","Cannot read Production billing ledger; report not shown");
    }
   }));
   for(const page of pages){
    if(page.docs.length>BILLING_SCAN_LIMIT){truncated=true;limitedBillingAccounts++}
    for(const bill of page.docs.slice(0,BILLING_SCAN_LIMIT)){
     const p=bill.data(),classified=classifyPaidBilling(p);
     if(!classified)continue;
     const mode=classified.mode;
     const moneyKey=mode+"SalesTHB",countKey=mode==="unclassified"?"unclassifiedPayments":mode+"Payments";
     total[moneyKey]+=classified.amount;total[countKey]++;
     if(classified.invalidAmount)total.invalidAmountRecords++;
     const stamp=millis(p.paidAt)||millis(p.createdAt),bucket=stamp===null?null:monthly.get(monthTH(stamp));
     if(bucket){bucket[moneyKey]+=classified.amount;bucket[countKey]++}
     const tier=byPlan.get(p.plan);
     if(tier){
      tier[countKey]++;
      if(mode!=="unclassified")tier[moneyKey]+=classified.amount;
     }
    }
   }
  }
  scanned+=snap.size;cursor=snap.docs[snap.docs.length-1];
  if(snap.size<BATCH)break;
 }
 if(scanned>=MAX_ACCOUNTS){
  const more=await db.collection("accounts").orderBy(admin.firestore.FieldPath.documentId())
   .startAfter(cursor).limit(1).get();
  if(!more.empty)truncated=true;
 }
 return {asOf:new Date(now).toISOString(),timezone:"Asia/Bangkok",billingEnabled:false,
  source:"Production Firestore billingRequests (status=paid)",
  reconciliation:"NOT_RECONCILED",truncated,scannedAccounts:scanned,
  maxScannedAccounts:MAX_ACCOUNTS,limitedBillingAccounts,
  totals:total,months:[...monthly.values()],plans:[...byPlan.values()],
  caveat:"ยอดจากรายการ paid ใน Firestore เท่านั้น ไม่ใช่เงินเข้าบัญชีจริงหรือยอดสุทธิหลังหักคืนเงิน; ไม่ใช้แทนรายงานจาก Omise/ธนาคาร"};
});


// V6.2.3 — audited Owner Customer Management. Disabled unless explicitly enabled.
// Manual complimentary credits / expiration adjustments are NOT purchase records.
const crypto=require("node:crypto");
const MANAGEMENT_ENABLED=process.env.PACKTOOK_OWNER_MANAGEMENT_ENABLED==="true";
const MAX_CREDIT_GRANT=500,MAX_WALLET_BALANCE=100000;
const MAX_EXPIRY_DAYS=731;
async function requireManager(req){
 const ownerId=await requireOwner(req);
 if(!MANAGEMENT_ENABLED)throw new HttpsError("failed-precondition","Owner management is disabled in this Production environment");
 if(req.auth.token?.packtookOwnerManager!==true)throw new HttpsError("permission-denied","Additional Owner Manager claim required");
 const live=await admin.auth().getUser(ownerId);
 if(live.disabled||!live.emailVerified||live.customClaims?.packtookOwnerManager!==true||
    live.customClaims?.packtookPlatformOwner!==true)
  throw new HttpsError("permission-denied","Owner Manager access revoked");
 return ownerId;
}
const validUserId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
const sameExpiry=(a,expected)=>{
 const raw=a.planExpiresAt;
 const actual=typeof raw==="string"&&Number.isFinite(Date.parse(raw))?new Date(raw).toISOString():null;
 return actual===expected;
};
function expectedAccountInput(d){
 if(!validUserId(d?.accountId)||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.requestId))
   throw new HttpsError("invalid-argument","Invalid Customer ID or operation UUID");
 if(!["grant_credits","set_expiry"].includes(d.action))
   throw new HttpsError("invalid-argument","Unsupported Owner operation");
 if(typeof d.reason!=="string"||d.reason.trim().length<10||d.reason.trim().length>300)
   throw new HttpsError("invalid-argument","Reason must be between 10 and 300 characters");
 if(d.confirmAccountId!==d.accountId)
   throw new HttpsError("invalid-argument","Confirm the exact customer UID");
 if(typeof d.expectedPlan!=="string"||!Object.hasOwn(limits,d.expectedPlan)||
    (d.expectedExpiresAt!==null&&(
     typeof d.expectedExpiresAt!=="string"||
     !Number.isFinite(Date.parse(d.expectedExpiresAt)))))
   throw new HttpsError("invalid-argument","Expected account snapshot missing");
 if((d.expectedCreditsRemaining!==null&&(!Number.isSafeInteger(d.expectedCreditsRemaining)||d.expectedCreditsRemaining<0))||
    !Number.isSafeInteger(d.expectedReservedCredits)||d.expectedReservedCredits<0)
   throw new HttpsError("invalid-argument","Expected credit snapshot invalid");
 if(typeof d.confirmEmail!=="string"||d.confirmEmail.trim().length<5||d.confirmEmail.length>255)
   throw new HttpsError("invalid-argument","Confirmation email required");
 if(d.action==="grant_credits"&&(!Number.isSafeInteger(d.creditAmount)||d.creditAmount<1||d.creditAmount>MAX_CREDIT_GRANT))
   throw new HttpsError("invalid-argument","Credit grant limit is 1-500");
 if(d.action==="set_expiry"){
  if(typeof d.newExpiresAt!=="string"||!Number.isFinite(Date.parse(d.newExpiresAt))||
     new Date(d.newExpiresAt).toISOString()!==d.newExpiresAt)
   throw new HttpsError("invalid-argument","Expiry must be an ISO UTC timestamp");
  const at=Date.parse(d.newExpiresAt),now=Date.now();
  if(at<=now||at>now+MAX_EXPIRY_DAYS*86400000)
   throw new HttpsError("invalid-argument","Expiry must be in the future within 731 days");
 }
}
function fingerprint(d){
 const obj={action:d.action,accountId:d.accountId,creditAmount:d.creditAmount??null,
  newExpiresAt:d.newExpiresAt??null,reason:d.reason.trim(),
  expectedPlan:d.expectedPlan,expectedExpiresAt:d.expectedExpiresAt,
  expectedCreditsRemaining:d.expectedCreditsRemaining,
  expectedReservedCredits:d.expectedReservedCredits,confirmEmail:d.confirmEmail.toLowerCase().trim()};
 return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}
exports.ownerManagementStatus=onCall(options,async req=>{
 await requireOwner(req);
 const owner=await admin.auth().getUser(req.auth.uid);
 return {enabled:MANAGEMENT_ENABLED,canManage:MANAGEMENT_ENABLED&&
    req.auth.token?.packtookOwnerManager===true&&owner.customClaims?.packtookOwnerManager===true,
  maxCreditsPerAction:MAX_CREDIT_GRANT,actions:["grant_credits","set_expiry"],billingEnabled:false};
});
exports.ownerManageCustomer=onCall(options,async req=>{
 const ownerId=await requireManager(req),d=req.data||{};
 expectedAccountInput(d);
 if(d.accountId===ownerId)throw new HttpsError("permission-denied","Cannot change your own Owner account");
 // Email is a second confirmation, verified against canonical Production Auth.
 const user=await admin.auth().getUser(d.accountId);
 if(user.disabled||!user.email||user.email.toLowerCase()!==d.confirmEmail.toLowerCase().trim())
  throw new HttpsError("failed-precondition","Target email mismatch or account disabled");
 const acc=db.collection("accounts").doc(d.accountId);
 const actionRef=acc.collection("ownerChanges").doc(d.requestId);
 const auditRef=acc.collection("audit").doc("owner_"+d.requestId);
 const inputHash=fingerprint(d);
 const result=await db.runTransaction(async tx=>{
  const [accountSnap,actionSnap]=await Promise.all([tx.get(acc),tx.get(actionRef)]);
  if(actionSnap.exists){
   const existing=actionSnap.data();
   if(existing.fingerprint!==inputHash||existing.ownerId!==ownerId)
    throw new HttpsError("already-exists","Operation ID used for a different request");
   return {ok:true,idempotent:true,action:existing.action,
    newBalance:existing.newBalance??null,newExpiresAt:existing.newExpiresAt??null};
  }
  if(!accountSnap.exists)throw new HttpsError("not-found","Customer account has not been initialized");
  const a=accountSnap.data(),summary=credits(a),basics=baseAccount(a);
  if(!Object.hasOwn(limits,a.plan)||a.plan!==d.expectedPlan||
     !sameExpiry(a,d.expectedExpiresAt)||a.reserved!==d.expectedReservedCredits||
     summary.balance!==d.expectedCreditsRemaining)
   throw new HttpsError("failed-precondition","Customer account changed. Refresh before retrying");
  if(a.openBillingRequestId)throw new HttpsError("failed-precondition","Pending billing request must be resolved first");
  // Critical: no in-flight video. Converting legacy credits while reserved
  // could otherwise alter credit recovery semantics for ongoing recordings.
  if(a.reserved!==0)throw new HttpsError("failed-precondition","Complete all reservations before Owner adjustment");
  const patch={updatedAt:admin.firestore.FieldValue.serverTimestamp()};
  let newBalance=summary.balance,newExpiresAt=basics.expiresAt;
  if(d.action==="grant_credits"){
   if(summary.status!=="available"||limits[a.plan]===null||a.creditWalletV1!==true)
    throw new HttpsError("failed-precondition","Credit grants require an active finite-credit wallet; legacy monthly Free credits cannot be converted");
   newBalance=summary.balance+d.creditAmount;
   if(!Number.isSafeInteger(newBalance)||newBalance>MAX_WALLET_BALANCE)
    throw new HttpsError("failed-precondition","Wallet credit limit exceeded");
   // Preserve Free monthly quota semantics; credit wallet must already exist.
   patch.creditWalletRemaining=newBalance;
  }else{
   if(a.plan==="Free")throw new HttpsError("failed-precondition","Free plan has no expiry");
   newExpiresAt=d.newExpiresAt;
   patch.planExpiresAt=newExpiresAt;
  }
  const audit={action:d.action,requestId:d.requestId,ownerId,
   accountId:d.accountId,targetEmail:user.email,
   reason:d.reason.trim(),beforePlan:a.plan,beforeBalance:summary.balance,
   afterBalance:newBalance,beforeExpiresAt:basics.expiresAt,afterExpiresAt:newExpiresAt,
   creditDelta:d.action==="grant_credits"?d.creditAmount:0,
   createdAt:admin.firestore.FieldValue.serverTimestamp(),
   fingerprint:inputHash,newBalance,newExpiresAt};
  tx.update(acc,patch);
  tx.create(actionRef,audit);
  tx.create(auditRef,{...audit,action:"owner_"+d.action});
  return {ok:true,idempotent:false,action:d.action,newBalance,newExpiresAt};
 });
 return result;
});
exports.ownerCustomerManagementHistory=onCall(options,async req=>{
 await requireOwner(req);
 const id=req.data?.accountId;
 if(!validUserId(id))throw new HttpsError("invalid-argument","Invalid Customer UID");
 const records=await db.collection("accounts").doc(id).collection("ownerChanges")
   .orderBy("createdAt","desc").limit(20).get();
 return {items:records.docs.map(x=>{
  const a=x.data();
  return {requestId:x.id,action:a.action,createdAt:millis(a.createdAt),
    ownerId:a.ownerId,reason:a.reason,creditDelta:a.creditDelta,
    beforeBalance:a.beforeBalance,afterBalance:a.afterBalance,
    beforeExpiresAt:a.beforeExpiresAt,afterExpiresAt:a.afterExpiresAt};
 })};
});
