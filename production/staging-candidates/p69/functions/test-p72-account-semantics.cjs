"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {LIMITS,planState,periodId,validNumber,available,pending,usageResponse}=require("./p72-account-semantics.cjs");
const now=Date.parse("2026-11-18T12:00:00Z");
const base={plan:"Free",period:"2026-11",used:3,reserved:2,creditWalletV1:true,
 creditWalletRemaining:15,walletStartingCredits:20,openBillingRequestId:"bill_1"};
test("P72 usageStatus legacy schema exact field set",()=>{
 const r=usageResponse(base,now);
 assert.deepEqual(Object.keys(r).sort(),["plan","limit","used","reserved","remaining",
  "walletEnabled","walletStartingCredits","period","openBillingRequestId",
  "canBuyMore","purchaseReason","planExpiresAt","subscriptionStatus"].sort());
 assert.equal(r.remaining,15);assert.equal(r.walletStartingCredits,20);
 assert.equal(r.subscriptionStatus,"free");assert.equal(r.canBuyMore,false);
});
test("P72 paid expiry and malformed subscription semantics mirror legacy",()=>{
 const a={plan:"Starter"};
 assert.equal(planState(a,now),"unconfigured");
 assert.equal(planState({...a,planExpiresAt:"garbage"},now),"invalid");
 assert.equal(planState({...a,planExpiresAt:new Date(now).toISOString()},now),"expired");
 assert.equal(planState({...a,planExpiresAt:new Date(now+1).toISOString()},now),"active");
 assert.equal(planState({...a,planExpiresAt:""},now),"unconfigured");
});
test("P72 legacy next-month reservation resets with counters validated",()=>{
 const a={plan:"Free",period:"2026-10",used:17,reserved:2,creditWalletV1:false};
 assert.equal(available(a,now),20);assert.equal(pending(a,now),0);
 const r=usageResponse(a,now);assert.equal(r.used,0);assert.equal(r.reserved,0);
 assert.equal(r.remaining,20);assert.equal(r.walletStartingCredits,null);
});
test("P72 wallet remains across month boundary",()=>{
 const a={...base,period:"2026-10"};
 assert.equal(available(a,now),15);assert.equal(pending(a,now),2);
 const r=usageResponse(a,now);assert.equal(r.used,0);assert.equal(r.reserved,2);
});
test("P72 legacy same-month credits subtract committed",()=>{
 const a={...base,creditWalletV1:false};
 assert.equal(available(a,now),15);
});
test("P72 reject missing, negative, overflow wallet / counters",()=>{
 assert.throws(()=>available({...base,creditWalletRemaining:undefined},now),/P72_INVALID_COUNTER/);
 assert.throws(()=>available({...base,creditWalletRemaining:-1},now),/P72_INVALID_COUNTER/);
 assert.throws(()=>available({...base,creditWalletV1:false,used:-3},now),/P72_INVALID_COUNTER/);
 assert.throws(()=>available({...base,creditWalletV1:false,used:Number.MAX_SAFE_INTEGER,reserved:2},now),/P72_COUNTER_OVERFLOW/);
 assert.throws(()=>available({...base,creditWalletV1:false,plan:"unknown"},now),/P72_INVALID_PLAN/);
});
test("P72 invalid legacy counters fail even after month roll",()=>{
 assert.throws(()=>available({plan:"Free",period:"2026-10",used:-1,reserved:2},now),/P72_INVALID_COUNTER/);
});
test("P72 Pro is unlimited and does not mutate wallet",()=>{
 const a={...base,plan:"Pro",planExpiresAt:new Date(now+10000).toISOString()};
 assert.equal(available(a,now),null);
 assert.equal(usageResponse(a,now).remaining,null);
});
test("P72 safe null defaults in response",()=>{
 const r=usageResponse({plan:"Free",period:"2026-11",used:0,reserved:0,creditWalletV1:false},now);
 assert.equal(r.openBillingRequestId,null);
 assert.equal(r.planExpiresAt,null);
 assert.equal(r.purchaseReason,null);
 assert.equal(r.walletStartingCredits,null);
});
test("P72 no implicit activation/free credits in usage semantics",()=>{
 assert.throws(()=>usageResponse(null,now));
});
