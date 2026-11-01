"use strict";
// PACKTOOK V6.2 Production Owner Analytics (read only).
// A dedicated codebase. It cannot modify credits, plans, subscriptions or payments.
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

function requireOwner(req){
 if(process.env.PACKTOOK_PRODUCTION_PROJECT_ID!==PROJECT||
    (process.env.GCLOUD_PROJECT&&process.env.GCLOUD_PROJECT!==PROJECT)||
    (process.env.GCP_PROJECT&&process.env.GCP_PROJECT!==PROJECT)){
   throw new HttpsError("failed-precondition","Production Owner project guard failed");
 }
 if(!req.auth?.uid)throw new HttpsError("unauthenticated","Sign in with Production Owner account");
 if(req.auth.token?.email_verified!==true)throw new HttpsError("permission-denied","Verify your email first");
 // A customer's admin role and Production Beta permission are NOT Owner rights.
 if(req.auth.token?.packtookPlatformOwner!==true)throw new HttpsError("permission-denied","Platform Owner claim required");
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
function baseAccount(a){
 return {plan:typeof a.plan==="string"?a.plan:"Unknown",status:state(a),
  joinedAt:millis(a.createdAt),expiresAt:typeof a.planExpiresAt==="string"?a.planExpiresAt:null,
  reservedCredits:Number.isSafeInteger(a.reserved)&&a.reserved>=0?a.reserved:0};
}
function assertCursor(cursor){
 if(cursor===null||cursor===undefined)return null;
 if(typeof cursor!=="string"||cursor.length===0||cursor.length>128||!(/^[A-Za-z0-9_-]+$/.test(cursor)))
  throw new HttpsError("invalid-argument","Invalid account pagination cursor");
 return cursor;
}
exports.ownerAnalyticsSummary=onCall(options,async req=>{
 requireOwner(req);
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
 requireOwner(req);
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
   expiresAt:basic.expiresAt,creditsRemaining:c.balance,
   creditsUnlimited:c.status==="unlimited",creditsStatus:c.status,reservedCredits:basic.reservedCredits,
   hasBilling:false};
 });
 return {customers,nextCursor:snap.docs.length>PER_PAGE&&docs.length?docs[docs.length-1].id:null};
});
